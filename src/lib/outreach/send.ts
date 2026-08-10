// One place that actually "sends" an outreach message — used by both the initial
// send (PATCH /api/outreach/:leadId { action: "send" }) and the follow-up engine.
//
// Two kinds of channel exist here, and the difference matters:
//
//   AUTOMATIC — email over SMTP, SMS over Twilio. One click delivers the message
//     for real. A failure is reported and the record is NOT marked sent, so the
//     operator can fix the cause and retry.
//
//   ASSISTED — a Facebook/Instagram DM, an `sms:`/Gmail compose link, a `tel:`
//     dialer link. The app opens the right thing with the message prefilled and
//     records the send; the final tap is the operator's. Meta has no cold-DM API
//     (automating it violates their ToS and bans the account) and a phone call
//     isn't a message, so these cannot be automated at all.
//
// What must never happen is a third kind: a "send" that quietly marks the record
// sent, advances the funnel and schedules a follow-up while doing nothing. A
// channel with no usable contact is a hard failure — and when the operator really
// did reach out by hand, markSentByHand() is the honest way to record it.
import "server-only";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { isSmtpConfigured, sendMail, gmailComposeUrl } from "./mailer";
import { isSmsConfigured, sendSms, smsComposeUrl, toE164 } from "./sms";
import { scheduleNextFollowup } from "./followups";

export interface DeliverResult {
  ok: boolean;
  /** How it went out. "manual" = the app opened something; you finished it. */
  method: "smtp" | "sms" | "manual";
  /** Deep link the UI should open for an assisted send (compose / thread / dialer). */
  composeUrl?: string | null;
  /**
   * Message text the operator has to paste, for assisted channels that can't carry
   * a body in the link (Messenger and Instagram threads). The UI copies it to the
   * clipboard before opening the thread.
   */
  copyBody?: string | null;
  /** Short human note about what just happened, shown next to the send button. */
  note?: string;
  error?: string;
}

// Funnel stages strictly before "sent" — bump to "sent" only from one of these so a
// follow-up never drags an already-advanced lead backwards.
const PRE_SENT = new Set(["discovered", "preview_ready", "drafted", "approved"]);

/** Fill the literal "[Your name]" placeholder with the configured owner name. */
function personalize(body: string): string {
  return env.ownerName ? body.split("[Your name]").join(env.ownerName) : body;
}

type OutreachWithLead = {
  id: string;
  channel: string;
  contact: string | null;
  subject: string | null;
  body: string;
  lead: { id: string; email: string | null; phone: string | null; status: string; previewImagePath: string | null };
};

async function load(outreachId: string): Promise<OutreachWithLead | null> {
  return prisma.outreach.findUnique({
    where: { id: outreachId },
    include: {
      lead: {
        select: { id: true, email: true, phone: true, status: true, previewImagePath: true },
      },
    },
  });
}

/** Mark one record sent, advance the lead, and queue the next step in the sequence. */
async function recordSent(o: OutreachWithLead): Promise<void> {
  await prisma.outreach.update({
    where: { id: o.id },
    data: { status: "sent", sentAt: new Date() },
  });
  if (PRE_SENT.has(o.lead.status)) {
    await prisma.lead.update({ where: { id: o.lead.id }, data: { status: "sent" } });
  }
  // Queue up the next message in the sequence (no-op if this was the last one).
  await scheduleNextFollowup(o.lead.id);
}

/**
 * The contact this message goes to: whatever is stored on the record, falling back
 * to the lead's own details for the channel. Null when there's nothing to send to.
 */
function resolveContact(o: OutreachWithLead): string | null {
  const stored = o.contact?.trim();
  if (stored) return stored;
  if (o.channel === "email") return o.lead.email;
  if (o.channel === "sms" || o.channel === "phone") return o.lead.phone;
  return null;
}

/**
 * Deliver one outreach record (initial or follow-up), mark it sent, advance the
 * lead, and schedule the next follow-up. Anything that did NOT reach the prospect
 * — a failed SMTP/Twilio call, a channel with no contact, a channel with no
 * delivery path — returns ok:false and leaves the record untouched.
 */
