// Prove every outreach channel still works — before a real prospect is on the
// other end of it.
//
//   node scripts/outreach-selftest.mjs            # offline: every channel, no messages sent
//   node scripts/outreach-selftest.mjs --live     # ALSO sends a real email/SMS to yourself
//   node scripts/outreach-selftest.mjs --links    # print the assisted deep links to eyeball
//   node scripts/outreach-selftest.mjs --case smtp
//
// The channels do not all mean the same thing, so they cannot all be tested the
// same way (see src/lib/outreach/send.ts for the distinction this mirrors):
//
//   AUTOMATIC (email/SMTP, SMS/Twilio) — the app delivers. Testable end to end:
//     the run stands up a throwaway SMTP server and a stubbed Twilio endpoint and
//     asserts what actually went over the wire, then --live proves the real
//     credentials work by sending to your own address/number.
//
//   ASSISTED (Facebook DM, Instagram DM, phone) — there is NO cold-DM API, so
//     there is nothing to deliver and nothing to mock. What CAN break is the
//     handoff: the wrong deep link, an unsubstituted "[Your name]", a body that
//     never made it to the clipboard. Those are asserted; --links prints the URLs
//     so you can click them once and see the right thread open.
//
//   REFUSED (WhatsApp, unknown channels) — must fail loudly. Asserted as failures.
//
// The invariant that matters most has its own checks on every channel: a send
// that did not reach the prospect must NEVER mark the record sent, advance the
// lead, or schedule a follow-up. A silent no-op is worse than a visible error.
//
// Nothing here touches dev.db: each case gets a throwaway copy of the schema with
// the rows emptied, so the run is repeatable and leaves no fixtures behind.
import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import Database from "better-sqlite3";
import { ROOT, app } from "./lib/app-imports.mjs";

loadEnv({ path: path.join(ROOT, ".env"), quiet: true });
loadEnv({ path: path.join(ROOT, ".env.local"), override: true, quiet: true });

// A case must run in the environment IT specifies, not the one this machine
// happens to have — a check for "no country code configured" is worthless if the
// operator's own SMS_DEFAULT_COUNTRY_CODE reaches it. Since .env.local is loaded
// with override:true (Prisma's config does the same, and the app depends on it),
// it beats anything the parent put in the child's environment. So the parent
// hands its overrides across as data and they are re-applied here, after the
// dotenv load, where nothing can undo them.
//
// Only child processes get this. The parent deliberately keeps the real
// environment: the preflight's job is to report YOUR configuration.
if (process.env.SELFTEST_ENV) {
  Object.assign(process.env, JSON.parse(process.env.SELFTEST_ENV));
}

// Importing .ts from a package with no "type" field makes node warn once per
// module about reparsing. It's expected here and drowns out the report.
const NODE_FLAGS = ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON"];

const argv = process.argv.slice(2);
const has = (flag) => argv.includes(flag);
const arg = (flag) => {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : undefined;
};

// ───────────────────────────────────────────────────────────── assertions ────
// A child process runs one case and streams its results back as JSON lines.

const RESULT_PREFIX = "##R ";
const results = [];

function record(r) {
  if (process.env.SELFTEST_CASE) console.log(RESULT_PREFIX + JSON.stringify(r));
  else results.push(r);
}

/** Run one named assertion. Any throw is a failure with its message. */
async function check(name, fn) {
  try {
    await fn();
    record({ ok: true, name });
  } catch (err) {
    record({ ok: false, name, detail: err.message });
  }
}

