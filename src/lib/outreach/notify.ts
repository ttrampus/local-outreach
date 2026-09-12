// "Someone just pressed I'm interested."
//
// This is the only event in the whole funnel that is time-critical. Everything
// else can wait for the operator to open the console; a prospect who has just
// looked at their own site and raised their hand is warm for about an hour, and
// the difference between replying then and replying tomorrow morning is most of
// the sale. So it has to reach a phone, not a dashboard.
//
// Two transports, both best-effort, neither allowed to fail the request that
// triggered them — the prospect's click has already been recorded by the time
// this runs, and a bounced notification must never turn that into an error.
//
//   EMAIL   — always, when SMTP is configured. Zero setup: it lands in the same
//             inbox the operator already has on their phone.
//   NTFY    — optional, when NOTIFY_NTFY_TOPIC is set. A real push notification
//             with a sound, which an email is not. ntfy.sh needs no account: the
//             topic name IS the address, which is also the caveat — anyone who
//             guesses it can read the notifications, so it must be long and
//             random, and it means a business name leaves our servers. Point
//             NOTIFY_NTFY_SERVER at a self-hosted instance to avoid that.
import "server-only";
import { env } from "@/lib/env";
import { isSmtpConfigured, sendMail } from "./mailer";

export interface InterestNotice {
  leadId: string;
  name: string;
  phone: string | null;
  email: string | null;
}

/**
 * One ntfy push. Headers only carry latin-1, and a Slovene business name is full
 * of č/š/ž, so the title is transliterated rather than left to throw inside
 * fetch's header validation — a mangled title still beats no notification.
 */
async function pushNtfy(opts: {
  title: string;
  body: string;
  url: string;
  tags: string;
}): Promise<void> {
  await fetch(`${env.ntfyServer.replace(/\/+$/, "")}/${encodeURIComponent(env.ntfyTopic)}`, {
    method: "POST",
    headers: {
      Title: asciiHeader(opts.title),
      Priority: "high",
      Tags: opts.tags,
      // Tapping the notification opens the lead, which is the next thing the
      // operator wants to do anyway.
      Click: opts.url,
    },
    // The body is UTF-8 and goes over the wire as bytes, so it keeps its accents.
    body: opts.body,
  });
}

function asciiHeader(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // drop the combining accents NFKD split off
    .replace(/[^\x20-\x7e]/g, "") // then anything still outside printable ASCII
    .trim();
}

/**
 * Tell the operator, on every channel configured. Never throws: each transport is
 * isolated so a dead ntfy server cannot also cost the email.
 */
export async function notifyInterest(lead: InterestNotice): Promise<void> {
  const url = `${env.appBaseUrl}/app?lead=${encodeURIComponent(lead.leadId)}`;
  const contact = [lead.phone, lead.email].filter(Boolean).join("\n");

  const jobs: Promise<unknown>[] = [];

  if (env.ownerEmail && isSmtpConfigured()) {
    jobs.push(
      sendMail({
        to: env.ownerEmail,
        subject: `${lead.name} pressed "I'm interested"`,
        text: [
          `${lead.name} just opened their preview and pressed "I'm interested".`,
          "",
          contact || "(no phone or email on this lead)",
          "",
          "This is the warmest a lead ever gets. Reply today.",
          url,
        ].join("\n"),
      }),
    );
  }

  if (env.ntfyTopic) {
    jobs.push(
      pushNtfy({
        title: `${lead.name} is interested`,
        body: contact ? `Get in touch now — ${contact.replace(/\n/g, " · ")}` : "Get in touch now.",
        url,
        tags: "tada",
      }),
    );
  }

  await settle(jobs, `interest notification for ${lead.leadId}`);
}

export interface EnquiryNotice {
  leadId: string;
  /** The business whose generated site the form sits on. */
  leadName: string;
  name?: string;
  email?: string;
  phone?: string;
  message: string;
}

/**
 * Somebody filled in the contact form on a generated site.
 *
 * Same urgency argument as `notifyInterest`, and for a while this one only sent
 * email — so an enquiry that arrived while the console was closed sat unread with
 * nothing to surface it. Returns whether the email specifically went out, because
 * the caller records that on the SiteMessage row.
 */
export async function notifyEnquiry(enq: EnquiryNotice): Promise<{ emailed: boolean }> {
  const url = `${env.appBaseUrl}/app?lead=${encodeURIComponent(enq.leadId)}`;
  const contact = [enq.name, enq.email, enq.phone].filter(Boolean).join(" · ");

  let emailed = false;
  const jobs: Promise<unknown>[] = [];

  if (env.ownerEmail && isSmtpConfigured()) {
    jobs.push(
      sendMail({
        to: env.ownerEmail,
        subject: `New enquiry from ${enq.leadName}'s website`,
        text: [
          `New message via the contact form on ${enq.leadName}'s site:`,
          "",
          enq.name ? `Name:  ${enq.name}` : "",
          enq.email ? `Email: ${enq.email}` : "",
          enq.phone ? `Phone: ${enq.phone}` : "",
          "",
          enq.message,
          "",
          url,
        ]
          .filter(Boolean)
          .join("\n"),
        // Reply goes to whoever wrote in, not to the server.
        replyTo: enq.email || undefined,
      }).then(() => {
        emailed = true;
      }),
    );
  } else {
    console.error(
      `[notify] enquiry for lead ${enq.leadId} (${enq.leadName}) not emailed — OUTREACH_OWNER_EMAIL or SMTP not configured`,
    );
  }

  if (env.ntfyTopic) {
    jobs.push(
      pushNtfy({
        title: `Enquiry via ${enq.leadName}`,
        // First line of what they actually wrote: enough to judge from the
        // lock screen whether this needs answering now.
        body: [contact, enq.message.split("\n")[0].slice(0, 160)].filter(Boolean).join("\n"),
        url,
        tags: "envelope",
      }),
    );
  }

  await settle(jobs, `enquiry notification for ${enq.leadId}`);
  return { emailed };
}

/** Run every transport, log the ones that failed, never throw. */
async function settle(jobs: Promise<unknown>[], what: string): Promise<void> {
  const results = await Promise.allSettled(jobs);
  for (const r of results) {
    if (r.status === "rejected") console.warn(`[notify] ${what} failed:`, r.reason);
  }
}
