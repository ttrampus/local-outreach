// Generate a BESPOKE single-page website for one business with Claude. Unlike the
// deterministic template (every salon looks the same), this designs each site from
// scratch — its own layout, type system, palette and aesthetic — using the real
// business name, category, photos, rating and reviews. This is what makes a cold
// outreach mockup look custom-made instead of templated.
//
// Photos are big (base64 data URIs), so we never put them in the prompt: Claude
// designs against {{PHOTO_0}}… placeholders and we swap in the real bytes after.
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";
import type { NormalizedPlaceDetails } from "@/lib/leadSource/types";
import { pickTheme } from "./theme";
import { detectLocale } from "./i18n";

const LANGUAGE_NAME: Record<string, string> = { sl: "Slovenian", en: "English" };

const SYSTEM = `You are an award-winning web designer. You hand-build a single, complete, production-grade marketing website for ONE local business — the kind of site that would make the owner say "this looks expensive, I want it." It is shown to them in a cold outreach as a free mockup, so it must look bespoke and credible, never templated.

OUTPUT CONTRACT (strict):
- Return ONE complete, self-contained HTML5 document and NOTHING else — no markdown fences, no commentary before or after. Start at <!doctype html>.
- Inline ALL CSS in a single <style> in <head>. Any JS goes in one <script> before </body> and must be defensive (no errors if an element is missing).
- The ONLY images you may reference are the placeholders given to you: the photo placeholders (e.g. {{PHOTO_0}}) and, when offered, a single location-map placeholder {{MAP}}. Use them in CSS background-image or <img src>. Never reference any other image URL. If given zero photos, build a striking type-led / illustrative design instead — do not leave broken image holes.
- You MAY load distinctive fonts from Google Fonts via a <link> to fonts.googleapis.com. Do not reference any other external resource.

DESIGN BAR (this is the whole point):
- A CREATIVE BRIEF is provided below with a specific aesthetic direction, font pairing, colour mood and hero layout for THIS business. FOLLOW IT — it exists to make every site look different. Execute that direction with conviction and taste.
- ANTI-CONVERGENCE — you have a strong, well-known default you MUST resist: a near-black hero with a gold/amber accent, big condensed ALL-CAPS type, and a serif like Fraunces/Playfair. Do NOT produce that unless the brief explicitly asks for a dark/cinematic mood. If the brief says light/airy, pastel, or warm, the page must genuinely be light/airy, pastel, or warm — not dark with a light section bolted on. A second default to resist: a horizontal scrolling marquee / ticker-tape band of service keywords near the hero — do NOT add one. It has become an instantly-recognisable AI-site tell and reads as templated, the opposite of bespoke.
- Use the EXACT fonts named in the brief (load them from Google Fonts with sensible weights). NEVER use Inter, Roboto, Arial, system-ui, or Space Grotesk.
- Make it memorable and cohesive — two businesses must never feel like the same template.
- NEVER use generic AI-slop aesthetics: no purple-on-white gradients, no cookie-cutter three-equal-cards layout unless you make it genuinely interesting, no centered-everything. Use asymmetry, overlap, generous negative space or controlled density, real hierarchy.
- Build atmosphere: layered backgrounds, texture/grain, considered shadows, tasteful motion. Animations are welcome for the scrolled sections, BUT the hero must be fully visible immediately (it becomes a screenshot) — gate any entrance/scroll animation behind \`@media (prefers-reduced-motion: no-preference)\` so a reduced-motion render shows the finished state, never blank.
- Fully responsive (looks right at 1280px and on mobile).
- PHOTOS — you cannot see the photos; a short caption for each is provided in the brief below. Use the captions to place images well: {{PHOTO_0}} has been pre-selected as the most representative, hero-worthy shot — use it as the hero/most prominent image. Never put a photo whose caption is a close-up of equipment, a logo, a sign, a menu/receipt, or anything unflattering into a hero or full-bleed position. Whatever photo fills a hero or banner: use \`background-size:cover\` with a sensible focal point (\`background-position\`), give it real height, and NEVER let an overlapping badge, card, or text block clip the photo's main subject or get clipped itself — keep overlays clear of the focal area.

CONTENT RULES:
- Write EVERY visible word in the business's language (given below). It must be grammatically correct and idiomatic — sound like a native speaker wrote it, not translated. Get agreement, case, and number right (e.g. in Slovenian the natural word for hair is the plural "lasje", not the singular "las"). Before finalizing, re-read every headline and tagline and fix any grammatical slip: a wrong word in a giant hero headline instantly destroys credibility.
- Derive a clean, confident DISPLAY NAME for the brand: drop legal forms (s.p., d.o.o., d.d., Ltd…) and generic category words; you may keep the full legal name small in the footer.
- Use the real rating and review count as social proof, and quote/adapt the real review snippets provided. Invent nothing factual (no fake awards, prices, or services beyond the generic category-appropriate ones).
- Include clear conversion elements: a prominent primary CTA (book/call — use the phone number in a tel: link), the services a business of this type offers, location/area, opening hours (use the REAL hours when they are provided below — verbatim, do not invent different ones; otherwise "by appointment"), and a contact section.
- WORKING CONTACT FORM: place the literal token {{CONTACT_FORM}} exactly once, inside your contact section, where a "get in touch" form belongs. It is replaced with a real, functioning enquiry form. Do NOT build your own <form> — just output the {{CONTACT_FORM}} token in the right spot (you may still keep tel:/email CTAs alongside it).
- When a list of what customers actually praise is provided, weave those real specifics into the headlines, about copy and service blurbs — that is what makes the site feel written for THIS business. Mention named staff naturally if given. Still invent nothing factual beyond what's provided.
- The hero is the most important thing: the business name, a sharp one-line value proposition, the CTA, and the rating — strong above the fold.`;

