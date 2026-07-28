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
import { recordAiUsage } from "@/lib/aiUsage";
import { describePhotoShapes } from "./photos";
import type { NormalizedPlaceDetails } from "@/lib/leadSource/types";
import { pickTheme } from "./theme";
import { detectLocale } from "./i18n";
import { artDirectionFor, type ArtDirection } from "./designTokens";

const LANGUAGE_NAME: Record<string, string> = { sl: "Slovenian", en: "English" };

// Design effort. "high" is the sweet spot for this kind of build: the model has
// room to actually execute the motion choreography and a full multi-section
// page, without the overthinking that shows up at xhigh on simple businesses.
// max_tokens covers thinking + output on this model family, so it needs real
// headroom — 32k truncated mid-page once effort went up.
const DESIGN_EFFORT = "high";
const DESIGN_MAX_TOKENS = 64000;

const SYSTEM = `You are an award-winning web designer. You hand-build a single, complete, production-grade marketing website for ONE local business — the kind of site that would make the owner say "this looks expensive, I want it." It is shown to them in a cold outreach as a free mockup, so it must look bespoke and credible, never templated.

OUTPUT CONTRACT (strict):
- Return ONE complete, self-contained HTML5 document and NOTHING else — no markdown fences, no commentary before or after. Start at <!doctype html>.
- Inline ALL CSS in a single <style> in <head>. Any JS goes in one <script> before </body> and must be defensive (no errors if an element is missing).
- The ONLY images you may reference are the placeholders given to you: the photo placeholders (e.g. {{PHOTO_0}}) and, when offered, a single location-map placeholder {{MAP}}. Use them in CSS background-image or <img src>. Never reference any other image URL. If given zero photos, build a striking type-led / illustrative design instead — do not leave broken image holes.
- You MAY load distinctive fonts from Google Fonts via a <link> to fonts.googleapis.com. Do not reference any other external resource.

THE ART DIRECTION BELOW IS A SPECIFICATION, NOT A SUGGESTION:
- The PALETTE gives exact hex values. Use them verbatim as your CSS custom properties. Do not tint, shade-shift, substitute, or "improve" them, and do not introduce a background colour that is not derived from them. If the palette is dark, the page is dark; if it is light, the page is light.
- LEGIBILITY OVERRIDES EVERYTHING. Text is either the palette's ink (primary) or muted (secondary). White or near-white text is allowed ONLY on a surface you have actually filled with the accent colour or a dark colour — never on the page background of a LIGHT palette, where it is invisible. This is the single most common way these designs fail, and it fails silently: the markup looks correct and the page renders blank. Before finishing, walk every text element and check its colour against the background it will really render on — nav links, hero sub-headlines, button labels, stat/rating blocks, and any two-tone headline where one span is coloured differently. If a composition calls for text on a coloured field, you must actually paint that field; do not style the text as though the field exists.
- The TYPE SET names exact families and weights. Load exactly those from Google Fonts and use them. NEVER use Inter, Roboto, Arial, Helvetica, system-ui, or Space Grotesk.
- The COMPOSITION defines the structure of the first screen, including where photography goes. Build that structure. Its "forbids" line is absolute.
- The MOTION signature defines the animation choreography. Implement it as written, with those durations and easing curves.

ANTI-CONVERGENCE — resist your own defaults. You have a strong, persistent house style that you must NOT fall back into:
- A warm cream / off-white / bone background in the #F0EDE4–#F7F4EC range. Do not use any background in that range unless the palette below explicitly specifies one.
- Oversized near-black display type on the left with a photograph filling the right half, and a dark pill-shaped CTA button at the top right of the nav. This exact composition is your default and it is banned unless the composition below actually asks for a split.
- Terracotta, rust, burnt-orange or amber accents on a cream ground.
- A serif display face with one word italicised for emphasis.
- A horizontal scrolling marquee / ticker-tape band of service keywords. This is an instantly recognisable AI-site tell.
These are not stylistic preferences — they are the specific fingerprints that make generated sites look mass-produced. The palette and composition you are given exist to move you off them. Follow those instead.

DESIGN BAR:
- Make it memorable and cohesive — two businesses must never feel like the same template.
- NEVER use generic AI-slop aesthetics: no purple-on-white gradients, no cookie-cutter three-equal-cards layout unless you make it genuinely interesting, no centered-everything (unless the composition calls for it). Use asymmetry, overlap, generous negative space or controlled density, real hierarchy.
- Build atmosphere: layered backgrounds, texture/grain, considered shadows.
- MOTION IS REQUIRED, not optional, and it is a headline feature of this site. Implement the given motion signature: the hero entrance, the scroll behaviour, and the hover feedback. Use CSS transitions/animations and a small IntersectionObserver where needed; keep it smooth (transform and opacity only — never animate layout properties).
- CRITICAL MOTION CONSTRAINT: the hero is screenshotted with \`prefers-reduced-motion: reduce\`. Gate EVERY entrance and scroll animation behind \`@media (prefers-reduced-motion: no-preference)\` and author the base (un-animated) CSS as the finished, settled state described in the signature. A reduced-motion render must show a complete, fully-visible hero — never blank, never mid-fade, never at opacity 0.
- Fully responsive (looks right at 1280px and on mobile).
- PHOTOS — you cannot see the photos; a short caption for each is provided below. Place them where the COMPOSITION says they go — that instruction outranks any instinct to lead with a big photo. Never put a photo whose caption is a close-up of equipment, a logo, a sign, a menu/receipt, or anything unflattering into a hero or full-bleed position. Whatever photo fills a hero or banner: use \`background-size:cover\` with a sensible focal point (\`background-position\`), give it real height, and NEVER let an overlapping badge, card, or text block clip the photo's main subject or get clipped itself — keep overlays clear of the focal area.

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
  placeId: string,
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
    await recordAiUsage("preview_vision", VISION_MODEL, msg.usage, placeId);
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
  placeId: string,
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
    await recordAiUsage("preview_reviews", VISION_MODEL, msg.usage, placeId);
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

// ── Art direction: deterministic per-business variation ────────────────────
// The single biggest cause of "every site looks the same" is the model relaxing
// to its house style. Adjectival briefs ("light & airy", "warm organic") do NOT
// prevent that — the model resolves them straight back into cream-and-terracotta.
// So the brief below is literal: exact hex, exact families, exact structure,
// exact animation timings, all seeded per business from `designTokens.ts`.
function artDirectionBrief(d: ArtDirection): string {
  const p = d.palette;
  return [
    `ART DIRECTION — this is a specification. Follow it exactly; it is what makes this site unlike any other.`,
    ``,
    `PALETTE "${p.id}" (${p.mode} theme) — use these exact hex values:`,
    `  background: ${p.bg}   surface/cards: ${p.surface}   border/rules: ${p.border}`,
    `  primary text: ${p.ink}   secondary text: ${p.muted}`,
    `  accent: ${p.accent}   secondary accent: ${p.accent2}`,
    `  Set these as CSS custom properties on :root and build the entire page from them.`,
    `  The page background MUST be ${p.bg}. Do not substitute a lighter, warmer, or "safer" ground.`,
    ``,
    `TYPE SET — load exactly these from Google Fonts:`,
    `  display face: ${d.type.display}`,
    `  body face: ${d.type.body}`,
    `  treatment: ${d.type.treatment}`,
    ``,
    `HERO COMPOSITION "${d.composition.id}":`,
    `  ${d.composition.structure}`,
    `  FORBIDDEN here: ${d.composition.forbids}`,
    ``,
    `MOTION SIGNATURE "${d.motion.id}" — implement this choreography:`,
    `  entrance: ${d.motion.entrance}`,
    `  on scroll: ${d.motion.scroll}`,
    `  on hover: ${d.motion.hover}`,
    `  SETTLED STATE (what the un-animated / reduced-motion CSS must show): ${d.motion.settled}`,
  ].join("\n");
}

function buildUserPrompt(
  details: NormalizedPlaceDetails,
  searchHint: string,
  photoCount: number,
  languageName: string,
  photoCaptions: string[],
  photoShapes: string[],
  insight: ReviewInsight | null,
  hasMap: boolean,
  direction: ArtDirection,
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
  // Placement follows the COMPOSITION, not a blanket "photo must be the hero"
  // rule. That rule is what previously collapsed every layout into the same
  // text-left / photo-right split. {{PHOTO_0}} is only the *strongest* shot —
  // where it belongs is the composition's call, and some compositions
  // deliberately want no photograph above the fold at all.
  const placementRule = direction.composition.photoAboveFold
    ? `Place the photos where the hero composition says they go. {{PHOTO_0}} is the strongest, most representative shot, so give it the most important image slot that composition defines.`
    : `This composition has NO photograph above the fold — that is deliberate. Do not put any image in the hero. Open with {{PHOTO_0}} in the first section below the fold and place the rest in supporting sections.`;

  // Shape matters as much as subject: these are phone photos from Google, usually
  // TALL. Stretched across a full-bleed band they upscale into mush and crop the
  // subject out. The designer cannot see them, so it must be told.
  const shapeFor = (i: number) => (photoShapes[i] ? ` [${photoShapes[i]}]` : "");
  const shapeRule =
    `RESPECT EACH PHOTO'S SHAPE. A portrait photo belongs in a portrait-shaped slot — a tall column, a side-by-side pair, an offset card, a framed inset. Do NOT stretch one across a wide full-bleed band: it will be upscaled far past its pixel width and its subject cropped away. Only a landscape photo may fill a wide banner. If every photo is portrait and the composition wants a wide band, use a row of tall frames instead of one stretched image, or let the band be type/colour led with the photos beside it.`;

  const photoBlock =
    photoCount > 0 && photoCaptions.length === photoCount
      ? `You have ${photoCount} real photo(s) of this business. Here is what each shows and its shape in pixels (you cannot see them):\n` +
        photoCaptions
          .map((c, i) => `- {{PHOTO_${i}}}${shapeFor(i)}: ${c || "(no caption)"}`)
          .join("\n") +
        `\nUse these EXACT placeholder tokens; each is replaced with the real photo. ${placementRule} ${shapeRule} ` +
        `Choose crops and focal points that flatter each photo's subject.`
      : photoCount > 0
        ? `You have ${photoCount} real photo(s) of this business, with these shapes:\n` +
          Array.from({ length: photoCount }, (_, i) => `- {{PHOTO_${i}}}${shapeFor(i)}`).join("\n") +
          `\nUse these EXACT placeholder tokens where you want them. Each will be replaced with the real image. ${placementRule} ${shapeRule}`
        : `No photos are available — design a strong type-led hero with no image holes.`;

  // `null` marks a line that dropped out because its data is missing; `""` is a
  // deliberate blank separator. Filtering only nulls keeps the section breaks,
  // which matters now that the brief carries most of the design instruction.
  return [
    artDirectionBrief(direction),
    ``,
    `LANGUAGE (write everything in this): ${languageName}`,
    ``,
    `Business name (raw, from Google): ${details.name}`,
    `Business type: ${theme.label}${details.primaryTypeDisplayName ? ` (${details.primaryTypeDisplayName})` : ""}`,
    details.categories.length ? `Google categories: ${details.categories.slice(0, 6).join(", ")}` : null,
    details.address ? `Address: ${details.address}` : null,
    details.phone ? `Phone (use in a tel: link CTA): ${details.phone}` : null,
    details.rating != null
      ? `Google rating: ${details.rating} from ${details.reviewCount} reviews (use as social proof)`
      : null,
    priceLabel ? `Price positioning (a tone hint — do NOT print a price): ${priceLabel}` : null,
    hoursBlock || null,
    ``,
    insightBlock,
    ``,
    photoBlock,
    mapBlock || null,
    ``,
    `Now design and return the complete HTML document for this business, executing the art direction above exactly — the palette hex values, the named typefaces, the hero composition, and the motion choreography.`,
  ]
    .filter((l): l is string => l !== null)
    .join("\n");
}

