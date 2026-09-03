// Build a short, personalized, value-first outreach draft. Leads with the preview,
// then the one-time build price with the monthly care plan as the optional
// follow-on — the same three-plan story the landing page tells, so a prospect who
// clicks through from the email doesn't meet different numbers. Personalized with
// the business name and one concrete detail (a real review quote > neighborhood >
// specialty). Saved as a draft, never sent.
import type { Lead } from "@/generated/prisma/client";
import type { NormalizedPlaceDetails } from "@/lib/leadSource/types";
import { OUTREACH_PRICE_SENTENCE, OUTREACH_PRICE_SHORT } from "@/lib/pricing";
import { pickTheme } from "@/lib/preview/theme";
import { classifyWebPresence } from "@/lib/qualify";

/** One message in an outreach sequence. step 0 = initial; 1.. = follow-ups. */
export interface OutreachMessage {
  step: number;
  subject: string;
  body: string;
}

/** A full outreach sequence for one lead: a channel/contact + ordered messages. */
export interface OutreachDraft {
  channel: string;
  contact: string | null;
  messages: OutreachMessage[];
}

/**
 * Build a direct-message deep link for a Facebook/Instagram page URL, if possible.
 * m.me/<page> opens the page's Messenger thread; ig.me/m/<user> opens an IG DM.
 * These are OPEN-a-chat links — actually sending the DM stays a human click,
 * because neither platform has an API for cold DMs (automating them via bots
 * violates Meta's ToS and gets the sending account banned).
 */
function socialDmLink(website: string): { channel: string; contact: string } | null {
  const { presence, platform } = classifyWebPresence(website);
  if (presence !== "social" || !platform) return null;
  try {
    const u = new URL(website);
    const path = u.pathname.split("/").filter(Boolean);
    if (platform === "Facebook") {
      // facebook.com/<page> or facebook.com/profile.php?id=<id> — m.me takes both.
      const id = path[0] === "profile.php" ? u.searchParams.get("id") : path[0];
      if (id) return { channel: "facebook", contact: `https://m.me/${id}` };
    }
    if (platform === "Instagram") {
      const user = path[0];
      if (user && !["p", "reel", "reels", "explore", "stories"].includes(user)) {
        return { channel: "instagram", contact: `https://ig.me/m/${user}` };
      }
    }
  } catch {
    /* unparseable URL — fall through to the next channel */
  }
  return null;
}

/** Knobs that change which channels are even available to pick from. */
export interface ChannelOptions {
  /** True when Twilio is configured, so an SMS can actually be delivered. */
  smsEnabled?: boolean;
}

/** Everything buildDraft needs beyond the lead itself. */
export interface DraftOptions extends ChannelOptions {
  /** Public preview link (…/p/<leadId>). An SMS has no attachment — it needs this. */
  previewUrl?: string;
}

/**
 * Decide the first-touch channel, best available first:
 *   email (delivered by us over SMTP)
 *   > SMS (delivered by us over Twilio — only offered when Twilio is configured,
 *     otherwise a phone number is better spent on a DM or a call)
 *   > Facebook/Instagram DM (one click opens the thread, the operator pastes —
 *     often the ONLY channel for social-only businesses, and locals answer DMs)
 *   > phone (opens the dialer; the call is the operator's to make)
 *   > manual (nothing usable on file).
 *
 * We deliberately avoid WhatsApp: cold WhatsApp messaging breaches WhatsApp
 * Business policy and risks a ban on the sending number.
 *
 * This module is imported by client-safe code paths, so config arrives as an
 * argument rather than by reading `env` here.
 */
export function pickChannel(
  lead: Pick<Lead, "email" | "phone" | "website">,
  opts: ChannelOptions = {},
): {
  channel: string;
  contact: string | null;
} {
  if (lead.email) return { channel: "email", contact: lead.email };
  if (opts.smsEnabled && lead.phone) return { channel: "sms", contact: lead.phone };
  const dm = lead.website ? socialDmLink(lead.website) : null;
  if (dm) return dm;
  if (lead.phone) return { channel: "phone", contact: lead.phone };
  return { channel: "manual", contact: null };
}


function firstAddressSegment(address?: string | null): string | null {
  if (!address) return null;
  const part = address.split(",")[0]?.trim();
  return part && part.length <= 40 ? part : null;
}

