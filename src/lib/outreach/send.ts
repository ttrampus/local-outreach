// One place that actually "sends" an outreach message — used by both the initial
// send (PATCH /api/outreach/:leadId { action: "send" }) and the follow-up engine.
// When SMTP is configured it really delivers the email (preview image attached);
// otherwise it records the send and hands back a Gmail compose deep-link so the
// operator can send by hand. Either way it advances the funnel and schedules the
// next follow-up — so the sequence keeps moving without anything auto-sending that
// the operator didn't explicitly trigger.
import "server-only";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { isSmtpConfigured, sendMail, gmailComposeUrl } from "./mailer";
import { scheduleNextFollowup } from "./followups";

export interface DeliverResult {
  ok: boolean;
  method: "smtp" | "manual";
  composeUrl?: string | null; // present for the manual path
  error?: string;
}

// Funnel stages strictly before "sent" — bump to "sent" only from one of these so a
// follow-up never drags an already-advanced lead backwards.
const PRE_SENT = new Set(["discovered", "preview_ready", "drafted", "approved"]);

/** Fill the literal "[Your name]" placeholder with the configured owner name. */
function personalize(body: string): string {
  return env.ownerName ? body.split("[Your name]").join(env.ownerName) : body;
}

/**
 * Deliver one outreach record (initial or follow-up), mark it sent, advance the
 * lead, and schedule the next follow-up. A failed SMTP attempt is NOT marked sent —
 * it returns an error so the operator can retry.
 */
export async function deliverOutreach(outreachId: string): Promise<DeliverResult> {
  const o = await prisma.outreach.findUnique({
    where: { id: outreachId },
    include: { lead: { select: { id: true, email: true, status: true, previewImagePath: true } } },
  });
  if (!o) return { ok: false, method: "manual", error: "Outreach record not found." };

  const to = o.channel === "email" ? o.contact || o.lead.email : null;
  const subject = o.subject ?? "";
  const body = personalize(o.body);

  let method: "smtp" | "manual" = "manual";
  let composeUrl: string | null = null;

  if (to && isSmtpConfigured()) {
    try {
      await sendMail({ to, subject, text: body, previewImagePath: o.lead.previewImagePath });
      method = "smtp";
    } catch (err) {
      // Don't record a send that didn't happen — let the operator retry.
      return { ok: false, method: "smtp", error: (err as Error).message.slice(0, 200) };
    }
  } else if (to) {
    composeUrl = gmailComposeUrl(to, subject, body);
  } else if ((o.channel === "facebook" || o.channel === "instagram") && o.contact) {
    // Social DM: the contact IS the message thread deep-link (m.me / ig.me). There
    // is no legitimate API to auto-send cold DMs, so the operator clicks through
    // and pastes the drafted message; the app records the send like any other.
    composeUrl = o.contact;
  }

  await prisma.outreach.update({
    where: { id: o.id },
    data: { status: "sent", sentAt: new Date() },
  });
  if (PRE_SENT.has(o.lead.status)) {
    await prisma.lead.update({ where: { id: o.lead.id }, data: { status: "sent" } });
  }
  // Queue up the next message in the sequence (no-op if this was the last one).
  await scheduleNextFollowup(o.lead.id);

  return { ok: true, method, composeUrl };
}