export async function deliverOutreach(outreachId: string): Promise<DeliverResult> {
  const o = await load(outreachId);
  if (!o) return { ok: false, method: "manual", error: "Outreach record not found." };

  const contact = resolveContact(o);
  const subject = o.subject ?? "";
  const body = personalize(o.body);

  let result: DeliverResult;

  switch (o.channel) {
    case "email": {
      if (!contact) {
        return {
          ok: false,
          method: "manual",
          error: "No email address on this lead. Add one, or switch the channel.",
        };
      }
      if (isSmtpConfigured()) {
        try {
          await sendMail({
            to: contact,
            subject,
            text: body,
            previewImagePath: o.lead.previewImagePath,
          });
        } catch (err) {
          // Don't record a send that didn't happen — let the operator retry.
          return { ok: false, method: "smtp", error: (err as Error).message.slice(0, 200) };
        }
        result = { ok: true, method: "smtp", note: `Emailed ${contact}.` };
      } else {
        result = {
          ok: true,
          method: "manual",
          composeUrl: gmailComposeUrl(contact, subject, body),
          note: "Gmail opened with the message ready — attach the preview and hit send.",
        };
      }
      break;
    }

    case "sms": {
      if (!contact) {
        return {
          ok: false,
          method: "manual",
          error: "No phone number on this lead. Add one, or switch the channel.",
        };
      }
      if (isSmsConfigured()) {
        try {
          const { to } = await sendSms({ to: contact, body });
          result = { ok: true, method: "sms", note: `Texted ${to}.` };
        } catch (err) {
          return { ok: false, method: "sms", error: (err as Error).message.slice(0, 200) };
        }
      } else {
        if (!toE164(contact)) {
          return {
            ok: false,
            method: "manual",
            error: `"${contact}" isn't a dialable number. Set SMS_DEFAULT_COUNTRY_CODE, or store it in +international form.`,
          };
        }
        result = {
          ok: true,
          method: "manual",
          composeUrl: smsComposeUrl(contact, body),
          copyBody: body,
          note: "Your messaging app opened with the text ready (also copied to the clipboard). Set TWILIO_* to send these in one click.",
        };
      }
      break;
    }

    case "facebook":
    case "instagram": {
      // The contact IS the thread deep-link (m.me / ig.me). There is no legitimate
      // API for cold DMs, so the operator clicks through and pastes the message —
      // which is why the body is handed back for the clipboard.
      if (!contact) {
        return {
          ok: false,
          method: "manual",
          error: `No ${o.channel} thread link on this lead. Paste an m.me/ig.me link into the contact field.`,
        };
      }
      result = {
        ok: true,
        method: "manual",
        composeUrl: contact,
        copyBody: body,
        note: "Message copied to the clipboard — paste it into the thread that just opened.",
      };
      break;
    }

    case "phone": {
      if (!contact) {
        return {
          ok: false,
          method: "manual",
          error: "No phone number on this lead. Add one, or switch the channel.",
        };
      }
      // A call isn't a message: this opens the dialer and logs that the touch
      // happened. The talking is the operator's job.
      result = {
        ok: true,
        method: "manual",
        composeUrl: `tel:${toE164(contact) ?? contact.replace(/[^\d+]/g, "")}`,
        copyBody: body,
        note: "Dialer opened and the script copied to the clipboard — logged as your first touch.",
      };
      break;
    }

    case "whatsapp": {
      // Deliberately unsupported: cold WhatsApp messaging breaches WhatsApp
      // Business policy and gets the sending number banned. Kept as an explicit
      // case so old records fail with the reason rather than silently "sending".
      return {
        ok: false,
        method: "manual",
        error:
          "WhatsApp isn't supported — cold messaging breaches WhatsApp Business policy and risks a ban. Use SMS or a DM instead.",
      };
    }

    default: {
      return {
        ok: false,
        method: "manual",
        error: `Nothing can be delivered on the "${o.channel}" channel. Pick a real channel, or use "Mark sent by hand" once you've made contact.`,
      };
    }
  }

  await recordSent(o);
  return result;
}

/**
 * Record a touch the operator made outside the app (a walk-in, a phone call, a DM
 * typed from their own phone). The bookkeeping half of deliverOutreach with none of
 * the delivery — the funnel advances and the follow-up sequence starts, honestly.
 */
export async function markSentByHand(outreachId: string): Promise<DeliverResult> {
  const o = await load(outreachId);
  if (!o) return { ok: false, method: "manual", error: "Outreach record not found." };
  await recordSent(o);
  return { ok: true, method: "manual", note: "Recorded as sent by hand." };
}