function clip(text: string, max = 180): string {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

// ── Photo captioning (vision) ───────────────────────────────────────────────
// The design model (Opus) never sees the photos — it builds against {{PHOTO_n}}
// placeholders. So a cheap Haiku vision pass looks at the real bytes, captions
// each photo, and picks the most hero-worthy one. We feed those captions into the
// design prompt and reorder so the chosen hero is PHOTO_0, which is what fixes
// "wrong/poorly-cropped photo front-and-centre" (e.g. an espresso machine on a
// hair salon). Best-effort: any failure returns null and we fall back to the
// previous behaviour (no captions, PHOTO_0 = first Google photo).
const VISION_MODEL = "claude-haiku-4-5";
const VISION_MEDIA = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type VisionMedia = (typeof VISION_MEDIA)[number];

function dataUriParts(uri: string): { mediaType: VisionMedia; data: string } | null {
  const m = /^data:(image\/(?:jpeg|png|gif|webp));base64,(.+)$/.exec(uri);
  if (!m) return null;
  return { mediaType: m[1] as VisionMedia, data: m[2] };
}

function parseJsonLoose(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "");
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(t.slice(start, end + 1));
  } catch {
    return null;
  }
}

interface PhotoNotes {
  captions: string[]; // one per input photo, aligned by index
  hero: number; // index of the best hero photo
}

