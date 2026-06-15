// Build a short, personalized, value-first outreach draft. Leads with the preview,
// then offers ownership + recurring maintenance — RECURRING PRICING FIRST, one-time
// setup secondary. Personalized with the business name and one concrete detail
// (a real review quote > neighborhood > specialty). Saved as a draft, never sent.
import type { Lead } from "@/generated/prisma/client";
import type { NormalizedPlaceDetails } from "@/lib/leadSource/types";
import { pickTheme } from "@/lib/preview/theme";

export interface DraftResult {
  channel: string;
  contact: string | null;
  subject: string;
  body: string;
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
): DraftResult {
  const name = lead.name;
  const detail = personalDetail(details, searchHint);
  const phone = lead.phone ?? null;
  // We get phone (not email) from Places, so default to a messaging channel when
  // a number exists; the operator can change channel/contact before sending.
  const channel = phone ? "whatsapp" : "email";

  const subject = `A quick website idea for ${name}`;

  const body = `Hi ${name} team,

I came across ${name}${detail}

I put together a free, modern website preview to show what a refreshed site could look like — no obligation. ${previewLine(lead)}

If you like it, I can have it live this week. I keep things simple: ${MONTHLY_PRICE}, which covers hosting plus any changes you ever need — just message me and it's done, no per-edit fees. (If you'd rather own the site outright, a one-time setup is available too — but most owners prefer the hands-off monthly option.)

Happy to adjust the design to match your style. Would it be worth a quick look?

Best,
[Your name]`;

  return { channel, contact: phone, subject, body };
}
