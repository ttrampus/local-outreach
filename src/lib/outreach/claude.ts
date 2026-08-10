// Draft outreach with Claude — a short, native-language, gap-aware message that
// references the live preview link. Used when ANTHROPIC_API_KEY is set; the caller
// falls back to the deterministic template (./draft) when this returns null.
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { env } from "@/lib/env";
import { recordAiUsage } from "@/lib/aiUsage";
import type { Lead } from "@/generated/prisma/client";
import type { NormalizedPlaceDetails } from "@/lib/leadSource/types";
import { detectLocale } from "@/lib/preview/i18n";
import { OUTREACH_PRICE_SENTENCE, OUTREACH_PRICE_SHORT } from "@/lib/pricing";
import { pickChannel, type OutreachDraft, type OutreachMessage } from "./draft";
import { isSmsConfigured } from "./sms";

const LANGUAGE_NAME: Record<string, string> = {
  sl: "Slovenian",
  en: "English",
};

const MessageSchema = z.object({
  step: z
    .number()
    .int()
    .describe("0 for the initial message, then 1 and 2 for the two follow-ups."),
  subject: z
    .string()
    .describe(
      "A short, specific subject line in the business's language. For follow-ups, you may prefix it with the local equivalent of 'Re:'.",
    ),
  body: z
    .string()
    .describe(
      "The message body in the business's language. Plain text, ends with [Your name] as a literal placeholder.",
    ),
});

const OutreachSchema = z.object({
  language: z.string().describe("The language you wrote in, e.g. Slovenian."),
  messages: z
    .array(MessageSchema)
    .min(2)
    .max(3)
    .describe("An initial message followed by two short follow-ups (3 items total)."),
});

const SYSTEM = `You are a local freelance web designer writing a first cold-outreach SEQUENCE to the owner of a small business you found on Google Maps. You build modern websites for a one-time fee, and optionally host and look after them for a low monthly fee. You produce three messages: one initial message and two short follow-ups to send later if they don't reply.

Language & tone:
- Write EVERYTHING in the business's own language, as given. Sound like a native speaker — natural, warm, plain-spoken, never machine-translated and never like marketing copy.
- Use the polite/formal register where the language has one (Slovene "vikanje", German "Sie", etc.). This is a first contact with a business owner — never the informal register.
- Write like one person to another: short sentences, no buzzwords, no "I hope this email finds you well", no exclamation-mark enthusiasm, no emoji.

Personalization = research, NOT surveillance:
- You may reference their public reputation: their rating, how established they are, and what customers CONSISTENTLY praise ("customers keep mentioning how easy it is to get an appointment").
- If several customers praise a staff member by first name, you may mention that pattern ("your customers clearly think highly of Filip").
- NEVER quote a review verbatim, never name or describe an individual reviewer, never say "I read a review where...". Summarized patterns feel like homework; quoted individuals feel like being watched.

The INITIAL message (step 0), ~90-140 words:
- Open with ONE genuine, specific observation about their business — then get to the point. No flattery padding.
- Name the gap matter-of-factly and kindly — no website, an outdated one, or only a social/booking profile. One sentence; it's an observation, not a criticism.
- Say you already built them a FREE preview of what their site could look like, and put the preview link on its OWN line.
- Pricing in one sentence: ${OUTREACH_PRICE_SENTENCE}. Add that the preview they're looking at is not a mock-up — it becomes their actual site, so the work is already done.
- Sell the outcome, never the method: more customers, a better first impression, a faster site, easier to update. NEVER mention AI, automation, templates or how the site was generated — the owner is buying a result, not a process.
- End with a soft, low-pressure question they can answer in five seconds.

The FOLLOW-UPS (step 1, then step 2), each ~40-80 words:
- Step 1: a brief, friendly nudge — re-share the preview link, offer to change anything they don't like. No guilt, no "just checking in" filler.
- Step 2: a gentle close — you'll take the demo down soon; if they'd like it live it's ${OUTREACH_PRICE_SHORT}, and the monthly part can be cancelled anytime. Warm, final, never pushy.

If the channel is a Facebook/Instagram DM (you'll be told): make every message noticeably shorter and more conversational (initial ~50-80 words, follow-ups ~25-50) — DMs are read on phones. Keep the formal register. Still provide a subject line (used only as an internal label).

If the channel is SMS (you'll be told): be RUTHLESSLY short — the initial message must fit in about 320 characters INCLUDING the link, follow-ups in about 160. One observation, the free preview, the link on its own line, the price, one short question. Drop the greeting flourish and any sentence that isn't load-bearing; a long SMS reads as spam and is billed per 160 characters. Still provide a subject line (used only as an internal label, never sent).

Always:
- Sign every message off with "[Your name]" as a literal placeholder.
- Do NOT invent facts (services, awards, prices of theirs). Only use what you're given.`;