function eq(actual, expected, what) {
  if (actual !== expected) {
    throw new Error(`${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}
function truthy(value, what) {
  if (!value) throw new Error(`${what}: expected a value, got ${JSON.stringify(value)}`);
}
function contains(haystack, needle, what) {
  if (!String(haystack ?? "").includes(needle)) {
    throw new Error(`${what}: ${JSON.stringify(needle)} missing from ${JSON.stringify(String(haystack).slice(0, 160))}`);
  }
}
function absent(haystack, needle, what) {
  if (String(haystack ?? "").includes(needle)) {
    throw new Error(`${what}: ${JSON.stringify(needle)} should NOT appear`);
  }
}

// ──────────────────────────────────────────────────────────── throwaway db ────

/**
 * A private SQLite file with the app's schema and no rows. Copied from dev.db
 * (the schema is already there) and emptied; if there's no dev.db yet, prisma
 * builds one from the schema.
 */
function makeTestDb(label) {
  const dir = mkdtempSync(path.join(os.tmpdir(), `outreach-selftest-${label}-`));
  const file = path.join(dir, "test.db");
  const devDb = path.join(ROOT, "dev.db");

  if (existsSync(devDb)) {
    copyFileSync(devDb, file);
    const db = new Database(file);
    const tables = db
      .prepare(
        `select name from sqlite_master
          where type = 'table' and name not like 'sqlite_%' and name != '_prisma_migrations'`,
      )
      .all();
    for (const t of tables) db.prepare(`delete from "${t.name}"`).run();
    db.close();
  } else {
    execFileSync("npx", ["prisma", "db", "push", "--skip-generate", "--accept-data-loss"], {
      cwd: ROOT,
      env: { ...process.env, DATABASE_URL: `file:${file}` },
      stdio: "ignore",
    });
  }
  return { file, dispose: () => rmSync(dir, { recursive: true, force: true }) };
}

// ─────────────────────────────────────────────────────────────── fixtures ────
// Built with raw SQL rather than Prisma so a fixture can't be shaped by the same
// bug it's meant to catch, and so setup stays independent of client generation.

let seq = 0;
function fixtureIds(kind) {
  seq += 1;
  return { leadId: `selftest-lead-${kind}-${seq}`, outreachId: `selftest-msg-${kind}-${seq}` };
}

/**
 * One lead with one draft message on `channel`, plus a queued step-1 follow-up so
 * the cascade (sending step 0 schedules step 1) can be asserted.
 */
function seedLead(db, kind, { channel, contact = null, email = null, phone = null, previewImagePath = null, body = "Hi — quick note about your website.\n\n[Your name]", subject = "A mockup of your new site" }) {
  const { leadId, outreachId } = fixtureIds(kind);
  const now = new Date().toISOString();
  // Drafting resolves the handle onto the message itself (see draft.ts), and the
  // follow-up engine relies on it being there — so fixtures carry it too, except
  // where a case is deliberately testing a lead with nothing to send to.
  const handle = contact ?? (channel === "email" ? email : channel === "sms" || channel === "phone" ? phone : null);
  db.prepare(
    `insert into Lead (id, placeId, source, name, email, phone, tier, score, status,
                       previewImagePath, previewVariant, reviewCount, photoCount,
                       previewViews, showcase, createdAt, updatedAt)
     values (?, ?, 'selftest', ?, ?, ?, 'HOT', 90, 'approved', ?, 0, 0, 0, 0, 0, ?, ?)`,
  ).run(leadId, `selftest-place-${leadId}`, `Selftest ${kind}`, email, phone, previewImagePath, now, now);

  const insertMsg = db.prepare(
    `insert into Outreach (id, leadId, channel, contact, subject, body, step, status,
                           scheduledAt, sentAt, reviewedAt, createdAt, updatedAt)
     values (?, ?, ?, ?, ?, ?, ?, ?, null, null, ?, ?, ?)`,
  );
  insertMsg.run(outreachId, leadId, channel, handle, subject, body, 0, "approved", now, now, now);
  insertMsg.run(`${outreachId}-f1`, leadId, channel, handle, subject, "Following up on the mockup.", 1, "queued", null, now, now);

  return { leadId, outreachId, followupId: `${outreachId}-f1` };
}

/** Read back the rows deliverOutreach should (or should not) have touched. */
function readState(db, { leadId, outreachId, followupId }) {
  const msg = db.prepare(`select status, sentAt from Outreach where id = ?`).get(outreachId);
  const lead = db.prepare(`select status from Lead where id = ?`).get(leadId);
  const followup = db.prepare(`select status, scheduledAt from Outreach where id = ?`).get(followupId);
  return { msg, lead, followup };
}

/** Everything that must be true after a genuine delivery. */
function assertRecordedSent(db, ids, what) {
  const { msg, lead, followup } = readState(db, ids);
  eq(msg.status, "sent", `${what}: message status`);
  truthy(msg.sentAt, `${what}: sentAt stamped`);
  eq(lead.status, "sent", `${what}: lead advanced`);
  truthy(followup.scheduledAt, `${what}: next follow-up scheduled`);
}

/** Everything that must STILL be true after a failed delivery — the core invariant. */
function assertNotRecorded(db, ids, what) {
  const { msg, lead, followup } = readState(db, ids);
  eq(msg.status, "approved", `${what}: message must stay unsent`);
  eq(msg.sentAt, null, `${what}: sentAt must stay empty`);
  eq(lead.status, "approved", `${what}: lead must not advance`);
  eq(followup.scheduledAt, null, `${what}: follow-up must not be scheduled`);
}

// ────────────────────────────────────────────────────────── fake transports ──

/**
 * A minimal ESMTP server that accepts one conversation and hands back the raw
 * message. Enough of the protocol for nodemailer: EHLO, AUTH PLAIN, MAIL, RCPT,
 * DATA. Advertising only PLAIN (no STARTTLS) keeps the exchange in cleartext so
 * the assertions can read the message that was actually transmitted.
 */
function startFakeSmtp() {
  const received = [];
  const server = createServer((sock) => {
    let buffer = "";
    let message = "";
    let inData = false;
    sock.setEncoding("utf8");
    sock.write("220 selftest ESMTP\r\n");
    sock.on("data", (chunk) => {
      if (inData) {
        message += chunk;
        const end = message.indexOf("\r\n.\r\n");
        if (end >= 0) {
          received.push(message.slice(0, end));
          message = "";
          inData = false;
          sock.write("250 2.0.0 Ok: queued as SELFTEST\r\n");
        }
        return;
      }
      buffer += chunk;
      let idx;
      while ((idx = buffer.indexOf("\r\n")) >= 0) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const cmd = line.split(" ")[0].toUpperCase();
        if (cmd === "EHLO") sock.write("250-selftest\r\n250-AUTH PLAIN\r\n250 8BITMIME\r\n");
        else if (cmd === "HELO") sock.write("250 selftest\r\n");
        else if (cmd === "AUTH") sock.write("235 2.7.0 Authentication successful\r\n");
        else if (cmd === "DATA") {
          sock.write("354 End data with <CR><LF>.<CR><LF>\r\n");
          inData = true;
          message = buffer;
          buffer = "";
        } else if (cmd === "QUIT") {
          sock.write("221 2.0.0 Bye\r\n");
          sock.end();
        } else sock.write("250 2.0.0 Ok\r\n");
      }
    });
    sock.on("error", () => {});
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve({ port: server.address().port, received, close: () => server.close() });
    });
  });
}

/**
 * Stand in for Twilio's REST API. sms.ts calls api.twilio.com with fetch, so the
 * fetch is what gets intercepted — which also makes the request itself assertable
 * (auth header, normalized To, sender selection).
 */
function stubTwilio(response) {
  const calls = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (!u.startsWith("https://api.twilio.com/")) return real(url, init);
    calls.push({ url: u, headers: init.headers, form: new URLSearchParams(String(init.body)) });
    return new Response(JSON.stringify(response.body), {
      status: response.status,
      headers: { "content-type": "application/json" },
    });
  };
  return calls;
}

/** A 1x1 PNG on disk under public/, so the email attachment path is exercised. */
function makePreviewImage() {
  const webPath = "/previews/.selftest-preview.png";
  const file = path.join(ROOT, "public", webPath.slice(1));
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
  writeFileSync(file, png);
  return { webPath, dispose: () => rmSync(file, { force: true }) };
}

// ────────────────────────────────────────────────────────────────── cases ────
// Each case runs in its own child process: src/lib/env.ts snapshots process.env
// at import time, so "SMTP configured" and "SMTP absent" cannot coexist in one
// process. The child sets its variables, THEN imports the app.

const cases = {
  // Every channel with no automatic transport configured — the state the app
  // ships in, where email/SMS degrade to compose links and DMs are hand-finished.
  assisted: {
    title: "Assisted paths (no SMTP, no Twilio)",
    async run(db) {
      const { deliverOutreach, markSentByHand } = await app("src/lib/outreach/send.ts");

      // Guards the case's own premise: several checks below only mean something
      // when nothing is configured, and .env.local is loaded late enough to undo
      // the parent's clearing if that ever regresses.
      await check("the case runs with no transport configured", async () => {
        const { env } = await app("src/lib/env.ts");
        eq(env.smtpHost, "", "SMTP_HOST leaked in from .env.local");
        eq(env.twilioAccountSid, "", "TWILIO_ACCOUNT_SID leaked in from .env.local");
        eq(env.smsDefaultCountryCode, "", "SMS_DEFAULT_COUNTRY_CODE leaked in from .env.local");
      });

      await check("email → Gmail compose link, prefilled", async () => {
        const ids = seedLead(db, "email", { channel: "email", email: "owner@example.com" });
        const r = await deliverOutreach(ids.outreachId);
        eq(r.ok, true, "ok");
        eq(r.method, "manual", "method");
        contains(r.composeUrl, "mail.google.com", "compose url");
        contains(r.composeUrl, "to=owner%40example.com", "recipient in url");
        contains(r.composeUrl, "su=A+mockup", "subject in url");
        assertRecordedSent(db, ids, "email");
      });

      await check("email with no address → refused, nothing recorded", async () => {
        const ids = seedLead(db, "email-empty", { channel: "email" });
        const r = await deliverOutreach(ids.outreachId);
        eq(r.ok, false, "ok");
        contains(r.error, "No email address", "error");
        assertNotRecorded(db, ids, "email-empty");
      });

      await check("sms → sms: deep link with the body attached", async () => {
        const ids = seedLead(db, "sms", { channel: "sms", phone: "+386 64 194 936" });
        const r = await deliverOutreach(ids.outreachId);
        eq(r.ok, true, "ok");
        eq(r.method, "manual", "method");
        contains(r.composeUrl, "sms:+38664194936", "E.164 in link");
        contains(r.composeUrl, "body=", "body in link");
        truthy(r.copyBody, "clipboard body");
        assertRecordedSent(db, ids, "sms");
      });

      await check("sms, national number, no country code → refused", async () => {
        const ids = seedLead(db, "sms-national", { channel: "sms", phone: "064 194 936" });
        const r = await deliverOutreach(ids.outreachId);
        eq(r.ok, false, "ok");
        contains(r.error, "SMS_DEFAULT_COUNTRY_CODE", "error names the fix");
        assertNotRecorded(db, ids, "sms-national");
      });

      for (const [channel, link] of [
        ["facebook", "https://m.me/selftestbusiness"],
        ["instagram", "https://ig.me/m/selftestbusiness"],
      ]) {
        await check(`${channel} DM → thread opens, body on the clipboard`, async () => {
          const ids = seedLead(db, channel, { channel, contact: link });
          const r = await deliverOutreach(ids.outreachId);
          eq(r.ok, true, "ok");
          eq(r.method, "manual", "method");
          eq(r.composeUrl, link, "thread link passed through untouched");
          truthy(r.copyBody, "clipboard body");
          contains(r.copyBody, "Selftest Owner", "owner name substituted");
          absent(r.copyBody, "[Your name]", "placeholder left in body");
          assertRecordedSent(db, ids, channel);
        });

        await check(`${channel} DM with no thread link → refused`, async () => {
          const ids = seedLead(db, `${channel}-empty`, { channel });
          const r = await deliverOutreach(ids.outreachId);
          eq(r.ok, false, "ok");
          contains(r.error, "m.me/ig.me", "error explains the fix");
          assertNotRecorded(db, ids, `${channel}-empty`);
        });
      }

      await check("phone → tel: dialer link, script on the clipboard", async () => {
        const ids = seedLead(db, "phone", { channel: "phone", phone: "+386 64 194 936" });
        const r = await deliverOutreach(ids.outreachId);
        eq(r.ok, true, "ok");
        eq(r.composeUrl, "tel:+38664194936", "dialer link");
        truthy(r.copyBody, "call script");
        assertRecordedSent(db, ids, "phone");
      });

      await check("whatsapp → refused on policy, nothing recorded", async () => {
        const ids = seedLead(db, "whatsapp", { channel: "whatsapp", phone: "+38664194936" });
        const r = await deliverOutreach(ids.outreachId);
        eq(r.ok, false, "ok");
        contains(r.error, "WhatsApp isn't supported", "error");
        assertNotRecorded(db, ids, "whatsapp");
      });

      await check("unknown channel → refused, nothing recorded", async () => {
        const ids = seedLead(db, "unknown", { channel: "carrier-pigeon", contact: "x" });
        const r = await deliverOutreach(ids.outreachId);
        eq(r.ok, false, "ok");
        contains(r.error, "carrier-pigeon", "error names the channel");
        assertNotRecorded(db, ids, "unknown");
      });

      await check("mark sent by hand → funnel advances, sequence starts", async () => {
        const ids = seedLead(db, "byhand", { channel: "manual" });
        const r = await markSentByHand(ids.outreachId);
        eq(r.ok, true, "ok");
        assertRecordedSent(db, ids, "byhand");
      });

      await check("a sent follow-up is due after the configured interval", async () => {
        const ids = seedLead(db, "cascade", { channel: "email", email: "owner@example.com" });
        await deliverOutreach(ids.outreachId);
        const { followup } = readState(db, ids);
        const days = (new Date(followup.scheduledAt).getTime() - Date.now()) / 86_400_000;
        const expected = Number(process.env.FOLLOWUP_INTERVAL_DAYS ?? 3);
        if (Math.abs(days - expected) > 0.1) {
          throw new Error(`scheduled in ${days.toFixed(2)}d, expected ${expected}d`);
        }
      });

      await check("a prospect who replied drops out of the due queue", async () => {
        const ids = seedLead(db, "paused", { channel: "email", email: "owner@example.com" });
        await deliverOutreach(ids.outreachId);
        db.prepare(`update Outreach set scheduledAt = ? where id = ?`).run(
          new Date(Date.now() - 86_400_000).toISOString(),
          ids.followupId,
        );
        const { listFollowups } = await app("src/lib/outreach/followups.ts");
        const before = await listFollowups();
        truthy(before.due.some((f) => f.id === ids.followupId), "due before the reply");

        db.prepare(`update Lead set repliedAt = ? where id = ?`).run(new Date().toISOString(), ids.leadId);
        const after = await listFollowups();
        eq(after.due.some((f) => f.id === ids.followupId), false, "still due after the reply");
        truthy(after.paused.some((f) => f.id === ids.followupId), "moved to paused");
      });

      await check("auto-send stands down when no transport is configured", async () => {
        const { sendDueFollowups } = await app("src/lib/outreach/autoSend.ts");
        const r = await sendDueFollowups();
        eq(r.ran, false, "ran");
        eq(r.sent, 0, "sent");
      });
    },
  },

  // The same national number becomes sendable once the market's dialing code is
  // configured — the setting most likely to be missed on a fresh deployment.
  "sms-country-code": {
    title: "SMS national-number normalization (SMS_DEFAULT_COUNTRY_CODE)",
    env: { SMS_DEFAULT_COUNTRY_CODE: "+386" },
    async run(db) {
      const { deliverOutreach } = await app("src/lib/outreach/send.ts");
      const { toE164 } = await app("src/lib/outreach/sms.ts");

      await check("Google-shaped numbers all normalize to E.164", async () => {
        eq(toE164("064 194 936"), "+38664194936", "national with trunk 0");
        eq(toE164("(01) 234-5678"), "+38612345678", "punctuated national");
        eq(toE164("+386 64 194 936"), "+38664194936", "already international");
        eq(toE164("0038664194936"), "+38664194936", "00 international prefix");
        eq(toE164("386 64 194 936"), "+38664194936", "country code, no plus");
        eq(toE164("not a phone"), null, "junk stays null");
      });

      await check("a national number now produces a dialable sms: link", async () => {
        const ids = seedLead(db, "sms-cc", { channel: "sms", phone: "064 194 936" });
        const r = await deliverOutreach(ids.outreachId);
        eq(r.ok, true, "ok");
        contains(r.composeUrl, "sms:+38664194936", "link");
        assertRecordedSent(db, ids, "sms-cc");
      });
    },
  },

  // The real SMTP code path — nodemailer, the attachment, the headers — against a
  // server that hands the transmitted message back for inspection.
  smtp: {
    title: "Email delivered over SMTP (throwaway server)",
    async run(db) {
      const smtp = await startFakeSmtp();
      const preview = makePreviewImage();
      process.env.SMTP_HOST = "127.0.0.1";
      process.env.SMTP_PORT = String(smtp.port);
      process.env.SMTP_SECURE = "off";
      process.env.SMTP_USER = "selftest@example.com";
      process.env.SMTP_PASS = "selftest";
      process.env.SMTP_FROM = "Selftest Owner <selftest@example.com>";
      process.env.OUTREACH_OWNER_EMAIL = "replies@example.com";

      try {
        const { deliverOutreach } = await app("src/lib/outreach/send.ts");
        const { isSmtpConfigured } = await app("src/lib/outreach/mailer.ts");

        await check("SMTP counts as configured", () => eq(isSmtpConfigured(), true, "isSmtpConfigured"));

        await check("email is delivered and reported as a real send", async () => {
          const ids = seedLead(db, "smtp", {
            channel: "email",
            email: "prospect@example.com",
            previewImagePath: preview.webPath,
          });
          const r = await deliverOutreach(ids.outreachId);
          eq(r.ok, true, `ok (${r.error ?? ""})`);
          eq(r.method, "smtp", "method");
          contains(r.note, "prospect@example.com", "note names the recipient");
          assertRecordedSent(db, ids, "smtp");
        });

        await check("the transmitted message carries subject, body, reply-to and preview", () => {
          eq(smtp.received.length, 1, "messages received");
          const wire = smtp.received[0];
          contains(wire, "To: prospect@example.com", "To header");
          contains(wire, "selftest@example.com", "From header");
          contains(wire, "Reply-To: replies@example.com", "Reply-To header");
          contains(wire, "A mockup of your new site", "subject");
          contains(wire, "Selftest Owner", "owner name substituted in body");
          absent(wire, "[Your name]", "placeholder left in body");
          contains(wire, "website-preview.png", "preview attached");
        });
      } finally {
        smtp.close();
        preview.dispose();
      }
    },
  },

  // A dead mail server must surface as an error the operator can retry, not as a
  // lead quietly marked "sent".
  "smtp-down": {
    title: "SMTP failure is reported, not swallowed",
    async run(db) {
      // Port 1 is reserved and never listening: a guaranteed connection refusal.
      process.env.SMTP_HOST = "127.0.0.1";
      process.env.SMTP_PORT = "1";
      process.env.SMTP_SECURE = "off";
      process.env.SMTP_USER = "selftest@example.com";
      process.env.SMTP_PASS = "selftest";
      process.env.SMTP_FROM = "selftest@example.com";

      const { deliverOutreach } = await app("src/lib/outreach/send.ts");
      await check("unreachable SMTP → error surfaced, lead untouched", async () => {
        const ids = seedLead(db, "smtp-down", { channel: "email", email: "prospect@example.com" });
        const r = await deliverOutreach(ids.outreachId);
        eq(r.ok, false, "ok");
        eq(r.method, "smtp", "method");
        truthy(r.error, "error message");
        assertNotRecorded(db, ids, "smtp-down");
      });
    },
  },

  // What Twilio would actually receive, asserted at the HTTP boundary.
  twilio: {
    title: "SMS delivered through Twilio (stubbed API)",
    async run(db) {
      process.env.TWILIO_ACCOUNT_SID = "ACselftest";
      process.env.TWILIO_AUTH_TOKEN = "selftest-token";
      process.env.TWILIO_FROM = "+38612345678";
      process.env.SMS_DEFAULT_COUNTRY_CODE = "+386";

      const calls = stubTwilio({ status: 201, body: { sid: "SMselftest" } });
      const { deliverOutreach } = await app("src/lib/outreach/send.ts");
      const { isSmsConfigured } = await app("src/lib/outreach/sms.ts");

      await check("Twilio counts as configured", () => eq(isSmsConfigured(), true, "isSmsConfigured"));

      await check("a text is sent and reported as a real send", async () => {
        const ids = seedLead(db, "twilio", { channel: "sms", phone: "064 194 936" });
        const r = await deliverOutreach(ids.outreachId);
        eq(r.ok, true, `ok (${r.error ?? ""})`);
        eq(r.method, "sms", "method");
        assertRecordedSent(db, ids, "twilio");
      });

      await check("the Twilio request is correctly formed", () => {
        eq(calls.length, 1, "api calls");
        const c = calls[0];
        contains(c.url, "/Accounts/ACselftest/Messages.json", "endpoint");
        contains(c.headers.Authorization, "Basic ", "basic auth");
        eq(
          Buffer.from(c.headers.Authorization.slice(6), "base64").toString(),
          "ACselftest:selftest-token",
          "credentials",
        );
        eq(c.form.get("To"), "+38664194936", "To normalized to E.164");
        eq(c.form.get("From"), "+38612345678", "From");
        contains(c.form.get("Body"), "Selftest Owner", "owner name substituted");
        absent(c.form.get("Body"), "[Your name]", "placeholder left in body");
      });

    },
  },

  // At volume the sender is a Messaging Service, not a single number. Picking the
  // wrong one still "sends" — from the wrong sender, or from a number the account
  // doesn't own — so which field goes on the request is worth pinning down.
  "twilio-messaging-service": {
    title: "SMS via a Twilio Messaging Service (stubbed API)",
    env: {
      TWILIO_ACCOUNT_SID: "ACselftest",
      TWILIO_AUTH_TOKEN: "selftest-token",
      TWILIO_FROM: "+38612345678",
      TWILIO_MESSAGING_SERVICE_SID: "MGselftest",
      SMS_DEFAULT_COUNTRY_CODE: "+386",
    },
    async run(db) {
      const calls = stubTwilio({ status: 201, body: { sid: "SMselftest" } });
      const { deliverOutreach } = await app("src/lib/outreach/send.ts");

      await check("the Messaging Service is used instead of the From number", async () => {
        const ids = seedLead(db, "twilio-mg", { channel: "sms", phone: "064 194 936" });
        const r = await deliverOutreach(ids.outreachId);
        eq(r.ok, true, `ok (${r.error ?? ""})`);
        eq(calls.length, 1, "api calls");
        eq(calls[0].form.get("MessagingServiceSid"), "MGselftest", "MessagingServiceSid");
        eq(calls[0].form.get("From"), null, "From must be omitted");
        assertRecordedSent(db, ids, "twilio-mg");
      });
    },
  },

  // Twilio rejects plenty of real sends (unverified trial numbers, landlines).
  // Its message is the useful one, and the lead must stay unsent.
  "twilio-error": {
    title: "Twilio rejection is reported, not swallowed",
    async run(db) {
      process.env.TWILIO_ACCOUNT_SID = "ACselftest";
      process.env.TWILIO_AUTH_TOKEN = "selftest-token";
      process.env.TWILIO_FROM = "+38612345678";
      process.env.SMS_DEFAULT_COUNTRY_CODE = "+386";

      stubTwilio({
        status: 400,
        body: { message: "The 'To' number is not a valid mobile number", code: 21614 },
      });
      const { deliverOutreach } = await app("src/lib/outreach/send.ts");

      await check("rejection → Twilio's own reason, lead untouched", async () => {
        const ids = seedLead(db, "twilio-error", { channel: "sms", phone: "064 194 936" });
        const r = await deliverOutreach(ids.outreachId);
        eq(r.ok, false, "ok");
        contains(r.error, "not a valid mobile number", "Twilio's message");
        contains(r.error, "21614", "Twilio's error code");
        assertNotRecorded(db, ids, "twilio-error");
      });
    },
  },

  // Hands-off follow-ups: the one place the app sends without a human present.
  autosend: {
    title: "Automatic follow-up sending",
    async run(db) {
      const smtp = await startFakeSmtp();
      process.env.SMTP_HOST = "127.0.0.1";
      process.env.SMTP_PORT = String(smtp.port);
      process.env.SMTP_SECURE = "off";
      process.env.SMTP_USER = "selftest@example.com";
      process.env.SMTP_PASS = "selftest";
      process.env.SMTP_FROM = "selftest@example.com";

      try {
        const { sendDueFollowups } = await app("src/lib/outreach/autoSend.ts");
        const due = new Date(Date.now() - 3600_000).toISOString();

        const emailIds = seedLead(db, "auto-email", { channel: "email", email: "prospect@example.com" });
        const dmIds = seedLead(db, "auto-dm", { channel: "facebook", contact: "https://m.me/selftest" });
        const engagedIds = seedLead(db, "auto-engaged", { channel: "email", email: "engaged@example.com" });
        db.prepare(`update Outreach set scheduledAt = ? where id in (?, ?, ?)`).run(
          due, emailIds.followupId, dmIds.followupId, engagedIds.followupId,
        );
        db.prepare(`update Lead set interestedAt = ? where id = ?`).run(new Date().toISOString(), engagedIds.leadId);

        await check("a due email follow-up is delivered unattended", async () => {
          const r = await sendDueFollowups();
          eq(r.ran, true, "ran");
          eq(r.sent, 1, `sent (errors: ${r.errors.join("; ") || "none"})`);
          eq(smtp.received.length, 1, "messages transmitted");
          contains(smtp.received[0], "prospect@example.com", "recipient");
        });

        await check("a due DM follow-up is left for the manual queue", () => {
          const row = db.prepare(`select status from Outreach where id = ?`).get(dmIds.followupId);
          eq(row.status, "queued", "DM follow-up status");
        });

        await check("a prospect who raised their hand is never auto-nudged", () => {
          const row = db.prepare(`select status from Outreach where id = ?`).get(engagedIds.followupId);
          eq(row.status, "queued", "engaged lead's follow-up status");
        });
      } finally {
        smtp.close();
      }
    },
  },
};

// ─────────────────────────────────────────────────────── credential preflight ─
// The one thing a mock can never tell you: whether the real credentials work.
// No message is sent — it's a handshake with each provider.

/**
 * Stray whitespace inside the quotes in .env.local. None of these values can
 * legitimately carry it, and the failures it causes name the wrong culprit — a
 * space in SMTP_HOST surfaces as "ENOTFOUND", which reads like a network problem,
 * and one in a password reads like a wrong password.
 */
function configHygiene() {
  const suspect = [
    "SMTP_HOST", "SMTP_USER", "SMTP_PASS", "SMTP_FROM",
    "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM", "TWILIO_MESSAGING_SERVICE_SID",
    "ANTHROPIC_API_KEY", "GOOGLE_PLACES_API_KEY", "STRIPE_SECRET_KEY",
  ];
  const dirty = suspect.filter((k) => {
    const v = process.env[k];
    return v && v !== v.trim();
  });
  if (dirty.length === 0) return;

  console.log("Stray whitespace in .env.local\n");
  for (const key of dirty) {
    console.log(`  ! ${key} has leading or trailing whitespace inside its quotes`);
  }
  console.log(
    "\n  Remove it — dotenv keeps everything inside the quotes. A Google app password\n" +
      "  is 16 characters with no spaces; the grouping shown on screen is cosmetic.\n",
  );
}

async function preflight() {
  configHygiene();
  const { env } = await app("src/lib/env.ts");
  const { isSmtpConfigured, verifySmtp } = await app("src/lib/outreach/mailer.ts");
  const { isSmsConfigured, verifyTwilio } = await app("src/lib/outreach/sms.ts");

  const rows = [];
  const push = (channel, mode, detail) => rows.push({ channel, mode, detail });

  if (isSmtpConfigured()) {
    const v = await verifySmtp();
    push("email", v.ok ? "automatic" : "BROKEN", v.ok ? `${env.smtpHost}:${env.smtpPort} as ${env.smtpUser}` : v.error);
  } else {
    push("email", "assisted", "no SMTP — send opens a prefilled Gmail compose tab");
  }

  if (isSmsConfigured()) {
    const v = await verifyTwilio();
    push("sms", v.ok ? "automatic" : "BROKEN", v.ok ? v.detail : v.error);
  } else {
    push(
      "sms",
      "assisted",
      env.smsDefaultCountryCode
        ? "no Twilio — send opens your own messaging app"
        : "no Twilio, and no SMS_DEFAULT_COUNTRY_CODE (national numbers will be refused)",
    );
  }

  push("facebook / instagram", "assisted", "no cold-DM API exists — thread opens, you paste and send");
  push("phone", "assisted", "dialer opens with the script; the call is yours");
  push("whatsapp", "refused", "cold messaging breaches WhatsApp Business policy");
  push(
    "owner identity",
    env.ownerName ? "ok" : "MISSING",
    env.ownerName ? env.ownerName : 'OUTREACH_OWNER_NAME unset — messages will ship with a literal "[Your name]"',
  );

  console.log("Channel readiness\n");
  const w = Math.max(...rows.map((r) => r.channel.length));
  for (const r of rows) {
    const tag = r.mode === "BROKEN" || r.mode === "MISSING" ? `✗ ${r.mode}` : `· ${r.mode}`;
    console.log(`  ${r.channel.padEnd(w)}  ${tag.padEnd(12)} ${r.detail}`);
  }
  console.log();

  // The From domain is what receivers judge, so that's what gets looked up —
  // falling back to the owner address (and --dns) so the domain can be checked
  // before its mailbox exists.
  const fromAddress = arg("--dns") || env.smtpFrom || env.ownerEmail;
  if (fromAddress) await deliverability(fromAddress, env.smtpUser);

  return rows.every((r) => r.mode !== "BROKEN" && r.mode !== "MISSING");
}

/**
 * Report the DNS records that decide whether cold email is trusted. Advisory: a
 * missing SPF record doesn't make the app broken, so it warns rather than failing
 * the run — but it is the difference between "sent" and "read".
 */
async function deliverability(fromAddress, authAddress) {
  const { checkDeliverability, domainOf } = await app("src/lib/outreach/deliverability.ts");
  const domain = domainOf(fromAddress);
  if (!domain) return;

  console.log(`Email deliverability for ${domain}\n`);
  const report = await checkDeliverability(fromAddress, authAddress || undefined, process.env.DKIM_SELECTOR);

  const checks = [
    ["SPF", report.spf],
    ["DKIM", report.dkim],
    ["DMARC", report.dmarc],
    ["MX (replies)", report.mx],
    ...(report.alignment ? [["From alignment", report.alignment]] : []),
  ];
  let warnings = 0;
  for (const [name, finding] of checks) {
    const mark = finding.ok ? "✓" : finding.unknown ? "?" : "!";
    if (!finding.ok && !finding.unknown) warnings += 1;
    console.log(`  ${mark} ${name.padEnd(14)} ${finding.detail}`);
  }
  console.log(
    warnings === 0
      ? "\n  Nothing blocking — cold mail from this domain should be authenticated.\n"
      : `\n  ${warnings} thing${warnings === 1 ? "" : "s"} to fix at your DNS host before sending cold email at any volume.\n` +
        "  These don't stop a send; they decide whether it lands in the inbox or in spam.\n",
  );
}

// ───────────────────────────────────────────────────────────── live sending ───
// Opt-in. Real credentials, real network, real message — addressed to you.

async function live() {
  const db = makeTestDb("live");
  const database = new Database(db.file);
  process.env.DATABASE_URL = `file:${db.file}`;
  try {
    const { env } = await app("src/lib/env.ts");
    const { deliverOutreach } = await app("src/lib/outreach/send.ts");
    const { isSmtpConfigured } = await app("src/lib/outreach/mailer.ts");
    const { isSmsConfigured } = await app("src/lib/outreach/sms.ts");

    const to = process.env.OUTREACH_TEST_EMAIL || env.ownerEmail;
    const num = process.env.OUTREACH_TEST_PHONE || env.ownerPhone;
    const stamp = new Date().toISOString();

    if (isSmtpConfigured() && to) {
      await check(`live email → ${to}`, async () => {
        const ids = seedLead(database, "live-email", {
          channel: "email",
          email: to,
          subject: `Outreach self-test ${stamp}`,
          body: `This is the outreach self-test sending through your real SMTP credentials.\n\n[Your name]`,
        });
        const r = await deliverOutreach(ids.outreachId);
        eq(r.ok, true, `send (${r.error ?? ""})`);
        eq(r.method, "smtp", "method");
      });
    } else {
      record({ ok: true, name: "live email skipped (no SMTP configured, or no test address)", skipped: true });
    }

    if (isSmsConfigured() && num) {
      await check(`live SMS → ${num}`, async () => {
        const ids = seedLead(database, "live-sms", {
          channel: "sms",
          phone: num,
          body: `Outreach self-test ${stamp}. [Your name]`,
        });
        const r = await deliverOutreach(ids.outreachId);
        eq(r.ok, true, `send (${r.error ?? ""})`);
        eq(r.method, "sms", "method");
      });
    } else {
      record({ ok: true, name: "live SMS skipped (no Twilio configured, or no test number)", skipped: true });
    }
  } finally {
    database.close();
    db.dispose();
  }
}

// ────────────────────────────────────────────────────────── assisted links ────
// Assisted channels have no delivery to assert, so the honest test is a human
// one: click each link once and confirm the right thing opens.

async function printLinks() {
  const { gmailComposeUrl } = await app("src/lib/outreach/mailer.ts");
  const { smsComposeUrl } = await app("src/lib/outreach/sms.ts");
  const body = "Sample outreach body — this text should arrive prefilled.";
  console.log("Assisted deep links — open each once and confirm what appears:\n");
  console.log(`  email     ${gmailComposeUrl("you@example.com", "Self-test", body)}\n`);
  console.log(`  sms       ${smsComposeUrl(process.env.OUTREACH_OWNER_PHONE || "+38664194936", body)}\n`);
  console.log(`  phone     tel:${(process.env.OUTREACH_OWNER_PHONE || "+38664194936").replace(/[^\d+]/g, "")}\n`);
  console.log("  facebook  <the m.me/... link stored on the lead — opens Messenger>");
  console.log("  instagram <the ig.me/m/... link stored on the lead — opens Instagram>\n");
  console.log("  Both DM links are whatever you pasted into the lead's contact field; the app\n" +
    "  opens them untouched and puts the message on your clipboard.\n");
}

// ────────────────────────────────────────────────────────────────── runner ────

/** Child mode: run exactly one case against its own database, stream results. */
async function runChildCase(name) {
  const c = cases[name];
  const database = new Database(process.env.SELFTEST_DB);
  try {
    await c.run(database);
  } catch (err) {
    record({ ok: false, name: `${name} crashed`, detail: err.stack?.split("\n").slice(0, 3).join(" | ") ?? String(err) });
  } finally {
    database.close();
    const { prisma } = await app("src/lib/prisma.ts");
    await prisma.$disconnect();
  }
}

/** Parent mode: spawn one child per case and collect its results. */
function spawnCase(name) {
  const c = cases[name];
  const db = makeTestDb(name);

  // The environment this case must see, whatever is in .env.local. A clean slate
  // by default — each case opts INTO the transports it wants configured.
  const overrides = {
    SMTP_HOST: "", SMTP_PORT: "465", SMTP_SECURE: "on", SMTP_USER: "", SMTP_PASS: "", SMTP_FROM: "",
    TWILIO_ACCOUNT_SID: "", TWILIO_AUTH_TOKEN: "", TWILIO_FROM: "",
    TWILIO_MESSAGING_SERVICE_SID: "", SMS_DEFAULT_COUNTRY_CODE: "",
    AUTO_SEND_FOLLOWUPS: "off",
    FOLLOWUP_INTERVAL_DAYS: "3",
    // Pinned so assertions about "[Your name]" being substituted have a known
    // value. The preflight is what reports the real one.
    OUTREACH_OWNER_NAME: "Selftest Owner",
    OUTREACH_OWNER_EMAIL: "",
    DATABASE_URL: `file:${db.file}`,
    ...(c.env ?? {}),
  };

  return new Promise((resolve) => {
    const child = spawn(process.execPath, [...NODE_FLAGS, import.meta.filename], {
      cwd: ROOT,
      env: {
        ...process.env,
        ...overrides,
        SELFTEST_DB: db.file,
        SELFTEST_CASE: name,
        SELFTEST_ENV: JSON.stringify(overrides),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    const collected = [];
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => {
      stdout += d;
      let i;
      while ((i = stdout.indexOf("\n")) >= 0) {
        const line = stdout.slice(0, i);
        stdout = stdout.slice(i + 1);
        if (line.startsWith(RESULT_PREFIX)) collected.push(JSON.parse(line.slice(RESULT_PREFIX.length)));
        else if (line.trim()) stderr += line + "\n";
      }
    });
    child.stderr.on("data", (d) => (stderr += d));
    child.on("close", (code) => {
      db.dispose();
      if (code !== 0 && !collected.some((r) => !r.ok)) {
        collected.push({ ok: false, name: `${name} exited ${code}`, detail: stderr.trim().split("\n").slice(-4).join(" | ") });
      }
      resolve(collected);
    });
  });
}

const FLAGS = ["--live", "--links", "--case", "--dns"];

async function main() {
  if (process.env.SELFTEST_CASE) return runChildCase(process.env.SELFTEST_CASE);

  // A mistyped flag must not be silently ignored: "--liv" would otherwise run the
  // offline suite and look like a successful live send that sent nothing.
  const unknown = argv.filter((a) => a.startsWith("-") && !FLAGS.includes(a));
  if (unknown.length) {
    console.error(`Unknown flag: ${unknown.join(", ")}\nKnown flags: ${FLAGS.join(", ")}`);
    process.exitCode = 1;
    return;
  }

  if (has("--links")) return printLinks();

  console.log("\nOutreach self-test\n══════════════════\n");
  const configOk = await preflight();

  const only = arg("--case");
  const names = only ? only.split(",") : Object.keys(cases);
  for (const name of names) {
    if (!cases[name]) {
      console.error(`Unknown case "${name}". Known: ${Object.keys(cases).join(", ")}`);
      process.exitCode = 1;
      return;
    }
  }

  let passed = 0;
  let failed = 0;
  for (const name of names) {
    console.log(`${cases[name].title}`);
    for (const r of await spawnCase(name)) {
      console.log(`  ${r.ok ? "✓" : "✗"} ${r.name}${r.ok ? "" : `\n      ${r.detail}`}`);
      if (r.ok) passed += 1;
      else failed += 1;
    }
    console.log();
  }

  if (has("--live")) {
    console.log("Live send (real credentials, real recipients)");
    await live();
    for (const r of results) {
      console.log(`  ${r.skipped ? "–" : r.ok ? "✓" : "✗"} ${r.name}${r.ok ? "" : `\n      ${r.detail}`}`);
      if (r.ok) passed += 1;
      else failed += 1;
    }
    console.log();
  }

  console.log(`${failed === 0 ? "✓" : "✗"} ${passed} passed, ${failed} failed`);
  if (!has("--live")) {
    console.log("  Automatic channels were tested against stand-in servers; add --live to prove the real credentials.");
  }
  if (!configOk) console.log("  Credential preflight reported a problem — see the readiness table above.");
  process.exitCode = failed === 0 && configOk ? 0 : 1;
}

await main();
