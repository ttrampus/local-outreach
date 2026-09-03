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
import { photoShapes, describeShape, hasLandscape } from "./photos";
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
- You MAY and SHOULD write inline <svg> directly in the markup — icons, rules, marks, decorative paths. Inline SVG is not an external reference and is the only way to put iconography on this page, since icon fonts and icon libraries are unreachable. See the ICON SYSTEM in the art direction below.

THE ART DIRECTION BELOW IS A SPECIFICATION, NOT A SUGGESTION:
- The PALETTE gives exact hex values. Use them verbatim as your CSS custom properties. Do not tint, shade-shift, substitute, or "improve" them, and do not introduce a background colour that is not derived from them. If the palette is dark, the page is dark; if it is light, the page is light.
- LEGIBILITY OVERRIDES EVERYTHING. Text is either the palette's ink (primary) or muted (secondary). White or near-white text is allowed ONLY on a surface you have actually filled with the accent colour or a dark colour — never on the page background of a LIGHT palette, where it is invisible. This is the single most common way these designs fail, and it fails silently: the markup looks correct and the page renders blank. Before finishing, walk every text element and check its colour against the background it will really render on — nav links, hero sub-headlines, button labels, stat/rating blocks, and any two-tone headline where one span is coloured differently. If a composition calls for text on a coloured field, you must actually paint that field; do not style the text as though the field exists.
- The TYPE SET names exact families and weights. Load exactly those from Google Fonts and use them. NEVER use Inter, Roboto, Arial, Helvetica, system-ui, or Space Grotesk.
- The COMPOSITION defines the structure of the first screen, including where photography goes. Build that structure. Its "forbids" line is absolute.
- The SURFACE TREATMENT defines the texture of the page ground, with literal CSS. Implement it. A flat single-colour background is a failure of this brief no matter how good the layout on top of it is.
- The MOTION signature defines the animation choreography. Implement it as written, with those durations and easing curves.

ANTI-CONVERGENCE — resist your own defaults. You have a strong, persistent house style that you must NOT fall back into:
- THE EDITORIAL TRAP: cream ground + serif display + terracotta accent. This is a legitimate direction for a hospitality or portfolio brief chosen deliberately — but it is also the current default-template look, and reaching for it by reflex is what makes a page read as generated. Only build it if the palette below actually specifies it.
- A warm cream / off-white / bone background in the #F0EDE4–#F7F4EC range. Do not use any background in that range unless the palette below explicitly specifies one.
- Oversized near-black display type on the left with a photograph filling the right half, and a dark pill-shaped CTA button at the top right of the nav. This exact composition is your default and it is banned unless the composition below actually asks for a split.
- Terracotta, rust, burnt-orange or amber accents on a cream ground.
- A serif display face with one word italicised for emphasis.
- A horizontal scrolling marquee / ticker-tape band of service keywords. This is an instantly recognisable AI-site tell.
- A hairline-thin high-contrast "fashion editorial" serif (Didone) headline over a rounded geometric sans, with tiny wide-tracked caps labels and vast empty margins. Use the type set you are given, at the weights given, and set it with confidence rather than preciousness.
- A first screen that is 60% empty ground with one line of type floating in the middle of it. Emptiness is not sophistication. Every screen must carry its weight: the fold should hold the name, the value proposition, the CTA, the rating AND either photography or real supporting detail (hours, location, proof points).
These are not stylistic preferences — they are the specific fingerprints that make generated sites look mass-produced. The palette and composition you are given exist to move you off them. Follow those instead.