function clip(text: string, max = 160): string {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/** Build the per-lead facts block Claude personalizes from. */
function factsBlock(
  lead: Lead,
  details: NormalizedPlaceDetails,
  previewUrl: string,
  languageName: string,
  channel: string,
): string {
  // Surface the web-presence gap the qualifier already computed.
  let webPresence = "unknown";
  let platform: string | null = null;
  try {
    const s = lead.signals ? JSON.parse(lead.signals) : null;
    if (s?.webPresence) webPresence = String(s.webPresence);
    if (s?.platform) platform = String(s.platform);
  } catch {
    /* ignore malformed signals */
  }
  const gap =
    webPresence === "none"
      ? "They have NO website at all."
      : webPresence === "social"
        ? `They have no real website — only a ${platform ?? "social media"} page.`
        : "Their existing website is weak or outdated.";

  const reviews = details.reviewSnippets.filter((s) => s.trim().length > 15).slice(0, 3);

  const channelLine =
    channel === "facebook" || channel === "instagram"
      ? `Channel: a ${channel === "facebook" ? "Facebook Messenger" : "Instagram"} direct message — write the shorter DM variant.`
      : channel === "sms"
        ? `Channel: SMS text message — write the very short SMS variant.`
        : `Channel: email.`;

  return [
    `Language to write in: ${languageName}`,
    channelLine,
    `Business name: ${lead.name}`,
    details.address ? `Address: ${details.address}` : "",
    lead.rating != null ? `Google rating: ${lead.rating} from ${lead.reviewCount} reviews` : "",
    `Web-presence gap: ${gap}`,
    lead.qualificationReason ? `Why they're a good fit: ${lead.qualificationReason}` : "",
    reviews.length
      ? `Raw customer reviews — for YOUR research only. Distill the pattern of what customers praise; never quote these or refer to any individual reviewer:\n${reviews
          .map((r) => `- "${clip(r)}"`)
          .join("\n")}`
      : "",
    `Preview link to include (put it on its own line in each message): ${previewUrl}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Returns a Claude-drafted outreach, or null when unavailable (no key, refusal, or
 * error) so the caller can fall back to the deterministic template.
 */
export async function generateOutreachWithClaude(
  lead: Lead,
  details: NormalizedPlaceDetails,
  previewUrl: string,
): Promise<OutreachDraft | null> {
  if (!env.anthropicApiKey) return null;

  const locale = detectLocale(details);
  const languageName = LANGUAGE_NAME[locale] ?? "English";
  const client = new Anthropic({ apiKey: env.anthropicApiKey });

  // Channel is OUR decision (email > SMS > social DM > call), made up front so the
  // writing style can match the medium (DMs and SMS get the short variants).
  const { channel, contact } = pickChannel(lead, { smsEnabled: isSmsConfigured() });

  try {
    const response = await client.messages.parse({
      model: env.anthropicModel,
      max_tokens: 2500,
      output_config: {
        format: zodOutputFormat(OutreachSchema),
        effort: "low",
      },
      system: SYSTEM,
      messages: [
        { role: "user", content: factsBlock(lead, details, previewUrl, languageName, channel) },
      ],
    });

    await recordAiUsage("outreach_draft", env.anthropicModel, response.usage, lead.placeId);

    if (response.stop_reason === "refusal") return null;
    const out = response.parsed_output;
    if (!out?.messages?.length) return null;

    // Trust order over the model's self-reported step (re-index 0..n). Drop any
    // message missing a body so we never persist an empty row.
    const messages: OutreachMessage[] = out.messages
      .filter((m) => m.body?.trim())
      .map((m, i) => ({ step: i, subject: m.subject?.trim() ?? "", body: m.body.trim() }));
    if (!messages.length) return null;

    return { channel, contact, messages };
  } catch (err) {
    console.error(`[outreach/claude] generation failed for lead ${lead.id}:`, err);
    return null;
  }
}
