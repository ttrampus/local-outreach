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

async function pushNtfy(lead: InterestNotice, url: string): Promise<void> {
  const contact = [lead.phone, lead.email].filter(Boolean).join(" · ");
  await fetch(`${env.ntfyServer.replace(/\/+$/, "")}/${encodeURIComponent(env.ntfyTopic)}`, {
    method: "POST",
    headers: {
      Title: `${lead.name} is interested`,
      Priority: "high",
      Tags: "tada",
      // Tapping the notification opens the lead, which is the next thing the
      // operator wants to do anyway.
      Click: url,
    },
    body: contact ? `Get in touch now — ${contact}` : "Get in touch now.",
  });
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

  if (env.ntfyTopic) jobs.push(pushNtfy(lead, url));

  const results = await Promise.allSettled(jobs);
  for (const r of results) {
    if (r.status === "rejected") {
      console.warn(`[notify] interest notification failed for ${lead.leadId}:`, r.reason);
    }
  }
}