function clip(text: string, max = 130): string {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/** Pick the single most concrete personalization hook available. */
function personalDetail(
  details: NormalizedPlaceDetails,
  searchHint: string,
): string {
  const quote = details.reviewSnippets.find((s) => s.trim().length > 15);
  if (quote) {
    return ` — one of your reviews stood out: “${clip(quote)}”. That kind of reputation deserves a site to match.`;
  }
  const area = firstAddressSegment(details.address);
  if (area) {
    return `, a familiar name in ${area}.`;
  }
  const label = pickTheme(details.categories, searchHint).label;
  return ` and the work you do as a local ${label}.`;
}

/**
 * How the message points at the work. Always a link, never an attachment: mail
 * from this domain is plain text, so an attached PNG was never shown inline, and
 * attachments from an unknown sender are both ignored by people and penalised by
 * spam filters. The live page is the better artefact regardless — it is the real
 * site, and opening it is a signal we can see.
 */
function previewLine(lead: Lead, previewUrl?: string): string {
  const link = lead.deployedUrl || previewUrl || null;
  if (link) {
    return `You can see the full preview here:\n${link}`;
  }
  return `I'd be glad to send over a quick preview so you can see it for yourself.`;
}

export function buildDraft(
  lead: Lead,
  details: NormalizedPlaceDetails,
  searchHint = "",
  opts: DraftOptions = {},
): OutreachDraft {
  const name = lead.name;
  const detail = personalDetail(details, searchHint);
  const { channel, contact } = pickChannel(lead, opts);

  const subject = `A quick website idea for ${name}`;

  const initial = `Hi ${name} team,

I came across ${name}${detail}

I put together a free, modern website preview to show what a refreshed site could look like — no obligation. ${previewLine(lead, opts.previewUrl)}

If you like it, I can have it live this week. I keep pricing simple: ${OUTREACH_PRICE_SENTENCE}. The preview isn't a mock-up — it becomes your actual site, so nothing is built twice.

Nothing on it is fixed either: the text, the photos, the colours, the layout, whole sections — all of it can be changed to whatever you want.

If you'd like it, press the "I'm interested" button on the preview, or just reply to this email — whichever is easier.

Best,
[Your name]`;

  // Most replies to cold outreach come from a follow-up, not the first message.
  const followup1 = `Hi ${name} team,

Just following up on the website preview I sent — did you get a chance to take a look? ${previewLine(lead, opts.previewUrl)}

No pressure at all. If a detail feels off, tell me and I'll adjust it.

Best,
[Your name]`;

  const followup2 = `Hi ${name} team,

I'll keep this short — I'll be taking the demo site down at the end of the week to free it up. If you'd like me to keep it and put it live (${OUTREACH_PRICE_SHORT}), just say the word and it's done.

Either way, thanks for your time.

Best,
[Your name]`;

  // An SMS is billed per 160-character segment and read on a lock screen, so the
  // long-form body above is the wrong shape entirely — send the short variant.
  // (Claude writes its own short variant when a key is set; this is the fallback.)
  if (channel === "sms") {
    // No attachments on SMS, so the link carries the whole pitch. Falls back to
    // "I can send it over" when there's nothing linkable yet.
    const link = lead.deployedUrl || opts.previewUrl || null;
    const look = link ? `Have a look: ${link}` : `Happy to send it over.`;
    return {
      channel,
      contact,
      messages: [
        {
          step: 0,
          subject,
          body: `Hi ${name} — I built a free website preview for you, no obligation. ${look}\n\nIf you like it I can put it live this week (${OUTREACH_PRICE_SHORT}).\n\n[Your name]`,
        },
        {
          step: 1,
          subject: `Re: ${subject}`,
          body: `Hi ${name} — did you get a chance to look at the website preview?${link ? ` ${link}` : ""}\n\nHappy to change anything that feels off.\n\n[Your name]`,
        },
        {
          step: 2,
          subject: `Re: ${subject}`,
          body: `Hi ${name} — I'll take the demo site down at the end of the week. Say the word and I'll put it live instead (${OUTREACH_PRICE_SHORT}). Either way, thanks!\n\n[Your name]`,
        },
      ],
    };
  }

  return {
    channel,
    contact,
    messages: [
      { step: 0, subject, body: initial },
      { step: 1, subject: `Re: ${subject}`, body: followup1 },
      { step: 2, subject: `Re: ${subject}`, body: followup2 },
    ],
  };
}
