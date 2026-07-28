// Hands-off follow-up delivery. The follow-up engine (./followups) already
// decides WHAT is safe to send — due + prospect hasn't engaged; this module makes
// the sending itself automatic for the one channel that can be delivered without
// a human (email over SMTP). DM/phone follow-ups always stay in the manual queue:
// there is no legitimate API for cold Facebook/Instagram DMs.
//
// Two entry points:
//   - sendDueFollowups(): one pass over the due queue. Called by the timer AND by
//     POST /api/followups/auto (the "send all due now" button/endpoint).
//   - startFollowupAutomation(): boots the recurring timer from instrumentation.ts
//     when AUTO_SEND_FOLLOWUPS=on and SMTP is configured.
//
// Initial (step-0) messages are deliberately NOT auto-sent — the operator approves
// and sends the first touch; only the already-approved sequence runs hands-off.
import { env } from "@/lib/env";
import { listFollowups } from "./followups";
import { deliverOutreach } from "./send";
import { isSmtpConfigured } from "./mailer";

export interface AutoSendResult {
  ran: boolean; // false = SMTP missing, nothing was attempted
  sent: number;
  skippedNonEmail: number; // DM/phone follow-ups left for the manual queue
  errors: string[];
}

/** One pass: deliver every due email follow-up. Never marks a non-delivery sent. */
export async function sendDueFollowups(): Promise<AutoSendResult> {
  const result: AutoSendResult = { ran: false, sent: 0, skippedNonEmail: 0, errors: [] };
  if (!isSmtpConfigured()) return result; // without SMTP, "sending" would just be bookkeeping
  result.ran = true;

  const { due } = await listFollowups(); // already gated on engagement + schedule
  for (const f of due) {
    if (f.channel !== "email" || !f.contact) {
      result.skippedNonEmail += 1;
      continue;
    }
    const r = await deliverOutreach(f.id);
    if (r.ok) result.sent += 1;
    else result.errors.push(`${f.leadName} (step ${f.step}): ${r.error ?? "send failed"}`);
  }
  return result;
}

const globalTimer = globalThis as unknown as { __followupAutoSendTimer?: NodeJS.Timeout };

/** Start the recurring auto-send loop (no-op unless enabled + SMTP configured). */
export function startFollowupAutomation(): void {
  if (!env.autoSendFollowups) return;
  if (!isSmtpConfigured()) {
    console.warn("[autoSend] AUTO_SEND_FOLLOWUPS=on but SMTP is not configured — idle.");
    return;
  }
  if (globalTimer.__followupAutoSendTimer) return; // dev hot-reload guard

  const run = async () => {
    try {
      const r = await sendDueFollowups();
      if (r.sent || r.errors.length) {
        console.log(
          `[autoSend] sent ${r.sent} follow-up(s)` +
            (r.errors.length ? `, ${r.errors.length} failed: ${r.errors.join("; ")}` : ""),
        );
      }
    } catch (err) {
      console.error("[autoSend] pass failed:", err);
    }
  };

  globalTimer.__followupAutoSendTimer = setInterval(run, env.autoSendIntervalMin * 60_000);
  setTimeout(run, 15_000); // first pass shortly after boot, off the startup path
  console.log(`[autoSend] follow-up automation on — every ${env.autoSendIntervalMin}min.`);
}