async function describePhotos(
  client: Anthropic,
  photos: string[],
  businessType: string,
): Promise<PhotoNotes | null> {
  const parsed = photos.map(dataUriParts);
  // Only proceed if every photo decoded — keeps caption/photo indices aligned.
  if (!parsed.length || parsed.some((p) => p === null)) return null;

  const content: Anthropic.ContentBlockParam[] = [];
  parsed.forEach((p, i) => {
    content.push({ type: "text", text: `Photo ${i}:` });
    content.push({
      type: "image",
      source: { type: "base64", media_type: p!.mediaType, data: p!.data },
    });
  });
  content.push({
    type: "text",
    text:
      `These are real photos of a ${businessType}. For EACH photo give a short, factual caption ` +
      `(what it actually shows, ≤12 words). Then pick the index of the single best photo to use as a ` +
      `website hero/banner: the most representative, attractive, landscape-friendly shot. AVOID picking ` +
      `close-ups of equipment, logos, signs, menus, receipts, or anything unflattering as the hero. ` +
      `Reply with ONLY minified JSON, no prose: {"captions":["...", ...],"hero":<index>}. ` +
      `The captions array must have exactly ${photos.length} entries in photo order.`,
  });

  try {
    const msg = await client.messages.create({
      model: VISION_MODEL,
      max_tokens: 1024,
      messages: [{ role: "user", content }],
    });
    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const obj = parseJsonLoose(text) as { captions?: unknown; hero?: unknown } | null;
    if (!obj || !Array.isArray(obj.captions)) return null;

    const captions = obj.captions.map((c) => (typeof c === "string" ? clip(c, 120) : ""));
    if (captions.length !== photos.length) return null;

    let hero = typeof obj.hero === "number" ? obj.hero : 0;
    if (!Number.isInteger(hero) || hero < 0 || hero >= photos.length) hero = 0;
    return { captions, hero };
  } catch (err) {
    console.error("[aiSite] photo captioning failed:", err);
    return null;
  }
}

// ── Review insight (text) ───────────────────────────────────────────────────
// Mirror of the vision pass, for words: a cheap Haiku call reads the real reviews
// and extracts the specifics that make copy feel bespoke — what customers actually
// praise, named staff, the overall tone, and one strong pull-quote. We feed that
// structured insight into the design prompt instead of three raw snippets, which is
// what flips the copy from generic category filler to "written for THIS business".
// Best-effort: any failure returns null and the design falls back to raw snippets.
interface ReviewInsight {
  highlights: string[]; // 2–4 specific things customers praise, in the site language
  staff: string[]; // first names of staff mentioned, if any
  tone?: string; // a short tone descriptor (in the site language)
  pullQuote?: string; // one strong, short quote to feature
}

async function analyzeReviews(
  client: Anthropic,
  snippets: string[],
  businessType: string,
  languageName: string,
): Promise<ReviewInsight | null> {
  const usable = snippets.map((s) => s.trim()).filter((s) => s.length > 15);
  if (usable.length < 2) return null; // too little signal to be worth a call

  try {
    const msg = await client.messages.create({
      model: VISION_MODEL,
      max_tokens: 700,
      messages: [
        {
          role: "user",
          content:
            `Here are real Google reviews of a ${businessType}:\n` +
            usable.map((s, i) => `${i + 1}. "${clip(s, 400)}"`).join("\n") +
            `\n\nExtract what makes this specific business stand out. Reply with ONLY minified JSON, no prose:\n` +
            `{"highlights":["...", ...],"staff":["..."],"tone":"...","pullQuote":"..."}\n` +
            `- "highlights": 2–4 SPECIFIC things customers praise (e.g. a particular service, the atmosphere, punctuality) — concrete, not generic. Write them in ${languageName}.\n` +
            `- "staff": first names of any staff mentioned (empty array if none).\n` +
            `- "tone": a 2–4 word descriptor of the overall vibe, in ${languageName}.\n` +
            `- "pullQuote": the single most compelling short quote, lightly trimmed, kept in its original language. Omit if none is strong.`,
        },
      ],
    });
    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const obj = parseJsonLoose(text) as Partial<ReviewInsight> | null;
    if (!obj) return null;

    const asStrings = (v: unknown, max: number): string[] =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map((s) => clip(s, max)) : [];

    const highlights = asStrings(obj.highlights, 90).slice(0, 4);
    if (!highlights.length) return null;
    return {
      highlights,
      staff: asStrings(obj.staff, 40).slice(0, 4),
      tone: typeof obj.tone === "string" ? clip(obj.tone, 40) : undefined,
      pullQuote: typeof obj.pullQuote === "string" && obj.pullQuote.trim().length > 8 ? clip(obj.pullQuote, 180) : undefined,
    };
  } catch (err) {
    console.error("[aiSite] review insight failed:", err);
    return null;
  }
}