DESIGN BAR:
- Make it memorable and cohesive — two businesses must never feel like the same template.
- NEVER use generic AI-slop aesthetics: no purple-on-white gradients, no cookie-cutter three-equal-cards layout unless you make it genuinely interesting, no centered-everything (unless the composition calls for it). Use asymmetry, overlap, generous negative space or controlled density, real hierarchy.
- BUILD ATMOSPHERE — THE GROUND ITSELF MUST HAVE SOMETHING IN IT. This site is the portfolio piece for a business that sells websites, so a bare expanse of one colour with text floating on it is disqualifying. Implement the surface treatment above, and layer on top of it the things real sites use to keep a long scroll alive: sections that alternate ground and surface tone, panels and cards with real edges and shadow, one or two oversized display elements bleeding off the viewport edge, a coloured band that breaks the page in two, hairlines and borders that give structure. Depth comes from layers — ground, texture, panel, content — not from one flat plane.
- Every full-width band you leave in the plain background colour is a band you have not designed. If a stretch of page has nothing in it but the ground colour, put the texture, a panel, an image, or real content there — or remove the height.
- MOTION IS REQUIRED, not optional, and it is a headline feature of this site. Implement the given motion signature: the hero entrance, the scroll behaviour, and the hover feedback. Use CSS transitions/animations and a small IntersectionObserver where needed; keep it smooth (transform and opacity only — never animate layout properties).
- MOTION MUST REACH THE WHOLE PAGE, not just the hero. Beyond the signature's entrance, the finished page is expected to have: staggered scroll-reveals on each section's content (small delays down a group, not all at once); real hover states on every interactive thing — service rows, gallery tiles, cards, nav links, buttons — that move, lift, underline or shift colour; a sticky header that changes on scroll (solidifies, shrinks, or gains a rule) so it never floats illegibly over later sections; and considered focus states for keyboard users. A gentle parallax or scale-on-reveal for photography is welcome. Do not animate more than one property group per element, keep durations in the 200–800ms range, and never let motion delay the reader's access to content.
- EVERY animation stays behind \`@media (prefers-reduced-motion: no-preference)\` per the constraint above, and any element you reveal on scroll MUST be fully visible in the base CSS. An element left at opacity:0 outside that media query is invisible to anyone whose observer never fires.
- CRITICAL MOTION CONSTRAINT: the hero is screenshotted with \`prefers-reduced-motion: reduce\`. Gate EVERY entrance and scroll animation behind \`@media (prefers-reduced-motion: no-preference)\` and author the base (un-animated) CSS as the finished, settled state described in the signature. A reduced-motion render must show a complete, fully-visible hero — never blank, never mid-fade, never at opacity 0.
- MOBILE IS THE PRIMARY VIEWPORT, NOT AN AFTERTHOUGHT. This page is reached from a link in an email, and that email is read on a phone — so more of these are opened at 390px than at 1280px, and a page that is beautiful on desktop but awkward on a handset has failed with most of the people who will ever see it. Design the phone layout deliberately; do not merely let the desktop one reflow and hope.
- NOTHING MAY EXCEED THE VIEWPORT WIDTH AT 390px. A page that scrolls sideways is the single most damning mobile failure — it reads as broken, not as unfinished. The usual causes, all of which are yours to prevent: fixed pixel widths on containers, display type set in fixed px so a long business name overflows, multi-column grids that never collapse, images and iframes without \`max-width:100%\`, \`white-space:nowrap\` on real sentences, tables that do not scroll inside their own container, and decorative elements pushed right with negative margins. Anything deliberately bled off-screen must be \`position:fixed\` or clipped by a parent with \`overflow:hidden\` so it cannot widen the document.
- SCALE THE TYPE, DON'T JUST SHRINK IT. Every display size uses \`clamp()\` (or an explicit mobile override) so the largest headline is comfortable at 390px — a 96px hero headline that stays 96px on a phone wraps into two or three unreadable words per line. Body copy never drops below 16px on any viewport, and line length on mobile should land around 30-45 characters, not 20.
- COLLAPSE THE LAYOUT, AND CUT THE PADDING WITH IT. Multi-column sections become one column below ~700px. Section padding that reads as generous at 1280px (100-160px vertical) becomes a screenful of empty background on a phone — roughly halve it. The density rules above apply at 390px too: no bare band taller than about half the viewport.
- TAP TARGETS ARE AT LEAST 44px TALL and spaced far enough apart to hit with a thumb. Buttons, nav items, service rows, phone and email links — all of them. A 24px text link in a list is a miss-tap.
- THE HERO PHOTO MUST STILL BE VISIBLE within the first screen at 390x844, per the photo rule below. Not pushed under a full-height headline block.
- Then check your own work at 390px before you finish: is anything wider than the screen, is any text under 16px, does the hero still work, is any section mostly empty?
- PHOTOS — you cannot see the photos; a short caption for each is provided below. Place them where the COMPOSITION says they go — that instruction outranks any instinct to lead with a big photo. Never put a photo whose caption is a close-up of equipment, a logo, a sign, a menu/receipt, or anything unflattering into a hero or full-bleed position. Whatever photo fills a hero or banner: use \`background-size:cover\` with a sensible focal point (\`background-position\`), give it real height, and NEVER let an overlapping badge, card, or text block clip the photo's main subject or get clipped itself — keep overlays clear of the focal area.

CONTENT RULES:
- Write EVERY visible word in the business's language (given below). It must be grammatically correct and idiomatic — sound like a native speaker wrote it, not translated. Get agreement, case, and number right (e.g. in Slovenian the natural word for hair is the plural "lasje", not the singular "las"). Before finalizing, re-read every headline and tagline and fix any grammatical slip: a wrong word in a giant hero headline instantly destroys credibility.
- Derive a clean, confident DISPLAY NAME for the brand: drop legal forms (s.p., d.o.o., d.d., Ltd…) and generic category words; you may keep the full legal name small in the footer.
- Use the real rating and review count as social proof, and quote/adapt the real review snippets provided. Invent nothing factual (no fake awards, prices, or services beyond the generic category-appropriate ones).
- Include clear conversion elements: a prominent primary CTA (book/call — use the phone number in a tel: link), the services a business of this type offers, location/area, opening hours (use the REAL hours when they are provided below — verbatim, do not invent different ones; otherwise "by appointment"), and a contact section.
- PAGE INVENTORY — build a COMPLETE page, not a landing splash. Below the hero you must include, at minimum, all of: (1) services — every service a business of this category plausibly offers, each with a real one-line description, not three bare nouns; (2) an about/why-us section grounded in what the reviews actually say; (3) social proof — the real rating, review count, and two or three real review quotes, attributed as Google reviews; (4) every photo you were given, placed somewhere it flatters (a gallery is fine — do not leave supplied photos unused); (5) opening hours in full; (6) location — the address, the area, and the map if one is offered; (7) the contact section with the form. Where the business supports it, also add a process/how-a-visit-works section, staff, or a short FAQ answering what a real customer would actually phone to ask (parking, walk-ins, how long a colour takes, card payment). Eight to eleven distinct sections is the right size for this page. Four is a stub.
- The point of the inventory is substance, not padding: every item above is REAL information you were given or can state without inventing. If you cannot fill a section with real content, drop the section rather than padding it — but you should rarely need to, because the material above is genuinely there.
- WORKING CONTACT FORM: place the literal token {{CONTACT_FORM}} exactly once, inside your contact section, where a "get in touch" form belongs. It is replaced with a real, functioning enquiry form. Do NOT build your own <form> — just output the {{CONTACT_FORM}} token in the right spot (you may still keep tel:/email CTAs alongside it). This token is MANDATORY and it must sit inside a real styled section, above the footer, with the surrounding layout (heading, hours, address, map) designed around it. If you omit it the form gets appended in a fallback position as an unstyled stray box below the copyright line — which has happened, and it makes the one element that has to convert look bolted on. The form inherits its colours from whatever you place it in, so give it a container with a defined background and text colour. It also renders with its OWN heading ("Pišite nam" / "Get in touch") and its own submit button — so do not put a second heading of the same meaning directly above the token, and do not add your own send button beside it. Title the surrounding section something different (the location, the invitation to book, the business name), or let the form's heading stand alone.
- When a list of what customers actually praise is provided, weave those real specifics into the headlines, about copy and service blurbs — that is what makes the site feel written for THIS business. Mention named staff naturally if given. Still invent nothing factual beyond what's provided.
- THE HERO HEADLINE SAYS WHAT THE BUSINESS IS. It is the first thing the owner reads, and it has to sound like something they would actually put on their own sign — not like a copywriter's award entry. Name the trade, the place, the specialism, or the promise, in plain words the owner would use to a customer standing in front of them.
- NEVER INVENT A POETIC SLOGAN, and never build the headline out of a metaphor, a personification, or an abstraction. This is currently the single worst thing in the output. Real examples produced by this system, all of them wrong: "Lasje, ki vas poslušajo" (hair that listens to you), "Lasje, ki so zgrajeni po meri" (hair built to measure). They are meaningless, faintly absurd in the business's own language, and an owner reads them as proof that a machine wrote the page. The test is blunt: if the subject of the sentence is an inanimate thing doing something it cannot do, or if the line would make the owner laugh or wince when read aloud to a customer, delete it and write what the business actually is. Do not merely soften the metaphor — remove it.
- Good hero headlines for a hair salon, as a calibration: "Frizerski salon v starem Mariboru", "Barvanje in balayage, brez naročanja tedne vnaprej", "Salon Meri Arifi — striženje, barvanje, nega", or simply the business's own name set large with the real specialism under it. All of them are ordinary. Ordinary and true beats clever and hollow every single time, and the design — not the wordplay — is what makes the page look expensive.
- The same rule governs section headings and taglines: no "Vaša pot do...", no "Kjer se X sreča z Y", no line whose meaning evaporates when you ask what it literally claims.
- The HERO PATTERN below decides what the first screen says and in what order. Build that, including the thing it omits — the omission is the point. Do not reinstate a missing element "for completeness": anything the pattern leaves out belongs further down the page, or nowhere.

BANNED HERO FURNITURE — these six things appeared, together and in this order, on every site this system has produced. They are the reason the output reads as machine-made even when the palette and typeface change. Do not use them unless the hero pattern explicitly calls for one:
- A small wide-tracked uppercase eyebrow line above the headline carrying the category and address ("SALON · NA JAMI 20"). Never open with one.
- A two-line headline whose second line is set in the accent colour.
- A headline that ends in a full stop for punch, or that is built as two terse fragments ("Well cut. Every time.").
- A supporting paragraph with exactly one phrase bolded in the middle of it.
- A filled primary button paired with a ghost/outline secondary carrying an arrow glyph.
- A rating stat block — big number, star row, review count — parked in a corner of the fold.
- A NAVIGATION LIST WITH TWO-DIGIT NUMBERS BESIDE EACH ITEM ("01 Services / 02 About / 03 Contact"). This is one of the most recognisable generated-site tells in existence and it must never appear. Navigation is words. Even when the art direction below specifies a numeral system or numbered figures, those numbers belong on SERVICES, process steps or section headings — never on the nav.
- A hero headline that is a poetic slogan rather than a plain statement of what the business is. See the headline rules above; this is the most common single failure in the current output.
- PURPLE OR VIOLET ANYWHERE THAT THE PALETTE DID NOT GIVE YOU. No violet or lavender tints, washes, shadows, hover states, icon fills or "accessible purple" substitutions. Purple-on-white is the most recognisable generated-page signature there is, and this system's palettes deliberately exclude it — do not reintroduce it. Use only the hex values in the palette you were given.
- A large, soft, coloured gradient field behind the hero — a mesh gradient, an aurora wash, overlapping blurred colour blobs, or a hero whose background is a gradient between two accent hues. Gradients are permitted ONLY as hairline seams, as masks on a pattern, or as a scrim over a photograph for legibility. A gradient must never be the visible ground of a section, whatever the colours.
Vary the shape of the copy as well as its content: not every business gets a headline, not every fold needs a button, and the rating does not have to appear above the fold at all.

CRAFT DISCIPLINE — the difference between a designed page and a generated one is usually measurable, not mystical:
- SPACING SCALE. Every margin, padding and gap comes from one scale: 4, 8, 16, 24, 40, 64, 96, 160px (clamp() between scale values for fluid sections is fine). Arbitrary values — 7px, 18px, 22px — are the single clearest tell that spacing was improvised per element rather than designed as a system.
- TYPE SCALE. Body and UI text come from a fixed ramp: 14, 16, 18, 20, 24, 30, 36, 48px. The display face is the ONE exception and may scale fluidly above it per the treatment given. Body text is never below 16px, on any viewport. Similar sizes flatten hierarchy — if two things matter differently, size them differently.
- TONED NEUTRALS. Never pure #FFFFFF on pure #000000. Use the palette's values as given; they are already toned.
- ONE PRIMARY ACTION per screen. A first-time visitor must know what to do within five seconds. Competing equal-weight CTAs cause hesitation and are why so many of these pages feel busy but inert.
- RHYTHM, NOT REPETITION. Three sections sharing a layout and a fourth that deliberately breaks it creates rhythm. Four identical sections is monotony; four unrelated ones is chaos.
- DO NOT CENTRE EVERY SECTION. Stacking centred-eyebrow / centred-heading / centred-paragraph down the whole page is the laziest possible rhythm and it is what the current output does. Vary the axis: full-bleed bands against inset ones, asymmetric two-column splits, an offset image, a list set hard left, a wide pull-quote. At most two consecutive sections may share the same alignment.
- ALTERNATE THE GROUND. Adjacent sections should not all sit on the identical background. Move between the palette's bg and surface values (and the accent for one deliberate band) so the page reads as composed blocks rather than one endless sheet — this is also what stops a long page from looking like empty background with text floating on it.
- Set \`text-wrap: pretty\` on headlines and \`text-wrap: balance\` on short centred text so nothing ends in a widow.
- FILL THE FOLD VERTICALLY. Content must be distributed across the whole first screen, not anchored to one edge of it. No single empty band taller than about a quarter of the viewport anywhere in the hero — top, middle or bottom. If your composition anchors the headline low, something real (nav, meta, photography, hours, a rating line) has to occupy the space above it. A hero that opens on a third of a screen of untouched background looks unfinished, not confident, and it is the most common way these pages fail even when every other rule is followed.
- THE SAME DENSITY RULE APPLIES BELOW THE FOLD, AND THIS IS WHERE IT IS USUALLY BROKEN. Every section after the hero must earn its height the same way the hero does. Concretely: a section that is ~900px tall needs roughly a screen's worth of real substance in it — a heading plus one short paragraph is NOT enough to justify 900px, and stretching it there with padding produces a band of bare background that reads as a broken or unfinished page. Either give the section enough real content to fill the height, or make the section shorter. Sections have been shipped from this system at 1100px tall carrying 150 characters, and one at 3800px tall carrying 500 — that is the single most visible failure mode in the current output. Never let a run of bare background taller than about half a viewport appear between two pieces of content, anywhere on the page.
- VERTICAL PADDING IS NOT A DESIGN. Section padding comes from the spacing scale and tops out around 96–160px. If you find yourself setting min-height:100vh on a section whose content is a heading and three words, the section is wrong, not the padding.
- CUT FILLER. No decorative dividers that separate nothing, no "learn more" that goes nowhere, no headline and subheading restating each other, no invented statistics, no emoji used as decoration. If a section looks empty, that is a composition problem — fix the layout, do not pad it with invented content. Oversized whitespace is procrastination, not breathing room. Note that cutting filler means cutting the *height* along with the empty words — not leaving the empty band behind.

VOICE — write like the owner would, not like an agency pitching them. Concrete over abstract: opening hours, the street, what a cut costs, how long the wait is, who does the work. Ban the agency register entirely — no "elevate", "crafted", "experience" as a noun, "where X meets Y", "your journey", "redefining", "excellence". A sentence that could sit on any other business's site in this category is a failed sentence.`;

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
    `HERO COMPOSITION "${d.composition.id}" — the STRUCTURE of the first screen:`,
    `  ${d.composition.structure}`,
    `  FORBIDDEN here: ${d.composition.forbids}`,
    ``,
    `HERO PATTERN "${d.hero.id}" — what the first screen SAYS, and what it leaves out:`,
    `  ${d.hero.content}`,
    `  DELIBERATELY OMITTED: ${d.hero.omits}`,
    `  Build the omission. Do not add the missing element back.`,
    ``,
    `SURFACE TREATMENT "${d.surface.id}" — the page ground is NOT a flat fill. Build this:`,
    `  css: ${d.surface.css}`,
    `  usage: ${d.surface.usage}`,
    `  Keep it static (no animation) — the screenshot is taken with reduced motion, so the texture must be in that frame. Keep it subtle enough that body text stays comfortably readable over it.`,
    ``,
    `MOTION SIGNATURE "${d.motion.id}" — implement this choreography:`,
    `  entrance: ${d.motion.entrance}`,
    `  on scroll: ${d.motion.scroll}`,
    `  on hover: ${d.motion.hover}`,
    `  SETTLED STATE (what the un-animated / reduced-motion CSS must show): ${d.motion.settled}`,
    ``,
    `PAGE RHYTHM "${d.rhythm.id}" — the structure BELOW the fold, which is as specified as the hero:`,
    `  section order: ${d.rhythm.sequence}`,
    `  grounds: ${d.rhythm.grounds}`,
    `  the deliberate break: ${d.rhythm.breaks}`,
    `  Follow this order. A section the sequence omits belongs nowhere on the page; one it names must be built.`,
    ``,
    `ICON SYSTEM "${d.icons.id}" — you must HAND-BUILD these as inline <svg> in the markup:`,
    `  ${d.icons.spec}`,
    `  usage: ${d.icons.usage}`,
    `  You cannot link an icon font or an icon library — the output contract forbids every external resource except Google Fonts. Draw the paths yourself. Do NOT substitute emoji, dingbats, or star/arrow characters for icons: an emoji where an icon belongs is one of the most recognisable marks of a generated page. Every icon on the page comes from this one system, at one weight and one size.`,
    ``,
    `SIGNATURE DETAIL "${d.signature.id}" — build this exactly, and build it well:`,
    `  ${d.signature.spec}`,
    `  This is the one element on the page that no template would ever produce, and it is the difference between a page that was assembled and a page that was designed. It must be genuinely crafted — correctly aligned, correct at every viewport, and integrated into the layout rather than dropped on top of it. Build this ONE detail properly rather than scattering several half-made flourishes.`,
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
    ? `Place the photos where the hero composition says they go. {{PHOTO_0}} is the strongest, most representative shot, so give it the most important image slot that composition defines. NON-NEGOTIABLE: {{PHOTO_0}} must be visibly rendered within the first screen — inside the top 1000px at a 1280px-wide viewport, and still visible on a 390x844 phone. The owner opens this mockup and has to see their own place immediately; a hero they have to scroll to find reads as a stock placeholder. It must be a real, substantial image area, not a thumbnail tucked into a corner.`
    : `This business has no usable photography, so the composition is deliberately type-led. Do not leave any broken or empty image holes — carry the first screen with type, colour and texture.`;

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
export async function buildManualDesignPrompt(
  details: NormalizedPlaceDetails,
  searchHint: string,
  photos: string[],
  hasMap: boolean,
  variant = 0,
): Promise<{ system: string; user: string }> {
  const shapes = await photoShapes(photos);
  const theme = pickTheme(details.categories, searchHint);
  const direction = artDirectionFor(details.placeId || details.name, variant, {
    palettes: theme.palettes,
    typeSets: theme.typeSets,
    hasAny: photos.length > 0,
    hasLandscape: hasLandscape(shapes),
  });
  const languageName = LANGUAGE_NAME[detectLocale(details)] ?? "English";
  return {
    system: SYSTEM,
    user: buildUserPrompt(
      details,
      searchHint,
      photos.length,
      languageName,
      [],
      shapes.map(describeShape),
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

export interface AiSiteResult {
  /** Placeholders substituted for real bytes — the document that ships. */
  html: string;
  /**
   * The same document with {{PHOTO_n}} / {{MAP}} still in place. This is what the
   * static audit scans: `html` carries the photos as base64 data URIs and runs to
   * well over a megabyte, so scanning it means walking that payload for nothing,
   * and the {{CONTACT_FORM}} token the audit checks for is only visible here.
   */
  rawHtml: string;
  /** The brief this was built from — the critique scores against it. */
  direction: ArtDirection;
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
): Promise<AiSiteResult | null> {
  if (!env.anthropicApiKey) return null;

  const locale = detectLocale(details);
  const languageName = LANGUAGE_NAME[locale] ?? "English";
  const client = new Anthropic({ apiKey: env.anthropicApiKey });
  const theme = pickTheme(details.categories, searchHint);

  // Shapes gate the direction as well as brief the designer: a composition that
  // demands a wide full-bleed image must not be drawn when every photo is portrait.
  const shapes = await photoShapes(photos);

  // Seeded per business so a lead's site is stable across rebuilds, but `variant`
  // lets a manual regeneration re-roll it — previously the direction was a pure
  // function of placeId, so an unlucky draw could never be escaped.
  const direction = artDirectionFor(details.placeId || details.name, variant, {
    palettes: theme.palettes,
    typeSets: theme.typeSets,
    hasAny: photos.length > 0,
    hasLandscape: hasLandscape(shapes),
  });

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
  let orderedShapes = shapes;
  let photoCaptions: string[] = [];
  if (notes) {
    const { hero, captions } = notes;
    // Shapes are per-photo, so they must ride along with the reorder — otherwise
    // the brief would describe each slot with the wrong photo's dimensions.
    const heroFirst = <T,>(arr: T[]) => [arr[hero], ...arr.filter((_, i) => i !== hero)];
    orderedPhotos = heroFirst(photos);
    orderedShapes = heroFirst(shapes);
    photoCaptions = heroFirst(captions);
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
            orderedShapes.map(describeShape),
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

    const rawHtml = extractHtml(text);
    if (!rawHtml) return null;

    return {
      // orderedPhotos, so {{PHOTO_0}} resolves to the hero the vision pass picked.
      html: applyPlaceholders(rawHtml, orderedPhotos, mapUri),
      rawHtml,
      direction,
    };
  } catch (err) {
    console.error(`[aiSite] generation failed for ${details.placeId}:`, err);
    return null;
  }
}