/**
 * The exact design brief the API path sends, assembled with NO API calls so it can
 * be pasted into a chat UI by hand.
 *
 * It deliberately skips the two Haiku enrichment passes (photo captioning, review
 * mining) because those are themselves billable calls. The prompt degrades to raw
 * review snippets and uncaptioned photo placeholders — precisely what the API path
 * produces when those passes fail, so the output contract is unchanged.
 */
export function buildManualDesignPrompt(
  details: NormalizedPlaceDetails,
  searchHint: string,
  photos: string[],
  hasMap: boolean,
  variant = 0,
): { system: string; user: string } {
  const direction = artDirectionFor(details.placeId || details.name, variant, photos.length > 0);
  const languageName = LANGUAGE_NAME[detectLocale(details)] ?? "English";
  return {
    system: SYSTEM,
    user: buildUserPrompt(
      details,
      searchHint,
      photos.length,
      languageName,
      [],
      describePhotoShapes(photos),
      null,
      hasMap,
      direction,
    ),
  };
}

/**
 * Swap photo/map placeholders for real data URIs, blanking any token the model
 * invented or left unused so no broken image reference ships. Shared by the API
 * path and the manual paste-back route.
 */
export function applyPlaceholders(
  html: string,
  photos: string[],
  mapUri: string | null,
): string {
  let out = html;
  photos.forEach((uri, i) => {
    out = out.split(`{{PHOTO_${i}}}`).join(uri);
  });
  out = out.replace(/\{\{PHOTO_\d+\}\}/g, "");
  if (mapUri) out = out.split("{{MAP}}").join(mapUri);
  return out.split("{{MAP}}").join("");
}

