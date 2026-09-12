// Send the real outreach email for a real lead to YOUR inbox, to see exactly what
// a prospect gets — the drafter, the signature, the preview link, the opt-out.
//
//   node scripts/send-test-email.mjs [to-address] [leadId]
//
// It mirrors the email branch of deliverOutreach() but touches no database rows:
// nothing is marked sent, no follow-up is queued, and the lead is left alone. The
// links point at APP_BASE_URL forced to the live site, because a localhost link in
// a mail client is not a test of anything.
import path from "node:path";
import Database from "better-sqlite3";
import { config as loadEnv } from "dotenv";
import { ROOT, app } from "./lib/app-imports.mjs";

loadEnv({ path: path.join(ROOT, ".env"), quiet: true });
loadEnv({ path: path.join(ROOT, ".env.local"), override: true, quiet: true });
// The links in the message have to be the ones a prospect would get, not localhost.
process.env.APP_BASE_URL = "https://avenyo.app";

const TO = process.argv[2] ?? "tim.trampus0@gmail.com";
const LEAD_ID = process.argv[3] ?? "cmrxemds20037mccm5p36stzu";

const db = new Database(path.join(ROOT, "dev.db"), { readonly: true });
const row = db.prepare("select * from Lead where id = ?").get(LEAD_ID);
const cache = db.prepare("select raw from PlaceCache where placeId = ?").get(row.placeId);
const raw = cache ? JSON.parse(cache.raw) : {};

// The lead as the drafters see it, with the test address standing in for an email
// the real lead doesn't have — otherwise the channel picker would choose phone.
const lead = { ...row, email: TO, deployedUrl: row.deployedUrl ?? null };
const details = {
  placeId: row.placeId,
  name: row.name,
  address: row.address ?? undefined,
  phone: row.phone ?? undefined,
  rating: row.rating ?? undefined,
  reviewCount: row.reviewCount,
  photoCount: row.photoCount,
  reviewSnippets: raw.reviewSnippets ?? [],
  categories: raw.categories ?? [],
};

const { buildDraft } = await app("src/lib/outreach/draft.ts");
const { sendMail, isSmtpConfigured } = await app("src/lib/outreach/mailer.ts");
const { toHtmlEmail, toPlainTextEmail } = await app("src/lib/outreach/htmlBody.ts");
const { getEmailStrings } = await app("src/lib/outreach/emailStrings.ts");
const { unsubscribeUrl } = await app("src/lib/outreach/unsubscribeToken.ts");
const { detectLocale } = await app("src/lib/preview/i18n.ts");
const { env } = await app("src/lib/env.ts");

if (!isSmtpConfigured()) throw new Error("SMTP is not configured — nothing sent.");

const previewUrl = `${env.appBaseUrl}/p/${lead.id}`;
const draft = buildDraft(lead, details, { previewUrl, siteUrl: env.appBaseUrl });
console.log(`categories: ${details.categories.join(", ") || "(none cached)"}`);

const m = draft.messages[0];
// The same name substitution deliverOutreach does.
const rich = m.body.split("[Your name]").join(env.ownerName || "[Your name]");
const text = toPlainTextEmail(rich);
const optOut = unsubscribeUrl(lead.id, env.appBaseUrl);
const strings = getEmailStrings(detectLocale({ address: lead.address ?? undefined }));

console.log(`\nSUBJECT: ${m.subject}\n\n${text}\n\n—\n${strings.optOut}\n${optOut}\n`);

await sendMail({
  to: TO,
  subject: m.subject,
  text: `${text}\n\n—\n${strings.optOut}\n${optOut}`,
  html: toHtmlEmail(rich, {
    linkUrl: previewUrl,
    linkLabel: strings.previewLink,
    optOutUrl: optOut,
    optOutLabel: strings.optOut,
  }),
  unsubscribeUrl: optOut,
});
console.log(`Sent from ${env.smtpFrom} to ${TO}.`);