// Human-readable price positioning — a tone hint for the design, never printed as a price.
const PRICE_LABEL: Record<string, string> = {
  PRICE_LEVEL_INEXPENSIVE: "budget-friendly (€)",
  PRICE_LEVEL_MODERATE: "mid-range (€€)",
  PRICE_LEVEL_EXPENSIVE: "premium (€€€)",
  PRICE_LEVEL_VERY_EXPENSIVE: "high-end (€€€€)",
};

// ── Creative brief: deterministic per-business variation ────────────────────
// The single biggest cause of "every site looks the same" is the model relaxing
// to its house style. We counter it by seeding a DIFFERENT aesthetic direction,
// font pairing, colour mood and hero layout for each business (from its placeId),
// and instructing the model to follow it. Stable across regenerations of one lead.
function seedFrom(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function pick<T>(arr: T[], seed: number, salt: number): T {
  return arr[(seed + salt * 2654435761) % arr.length];
}

// All fonts below exist on Google Fonts; pairs are display / body.
const FONT_PAIRS = [
  "Fraunces (display) + Hanken Grotesk (body)",
  "Playfair Display (display) + Work Sans (body)",
  "Cormorant Garamond (display) + Mulish (body)",
  "Bricolage Grotesque (display) + DM Sans (body)",
  "Syne (display) + Public Sans (body)",
  "Anton (display) + Hanken Grotesk (body)",
  "DM Serif Display (display) + Work Sans (body)",
  "Unbounded (display) + DM Sans (body)",
  "Big Shoulders Display (display) + Public Sans (body)",
  "Instrument Serif (display) + Work Sans (body)",
  "Archivo Black (display) + Manrope (body)",
  "Italiana (display) + Manrope (body)",
  "Libre Caslon Display (display) + Mulish (body)",
  "Bebas Neue (display) + Hanken Grotesk (body)",
];

const DIRECTIONS = [
  "Editorial magazine — oversized type, asymmetric columns, hairline rules and captions, confident whitespace",
  "Luxe minimal — restrained and refined, small-caps labels, thin rules, lots of calm space, premium feel",
  "Brutalist — raw and high-contrast, an exposed grid, huge type, monospace accents, hard edges",
  "Warm organic — earthy and handcrafted, soft rounded shapes, cozy texture, inviting",
  "Retro nostalgia — 70s/80s flavour, warm groovy palette, badges, characterful type",
  "Bold & energetic — dynamic angles, heavy type, one punchy accent, lots of motion",
  "Art-deco elegance — symmetry and geometric ornament, refined metallic-on-deep details",
  "Soft boutique — delicate and pretty, fine serif, generous airy spacing, gentle palette",
  "Industrial / utilitarian — structured, technical labels, monospace touches, gritty texture",
  "High-fashion contrast — stark black & white, dramatic imagery, fashion-magazine confidence",
  "Fresh & clean — light, calm and trustworthy, lots of white, crisp grid",
  "Cinematic premium — moody and atmospheric, one luminous accent (use only when this direction is chosen)",
];

const MOODS = [
  "Light & airy — off-white or cream base, dark ink text, a single saturated accent",
  "Warm & earthy — sand, terracotta, ochre, deep brown",
  "Cool & fresh — sage, teal, stone, soft white",
  "Mono + one pop — black & white with a single vivid accent colour",
  "Jewel tones — deep emerald / burgundy / navy with a metallic detail",
  "Soft pastel — blush, sky, butter, warm grey",
  "High-contrast neutral — bold black on bright paper, minimal colour",
  "Dark & cinematic — near-black base with a luminous accent",
];

const LAYOUTS = [
  "Full-bleed hero image with overlaid text",
  "Split hero — headline + CTA on one side, image on the other",
  "Type-first hero — an oversized headline dominates, image is a secondary band below",
  "Centered editorial hero framed by fine rules",
  "Offset / asymmetric hero with a floating info card",
  "Magazine-grid hero with overlapping blocks",
];

function creativeBrief(seedKey: string, hasPhotos: boolean): string {
  const seed = seedFrom(seedKey);
  const direction = pick(DIRECTIONS, seed, 1);
  const fonts = pick(FONT_PAIRS, seed, 2);
  const mood = pick(MOODS, seed, 3);
  let layout = pick(LAYOUTS, seed, 4);
  // No photo → don't pick image-led hero layouts.
  if (!hasPhotos && /image|full-bleed/i.test(layout)) {
    layout = "Type-first hero — an oversized headline dominates, with strong graphic/typographic treatment instead of a photo";
  }
  return [
    `CREATIVE BRIEF (follow this exactly — it is what makes this site unique):`,
    `• Aesthetic direction: ${direction}`,
    `• Fonts to use: ${fonts}`,
    `• Colour mood: ${mood}`,
    `• Hero layout: ${layout}`,
  ].join("\n");
}

function buildUserPrompt(
  details: NormalizedPlaceDetails,
  searchHint: string,
  photoCount: number,
  languageName: string,
  photoCaptions: string[],
  insight: ReviewInsight | null,
  hasMap: boolean,
): string {
  const theme = pickTheme(details.categories, searchHint);
  const reviews = details.reviewSnippets
    .filter((s) => s.trim().length > 15)
    .slice(0, 3)
    .map((s) => `- "${clip(s)}"`);

  // Structured insight (preferred) or raw snippets (fallback) for the copy.
  const insightBlock = insight
    ? [
        `WHAT CUSTOMERS ACTUALLY PRAISE (weave these real specifics into the copy; invent nothing beyond them):`,
        ...insight.highlights.map((h) => `- ${h}`),
        insight.staff.length ? `Named staff you may mention naturally: ${insight.staff.join(", ")}` : "",
        insight.tone ? `Overall tone to match: ${insight.tone}` : "",
        insight.pullQuote ? `A strong quote you may feature: "${insight.pullQuote}"` : "",
      ]
        .filter(Boolean)
        .join("\n")
    : reviews.length
      ? `Real customer reviews you may quote/adapt:\n${reviews.join("\n")}`
      : "No review text available.";

  const hoursBlock = details.openingHours?.length
    ? `Opening hours (use these EXACT lines in the hours/contact section — do not invent different ones):\n${details.openingHours
        .map((h) => `- ${h}`)
        .join("\n")}`
    : "";

  const priceLabel = details.priceLevel ? PRICE_LABEL[details.priceLevel] : undefined;
  const mapBlock = hasMap
    ? `A map image of the exact location is available as the placeholder {{MAP}}. Place it ONCE in the contact/location section (an <img> in a framed/rounded container, or a CSS background with real height) so visitors can see where the business is. If there is genuinely no suitable spot, you may omit it.`
    : "";
  const placeholders = Array.from({ length: photoCount }, (_, i) => `{{PHOTO_${i}}}`).join(", ");
  // When captions are available, PHOTO_0 has already been reordered to the
  // hero-worthy shot; otherwise PHOTO_0 is just the first Google photo.
  const photoBlock =
    photoCount > 0 && photoCaptions.length === photoCount
      ? `You have ${photoCount} real photo(s) of this business. Here is what each one shows (you cannot see them):\n` +
        photoCaptions.map((c, i) => `- {{PHOTO_${i}}}: ${c || "(no caption)"}`).join("\n") +
        `\nUse these EXACT placeholder tokens where you want each image; each is replaced with the real photo. ` +
        `{{PHOTO_0}} is the pre-selected hero shot — use it as the hero/most prominent image, and put the rest in a gallery or supporting sections. Choose crops/focal points that flatter each photo's subject.`
      : photoCount > 0
        ? `You have ${photoCount} real photo(s) of this business. Use these EXACT placeholder tokens where you want them (hero background, gallery, etc.): ${placeholders}. Each will be replaced with the real image. Use the first one ({{PHOTO_0}}) as the hero/most prominent image.`
        : `No photos are available — design a strong type-led hero with no image holes.`;

  return [
    creativeBrief(details.placeId || details.name, photoCount > 0),
    ``,
    `LANGUAGE (write everything in this): ${languageName}`,
    ``,
    `Business name (raw, from Google): ${details.name}`,
    `Business type: ${theme.label}${details.primaryTypeDisplayName ? ` (${details.primaryTypeDisplayName})` : ""}`,
    details.categories.length ? `Google categories: ${details.categories.slice(0, 6).join(", ")}` : "",
    details.address ? `Address: ${details.address}` : "",
    details.phone ? `Phone (use in a tel: link CTA): ${details.phone}` : "",
    details.rating != null
      ? `Google rating: ${details.rating} from ${details.reviewCount} reviews (use as social proof)`
      : "",
    priceLabel ? `Price positioning (a tone hint — do NOT print a price): ${priceLabel}` : "",
    hoursBlock,
    ``,
    insightBlock,
    ``,
    photoBlock,
    mapBlock,
    ``,
    `Now design and return the complete HTML document for this business. Make it genuinely distinctive — not a template.`,
  ]
    .filter((l) => l !== "")
    .join("\n");
}

/** Strip accidental markdown fences / preamble and return the raw HTML document. */
function extractHtml(text: string): string | null {
  let t = text.trim();
  const fence = t.match(/```(?:html)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.search(/<!doctype html|<html[\s>]/i);
  if (start === -1) return null;
  return t.slice(start).trim();
}

/**
 * Generate a bespoke site for a lead, or null on any failure (no key, refusal,
 * bad output, error) so the caller can fall back to the deterministic template.
 */
export async function generateAiSiteHtml(
  details: NormalizedPlaceDetails,
  searchHint: string,
  photos: string[],
  mapUri: string | null = null,
): Promise<string | null> {
  if (!env.anthropicApiKey) return null;

  const locale = detectLocale(details);
  const languageName = LANGUAGE_NAME[locale] ?? "English";
  const client = new Anthropic({ apiKey: env.anthropicApiKey });
  const theme = pickTheme(details.categories, searchHint);

  // Two cheap Haiku passes in parallel:
  //  - vision: caption the photos and pick the best hero (fixes a wrong/poorly-
  //    cropped photo front-and-centre, e.g. an espresso machine on a hair salon).
  //  - text: mine the reviews for the specifics that make the copy feel bespoke.
  // Both are best-effort — each degrades independently to its fallback.
  const [notes, insight] = await Promise.all([
    photos.length ? describePhotos(client, photos, theme.label) : Promise.resolve(null),
    analyzeReviews(client, details.reviewSnippets, theme.label, languageName),
  ]);

  // Reorder so the chosen hero is PHOTO_0.
  let orderedPhotos = photos;
  let photoCaptions: string[] = [];
  if (notes) {
    const { hero, captions } = notes;
    const rest = (arr: string[]) => arr.filter((_, i) => i !== hero);
    orderedPhotos = [photos[hero], ...rest(photos)];
    photoCaptions = [captions[hero], ...rest(captions)];
  }

  try {
    // Stream — a full HTML doc is long output; streaming avoids HTTP timeouts.
    const stream = client.messages.stream({
      model: env.anthropicModel,
      max_tokens: 32000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: buildUserPrompt(
            details,
            searchHint,
            orderedPhotos.length,
            languageName,
            photoCaptions,
            insight,
            Boolean(mapUri),
          ),
        },
      ],
    });
    const message = await stream.finalMessage();

    if (message.stop_reason === "refusal") return null;
    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    let html = extractHtml(text);
    if (!html) return null;

    // Swap photo placeholders for the real data URIs; blank any the model didn't use
    // or invented beyond what we provided (so no broken/empty image references ship).
    // Use orderedPhotos so {{PHOTO_0}} resolves to the hero we selected above.
    orderedPhotos.forEach((uri, i) => {
      html = html!.split(`{{PHOTO_${i}}}`).join(uri);
    });
    html = html.replace(/\{\{PHOTO_\d+\}\}/g, "");

    // Swap the location map, then strip the token if the model didn't place it (or
    // we had no map) so no literal {{MAP}} ever ships.
    if (mapUri) html = html.split("{{MAP}}").join(mapUri);
    html = html.split("{{MAP}}").join("");

    return html;
  } catch (err) {
    console.error(`[aiSite] generation failed for ${details.placeId}:`, err);
    return null;
  }
}
