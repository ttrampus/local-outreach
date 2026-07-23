// Draft outreach with Claude — a short, native-language, gap-aware message that
// references the live preview link. Used when ANTHROPIC_API_KEY is set; the caller
// falls back to the deterministic template (./draft) when this returns null.
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { env } from "@/lib/env";
import type { Lead } from "@/generated/prisma/client";
import type { NormalizedPlaceDetails } from "@/lib/leadSource/types";
import { detectLocale } from "@/lib/preview/i18n";
import { pickChannel, type OutreachDraft, type OutreachMessage } from "./draft";

const MONTHLY_PRICE = "€50/month";

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

const SYSTEM = `You are a freelance web designer writing a first cold-outreach SEQUENCE to the owner of a local business you found on Google Maps. You build them a modern website and host it for a low monthly fee. You produce three messages: one initial message and two short follow-ups to send later if they don't reply.

Language & tone:
- Write EVERYTHING in the business's own language, as given. Sound like a native speaker — natural, warm, professional, never machine-translated.
- Use the polite/formal register where the language has one (Slovene "vikanje", German "Sie", etc.). This is a first contact with a business owner — never the informal register.
- No buzzwords, no "I hope this email finds you well", no emoji.

The INITIAL message (step 0), ~120-170 words:
- Lead with value, not a sales pitch. OPEN by referencing the most specific, flattering real detail you're given — ideally a standout point from their reviews, otherwise their rating, area, or specialty.
- Name the gap honestly but kindly — they have no website, an outdated one, or only a social/booking profile (e.g. Facebook, Booksy). Frame it as an opportunity, not a criticism.
- Tell them you already built them a FREE preview of a modern site, and include the preview link on its OWN line so they can click it.
- Offer simple pricing: ${MONTHLY_PRICE}, covering hosting plus any changes they ever need (no per-edit fees). Mention a one-time buyout is also possible, but most prefer the hands-off monthly option. One or two sentences.
- End with a soft, low-pressure question.

The FOLLOW-UPS (step 1, then step 2), each ~50-90 words, shorter than the initial:
- Step 1: a brief, friendly nudge that re-shares the preview link and offers to tweak anything. No guilt.
- Step 2: a gentle close — mention you'll take the demo down soon, and that if they want it live it's ${MONTHLY_PRICE}, cancel anytime. Still warm, never pushy.

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

  return [
    `Language to write in: ${languageName}`,
    `Business name: ${lead.name}`,
    details.address ? `Address: ${details.address}` : "",
    lead.rating != null ? `Google rating: ${lead.rating} from ${lead.reviewCount} reviews` : "",
    `Web-presence gap: ${gap}`,
    lead.qualificationReason ? `Why they're a good fit: ${lead.qualificationReason}` : "",
    reviews.length
      ? `Real customer reviews (open the initial message by referencing the most specific, flattering one — quote or paraphrase):\n${reviews
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
        { role: "user", content: factsBlock(lead, details, previewUrl, languageName) },
      ],
    });

    if (response.stop_reason === "refusal") return null;
    const out = response.parsed_output;
    if (!out?.messages?.length) return null;

    // Trust order over the model's self-reported step (re-index 0..n). Drop any
    // message missing a body so we never persist an empty row.
    const messages: OutreachMessage[] = out.messages
      .filter((m) => m.body?.trim())
      .map((m, i) => ({ step: i, subject: m.subject?.trim() ?? "", body: m.body.trim() }));
    if (!messages.length) return null;

    // Channel is OUR decision (email > call > manual), never cold WhatsApp.
    const { channel, contact } = pickChannel(lead);
    return { channel, contact, messages };
  } catch (err) {
    console.error(`[outreach/claude] generation failed for lead ${lead.id}:`, err);
    return null;
  }
}
