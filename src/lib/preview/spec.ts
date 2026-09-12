// The "spec" preview engine — the middle tier between the free deterministic
// template and the full Opus design.
//
// The template already varies layout, palette and photography per business. Its
// one weakness is words: the tagline, the eyebrow and the service list all come
// from canned per-locale lists, so two salons in one sweep read identically even
// though they look different. That canned copy is what makes a template page
// read as a template.
//
// This engine fixes exactly that, and nothing else. One cheap call reads the real
// reviews and returns a small JSON spec — headline, eyebrow, services, layout
// choice — which is merged into the template's existing context. Output is ~600
// tokens instead of the ~35k a full HTML design emits, which is where the ~50x
// cost difference comes from.
//
// It cannot restructure the page the way the Opus engine can (bespoke wordmarks,
// novel section layouts). It buys bespoke WORDS on a known-good layout.
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";
import { recordAiUsage } from "@/lib/aiUsage";
import { pickTheme } from "./theme";
import { detectLocale } from "./i18n";
import { COPY_POLICY } from "./copyPolicy";
import type { NormalizedPlaceDetails } from "@/lib/leadSource/types";

const SPEC_MODEL = "claude-sonnet-5";
const LANGUAGE_NAME: Record<string, string> = { sl: "Slovenian", en: "English" };

// Layout is deliberately NOT part of the spec. When the model was asked to pick
// an archetype it chose "warm" for all three businesses in the first trial —
// across a few hundred sites that convergence is worse than the seeded picker,
// which distributes evenly by construction. The model writes words; the seed
// keeps the sweep visually varied.
/** Copy overrides for the template's canned defaults. */
export interface SiteSpec {
  eyebrow?: string;
  tagline?: string;
  services?: { title: string; blurb: string }[];
}

function clip(text: string, max: number): string {
  const t = text.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

function parseJsonLoose(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * Ask for a copy spec for one business. Returns null on any failure — every
 * caller must be able to fall back to the plain template.
 */
export async function generateSiteSpec(
  details: NormalizedPlaceDetails,
  searchHint = "",
): Promise<SiteSpec | null> {
  if (!env.anthropicApiKey) return null;

  const locale = detectLocale(details);
  const languageName = LANGUAGE_NAME[locale] ?? "English";
  const theme = pickTheme(details.categories, searchHint);
  const reviews = details.reviewSnippets
    .map((s) => s.trim())
    .filter((s) => s.length > 15)
    .slice(0, 8);

  const facts = [
    `Business: ${details.name}`,
    `Type: ${theme.label}${searchHint ? ` (found by searching "${searchHint}")` : ""}`,
    details.address ? `Address: ${details.address}` : null,
    details.rating ? `Rating: ${details.rating} from ${details.reviewCount} reviews` : null,
    details.categories.length ? `Categories: ${details.categories.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const reviewBlock = reviews.length
    ? `\n\nReal Google reviews:\n${reviews.map((s, i) => `${i + 1}. "${clip(s, 400)}"`).join("\n")}`
    : "";

  try {
    const client = new Anthropic({ apiKey: env.anthropicApiKey });
    const msg = await client.messages.create({
      model: SPEC_MODEL,
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content:
            `You are writing the copy for a one-page website for a real local business. ` +
            `Everything you write must be in ${languageName}.\n\n${COPY_POLICY}\n\n${facts}${reviewBlock}\n\n` +
            `The reviews above are context for TONE only — what kind of place this is. Do not restate ` +
            `their content as claims by the business.\n\n` +
            `Reply with ONLY minified JSON, no prose:\n` +
            `{"eyebrow":"...","tagline":"...","services":[{"title":"...","blurb":"..."}]}\n\n` +
            `- "tagline": the hero slogan, under 60 characters. A warm, broad line that would suit a ` +
            `good ${theme.label} — an inviting mood or a simple promise anyone in this trade can make. ` +
            `Not the business name. Not a claim about this specific business's methods or people.\n` +
            `- "eyebrow": the town or city only (1–3 words). The page already prints the category ` +
            `next to it, so do not repeat the category here, and write nothing evaluative.\n` +
            `- "services": exactly 3 services that are standard for this category (use the categories ` +
            `above to choose which). "title" is the plain service name, 1–3 words. "blurb" is one short ` +
            `neutral sentence (under 90 characters) describing what that service IS — the kind of line ` +
            `any business offering it could truthfully print. No promises about outcome, no claims ` +
            `about staff, no invented detail.`,
        },
      ],
    });
    await recordAiUsage("preview_spec", SPEC_MODEL, msg.usage, details.placeId);

    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const obj = parseJsonLoose(text) as Partial<SiteSpec> | null;
    if (!obj) return null;

    const services = Array.isArray(obj.services)
      ? obj.services
          .filter(
            (s): s is { title: string; blurb: string } =>
              !!s && typeof s.title === "string" && typeof s.blurb === "string",
          )
          .map((s) => ({ title: clip(s.title, 40), blurb: clip(s.blurb, 110) }))
          .slice(0, 3)
      : [];

    const spec: SiteSpec = {
      eyebrow: typeof obj.eyebrow === "string" ? clip(obj.eyebrow, 40) : undefined,
      tagline: typeof obj.tagline === "string" ? clip(obj.tagline, 90) : undefined,
      services: services.length === 3 ? services : undefined,
    };

    // A spec with no tagline bought nothing over the plain template.
    return spec.tagline ? spec : null;
  } catch (err) {
    console.error("[spec] copy spec generation failed:", err);
    return null;
  }
}
