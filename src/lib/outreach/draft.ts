// Build a short, personalized, value-first outreach draft. Leads with the preview,
// then offers ownership + recurring maintenance — RECURRING PRICING FIRST, one-time
// setup secondary. Personalized with the business name and one concrete detail
// (a real review quote > neighborhood > specialty). Saved as a draft, never sent.
import type { Lead } from "@/generated/prisma/client";
import type { NormalizedPlaceDetails } from "@/lib/leadSource/types";
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

/**
 * Decide the first-touch channel: email (automatable) > Facebook/Instagram DM
 * (one-click semi-manual — often the ONLY channel for social-only businesses, and
 * locals answer DMs readily) > phone > manual. We deliberately avoid WhatsApp:
 * cold WhatsApp messaging breaches WhatsApp Business policy and risks a ban.
 */
export function pickChannel(lead: Pick<Lead, "email" | "phone" | "website">): {
  channel: string;
  contact: string | null;
} {
  if (lead.email) return { channel: "email", contact: lead.email };
  const dm = lead.website ? socialDmLink(lead.website) : null;
  if (dm) return dm;
  if (lead.phone) return { channel: "phone", contact: lead.phone };
  return { channel: "manual", contact: null };
}

const MONTHLY_PRICE = "€50/month";

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

function previewLine(lead: Lead): string {
  if (lead.deployedUrl) {
    return `You can see the full preview live here:\n${lead.deployedUrl}`;
  }
  if (lead.previewImagePath) {
    return `I've attached a preview image so you can see exactly what it would look like.`;
  }
  return `I'd be glad to send over a quick preview so you can see it for yourself.`;
}

export function buildDraft(
  lead: Lead,
  details: NormalizedPlaceDetails,
  searchHint = "",
): OutreachDraft {
  const name = lead.name;
  const detail = personalDetail(details, searchHint);
  const { channel, contact } = pickChannel(lead);

  const subject = `A quick website idea for ${name}`;

  const initial = `Hi ${name} team,

I came across ${name}${detail}

I put together a free, modern website preview to show what a refreshed site could look like — no obligation. ${previewLine(lead)}

If you like it, I can have it live this week. I keep things simple: ${MONTHLY_PRICE}, which covers hosting plus any changes you ever need — just message me and it's done, no per-edit fees. (If you'd rather own the site outright, a one-time setup is available too — but most owners prefer the hands-off monthly option.)

Happy to adjust the design to match your style. Would it be worth a quick look?

Best,
[Your name]`;

  // Most replies to cold outreach come from a follow-up, not the first message.
  const followup1 = `Hi ${name} team,

Just following up on the website preview I sent — did you get a chance to take a look? ${previewLine(lead)}

No pressure at all. If a detail feels off, tell me and I'll adjust it.

Best,
[Your name]`;

  const followup2 = `Hi ${name} team,

I'll keep this short — I'll be taking the demo site down at the end of the week to free it up. If you'd like me to keep it and put it live (${MONTHLY_PRICE}, cancel anytime), just say the word and it's done.

Either way, thanks for your time.

Best,
[Your name]`;

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