/** Strip accidental markdown fences / preamble and return the raw HTML document. */
export function extractHtml(text: string): string | null {
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
  variant = 0,
): Promise<string | null> {
  if (!env.anthropicApiKey) return null;

  // Seeded per business so a lead's site is stable across rebuilds, but `variant`
  // lets a manual regeneration re-roll it — previously the direction was a pure
  // function of placeId, so an unlucky draw could never be escaped.
  const direction = artDirectionFor(details.placeId || details.name, variant, photos.length > 0);

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
    photos.length
      ? describePhotos(client, photos, theme.label, details.placeId)
      : Promise.resolve(null),
    analyzeReviews(client, details.reviewSnippets, theme.label, languageName, details.placeId),
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
      max_tokens: DESIGN_MAX_TOKENS,
      thinking: { type: "adaptive" },
      output_config: { effort: DESIGN_EFFORT },
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
            describePhotoShapes(orderedPhotos),
            insight,
            Boolean(mapUri),
            direction,
          ),
        },
      ],
    });
    const message = await stream.finalMessage();
    await recordAiUsage("preview_design", env.anthropicModel, message.usage, details.placeId);

    if (message.stop_reason === "refusal") {
      console.warn(
        `[aiSite] design refused for ${details.placeId} (${message.stop_details?.category ?? "no category"}) — falling back to template`,
      );
      return null;
    }
    if (message.stop_reason === "max_tokens") {
      console.warn(
        `[aiSite] design hit max_tokens for ${details.placeId} — HTML is likely truncated; raise DESIGN_MAX_TOKENS`,
      );
    }
    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    const html = extractHtml(text);
    if (!html) return null;

    // orderedPhotos, so {{PHOTO_0}} resolves to the hero the vision pass selected.
    return applyPlaceholders(html, orderedPhotos, mapUri);
  } catch (err) {
    console.error(`[aiSite] generation failed for ${details.placeId}:`, err);
    return null;
  }
}
