// Concrete art-direction pools shared by both preview engines.
//
// WHY THIS IS SPEC AND NOT PROSE: the design model has a strong, well-documented
// house style — warm cream/off-white ground (~#F4F1EA), serif display, italic
// word-accents, terracotta/amber accent. Adjectival briefs ("light & airy",
// "warm organic") get resolved straight back into it: every site we generated
// with an adjective brief came out on #f4efe4 / #f4ede0 / #f4f0e6 / #f4f2ee.
// Exact hex values, named families with weights, and explicit structural
// constraints are followed literally. So everything here is literal.
//
// There is no sampling escape hatch either: temperature/top_p/top_k are rejected
// with a 400 on the current model family, so ALL variation has to come from here.

export type PaletteMode = "light" | "dark";

export interface Palette {
  id: string;
  mode: PaletteMode;
  bg: string;
  surface: string;
  ink: string;
  muted: string;
  border: string;
  accent: string;
  accent2: string;
}

/**
 * 25 fully-specified palettes, deliberately weighted AWAY from the model's
 * default ground. Only `linen-navy` and `bone-forest` are warm cream, and both
 * pair it with a navy/green accent rather than the terracotta the default
 * reaches for; `stone-oxide` is a warm neutral grey rather than a true cream.
 * The other pale grounds are tinted cool (mint, sky, lilac) or pure white.
 *
 * Contrast is verified, not assumed: every `ink` clears 7:1 on its own `bg`,
 * every `muted` clears 4.5:1, and every `accent` clears 3:1.
 */
export const PALETTES: Palette[] = [
  // ── Dark ────────────────────────────────────────────────────────────────
  { id: "obsidian-lime",   mode: "dark",  bg: "#0A0C0A", surface: "#141814", ink: "#EAF2E6", muted: "#94A08E", border: "#232B22", accent: "#B6FF3B", accent2: "#5E8438" },
  { id: "midnight-signal", mode: "dark",  bg: "#0B0E14", surface: "#141A24", ink: "#E8EEF5", muted: "#94A2B4", border: "#222C3A", accent: "#4ADE80", accent2: "#F472B6" },
  { id: "ink-cobalt",      mode: "dark",  bg: "#050505", surface: "#101010", ink: "#F2F2F2", muted: "#969696", border: "#1E1E1E", accent: "#3B6BFF", accent2: "#C6D4FF" },
  { id: "forest-brass",    mode: "dark",  bg: "#0C1410", surface: "#14201A", ink: "#E7F0E9", muted: "#93A99C", border: "#22322A", accent: "#D4AF37", accent2: "#6B8E76" },
  { id: "carbon-ember",    mode: "dark",  bg: "#121212", surface: "#1C1C1C", ink: "#EDEDED", muted: "#A2A2A2", border: "#2A2A2A", accent: "#FF5A1F", accent2: "#FFB38A" },
  { id: "abyss-coral",     mode: "dark",  bg: "#04191C", surface: "#082A2F", ink: "#E3F5F4", muted: "#8CB2B1", border: "#103B41", accent: "#FF6B5A", accent2: "#4FD1C5" },
  { id: "oxblood",         mode: "dark",  bg: "#1A0A0C", surface: "#261115", ink: "#F6E7E7", muted: "#B89797", border: "#3A1D22", accent: "#E23E57", accent2: "#F0C05A" },
  // accent was #FFFFFF: not an accent at all, and when a composition painted a
  // field in it the "dark" page rendered as a full-screen white void.
  { id: "graphite-mono",   mode: "dark",  bg: "#1A1A1A", surface: "#242424", ink: "#FAFAFA", muted: "#A8A8A8", border: "#333333", accent: "#FF3B30", accent2: "#C7CBD1" },
  // accent2 was #D946EF (fuchsia). Orange + fuchsia on a plum ground is the
  // "sunset gradient" duo, and with a gradient surface treatment it rebuilt the
  // exact hero this whole file exists to prevent. Amber holds the sunset idea
  // without the second magenta pole that makes it read as a gradient.
  { id: "sunset-duo",      mode: "dark",  bg: "#1B1020", surface: "#291733", ink: "#FBEEF7", muted: "#AF97B9", border: "#3D2449", accent: "#FF8A3D", accent2: "#FFC24D" },

  // ── Jewel / saturated ───────────────────────────────────────────────────
  { id: "emerald-gold",    mode: "dark",  bg: "#06231C", surface: "#0B3229", ink: "#EAF7F1", muted: "#8FBCAB", border: "#14493C", accent: "#F2C14E", accent2: "#34D399" },
  { id: "sapphire-ice",    mode: "dark",  bg: "#071634", surface: "#0D2249", ink: "#E6EEFF", muted: "#98ACD0", border: "#17325F", accent: "#7DD3FC", accent2: "#FBBF24" },
  // WAS violet-acid (#150B2E violet ground) and plum-noir (#12070F plum), both
  // removed: purple is out of the system entirely, ground and accent alike. It
  // is the hue that most reliably makes a page read as machine-made, and no
  // local business in this pipeline has ever wanted one.

  // ── Light, non-cream ────────────────────────────────────────────────────
  { id: "paper-cobalt",    mode: "light", bg: "#FFFFFF", surface: "#F4F6FB", ink: "#0A1633", muted: "#5A6785", border: "#DDE3F0", accent: "#1D4ED8", accent2: "#F97316" },
  { id: "mint-clinic",     mode: "light", bg: "#F2FBF7", surface: "#FFFFFF", ink: "#08241A", muted: "#4B7362", border: "#CFE9DE", accent: "#059669", accent2: "#0F766E" },
  { id: "blush-ink",       mode: "light", bg: "#FDF2F4", surface: "#FFFFFF", ink: "#2A0E16", muted: "#805C68", border: "#F2D6DC", accent: "#E11D48", accent2: "#7C2D4B" },
  { id: "sky-slate",       mode: "light", bg: "#F1F6FC", surface: "#FFFFFF", ink: "#0F2233", muted: "#54697D", border: "#D6E4F0", accent: "#0284C7", accent2: "#F43F5E" },
  { id: "stone-oxide",     mode: "light", bg: "#F5F4F1", surface: "#FFFFFF", ink: "#1C1A17", muted: "#67635C", border: "#E2DFD8", accent: "#C2410C", accent2: "#3F6212" },
  // WAS lilac-graphite: bg #F6F4FD with a #6D28D9 violet accent. That is the
  // single most recognisable "made with AI" palette there is — violet-700 on a
  // near-white ground — and it was the most-drawn palette in the whole corpus.
  // Same structural role (a cool pale ground with one saturated accent), a hue
  // no starter template reaches for.
  { id: "slate-ink",       mode: "light", bg: "#F4F6F5", surface: "#FFFFFF", ink: "#141A18", muted: "#5B6663", border: "#DDE3E1", accent: "#0F5C4A", accent2: "#B4451F" },
  { id: "citrus-white",    mode: "light", bg: "#FFFFFF", surface: "#FAFAF7", ink: "#14140F", muted: "#646456", border: "#E6E6DC", accent: "#A16207", accent2: "#166534" },
  // was pure #000 on pure #FFF — harsh, cold, and it reads as unfinished rather
  // than as a deliberate monochrome. Toned a few points off each end instead.
  { id: "pure-mono",       mode: "light", bg: "#FAFAF9", surface: "#F0F0EE", ink: "#1A1A1A", muted: "#5C5C5A", border: "#DCDCD8", accent: "#1A1A1A", accent2: "#E60000" },

  // ── High-chroma pop ─────────────────────────────────────────────────────
  { id: "electric-pop",    mode: "light", bg: "#FFF9E8", surface: "#FFFFFF", ink: "#101010", muted: "#66614F", border: "#EDE3C6", accent: "#E63200", accent2: "#0047FF" },
  { id: "neo-mint-black",  mode: "light", bg: "#E8FFF4", surface: "#FFFFFF", ink: "#05140D", muted: "#4A6F5F", border: "#C7EEDB", accent: "#00844A", accent2: "#111111" },

  // ── Cream — capped at two, and neither is the terracotta default ────────
  { id: "linen-navy",      mode: "light", bg: "#F5F1E8", surface: "#FFFFFF", ink: "#0F1E3D", muted: "#5F6879", border: "#E2DCCC", accent: "#1E3A8A", accent2: "#B45309" },
  { id: "bone-forest",     mode: "light", bg: "#F4F2EC", surface: "#FFFFFF", ink: "#14251A", muted: "#5F6A61", border: "#E0DED4", accent: "#15803D", accent2: "#92400E" },
];

export interface TypeSet {
  id: string;
  /** Exact Google Fonts family + the weights to load and use. */
  display: string;
  body: string;
  /** How the display face should be set — sizing, casing, tracking. */
  treatment: string;
  /** True when the display family supports variable weight animation. */
  variableDisplay: boolean;
}

/**
 * 19 pairings. The previous pool was half heavy condensed grotesques, so half of
 * all leads landed on "giant black caps"; that cluster is capped at 4 here.
 * Inter / Roboto / Arial / system-ui / Space Grotesk stay banned in the prompt.
 *
 * NO DIDONES, and no soft geometric body faces. A high-contrast modern serif
 * (Gloock, Bodoni Moda, Playfair, Cormorant) set over a rounded geometric sans
 * (Mulish, Plus Jakarta Sans, Manrope) is *the* generated-site fingerprint —
 * hairline-thin stems, enormous tracking on tiny caps, oceans of white space.
 * Five of the seven faces the salon theme could draw were that pairing, so the
 * category that should look the most bespoke looked the most machine-made. The
 * serif display faces kept here (Fraunces, Young Serif, Newsreader, Petrona,
 * Zilla Slab) all have low-to-moderate stroke contrast and hold up at display
 * size without turning into filigree.
 */
export const TYPE_SETS: TypeSet[] = [
  // Heavy / condensed grotesque — capped at 4 of 19.
  { id: "anton-karla",        display: "Anton 400",                    body: "Karla 400,700",            treatment: "Display in ALL CAPS at 8-12vw, tracking -0.01em, line-height 0.92.", variableDisplay: false },
  { id: "archivo-commissioner", display: "Archivo Black 400",          body: "Commissioner 400,600",     treatment: "Display sentence case at 6-9vw, tracking -0.03em, line-height 0.95.", variableDisplay: false },
  { id: "bebas-figtree",      display: "Bebas Neue 400",               body: "Figtree 400,600",          treatment: "Display ALL CAPS at 9-14vw, tracking 0.02em, line-height 0.88.", variableDisplay: false },
  { id: "bigshoulders-public", display: "Big Shoulders Display 700,900", body: "Public Sans 400,600",    treatment: "Display ALL CAPS at 10-15vw, very tight line-height 0.82.", variableDisplay: true },

  // Expressive sans display.
  { id: "syne-epilogue",      display: "Syne 700,800",                 body: "Epilogue 400,600",         treatment: "Display sentence case at 5-8vw, tracking -0.02em, line-height 1.0.", variableDisplay: true },
  { id: "unbounded-dmsans",   display: "Unbounded 500,700",            body: "DM Sans 400,500",          treatment: "Display sentence case at 4.5-7vw, tracking -0.04em, line-height 1.05.", variableDisplay: true },
  { id: "bricolage-hanken",   display: "Bricolage Grotesque 600,800",  body: "Hanken Grotesk 400,600",   treatment: "Display sentence case at 5-9vw, tracking -0.03em, line-height 0.98.", variableDisplay: true },
  { id: "sora-rethink",       display: "Sora 600,800",                 body: "Rethink Sans 400,600",     treatment: "Display sentence case at 4.5-7vw, tracking -0.035em, line-height 1.02.", variableDisplay: true },
  { id: "outfit-karla",       display: "Outfit 600,800",               body: "Karla 400,600",            treatment: "Display sentence case at 5-8vw, tracking -0.03em, line-height 1.0.", variableDisplay: true },

  // Serif display — low/moderate stroke contrast only, sturdy sans bodies.
  { id: "fraunces-hanken",    display: "Fraunces 600,900",             body: "Hanken Grotesk 400,600",   treatment: "Display sentence case at 5-8vw, optical size high, line-height 0.98.", variableDisplay: true },
  { id: "dmserif-worksans",   display: "DM Serif Display 400",         body: "Work Sans 400,600",        treatment: "Display sentence case at 5.5-8.5vw, line-height 1.0.", variableDisplay: false },
  { id: "instrument-figtree", display: "Instrument Serif 400",         body: "Figtree 400,600",          treatment: "Display sentence case at 6-10vw, line-height 0.95, tracking -0.01em. Set it upright — no italic word-accents.", variableDisplay: false },
  { id: "youngserif-public",  display: "Young Serif 400",              body: "Public Sans 400,600",      treatment: "Display sentence case at 5-8vw, line-height 1.05, generous word spacing.", variableDisplay: false },
  { id: "newsreader-plex",    display: "Newsreader 500,700",           body: "IBM Plex Sans 400,600",    treatment: "Display sentence case at 5-8vw, line-height 1.02; newspaper-editorial, not fashion-editorial.", variableDisplay: true },
  { id: "petrona-franklin",   display: "Petrona 600,800",              body: "Libre Franklin 400,600",   treatment: "Display sentence case at 5-8.5vw, tracking -0.02em, line-height 1.0.", variableDisplay: true },
  { id: "zillaslab-barlow",   display: "Zilla Slab 600,700",           body: "Barlow 400,600",           treatment: "Display sentence case at 5-8vw, tracking -0.01em, line-height 1.0; slab serifs stay blunt and heavy.", variableDisplay: false },
  { id: "familjen-literata",  display: "Familjen Grotesk 600,700",     body: "Literata 400,600",         treatment: "Display sentence case at 5-8vw, tracking -0.03em; sans display over a SERIF body — keep that inversion.", variableDisplay: true },

  // Mono-led.
  { id: "jetbrains-lexend",   display: "JetBrains Mono 500,700",       body: "Lexend 400,500",           treatment: "Display at 3.5-5.5vw, tracking -0.02em; use mono for labels and figures too.", variableDisplay: true },
  { id: "spacemono-worksans", display: "Space Mono 400,700",           body: "Work Sans 400,600",        treatment: "Display at 3.5-5.5vw; mono small-caps labels with 0.12em tracking.", variableDisplay: false },
];

export interface Composition {
  id: string;
  /** The structure to build. */
  structure: string;
  /** What this composition explicitly rules out — the anti-convergence half. */
  forbids: string;
  /**
   * False when the composition wants no photograph above the fold. These are now
   * reachable ONLY for a business with zero photos — see `artDirectionFor`. A
   * prospect opening their mockup has to see their own place in the first screen;
   * a photoless hero reads as a placeholder no matter how well it is set.
   */
  photoAboveFold: boolean;
  /**
   * True when the structure only works with a WIDE image — a full-bleed screen,
   * a full-width band. Google's photos are phone shots and usually portrait; a
   * 900x1200 image stretched across such a band is a ~3x upscale with the subject
   * cropped out. These compositions are withheld unless a landscape photo exists.
   */
  needsLandscape?: boolean;
}

/**
 * 10 hero compositions. Each names what it forbids, because the previous pool
 * described six layouts that all collapsed into "oversized type left, photo
 * right" once the prompt also demanded the hero photo be the most prominent
 * image. Placement of {{PHOTO_0}} now follows the composition, not the reverse.
 */
export const COMPOSITIONS: Composition[] = [
  {
    id: "cinematic-bleed",
    structure: "Photo fills the entire first screen edge to edge. Headline, rating and CTA sit anchored to the bottom-left over a soft bottom-up gradient scrim. Nav floats transparent over the top.",
    forbids: "No side-by-side columns. No card or panel floating over the photo's focal subject.",
    photoAboveFold: true,
    needsLandscape: true,
  },
  {
    id: "stacked-editorial",
    structure: "A full-width headline block occupies the TOP HALF of the first screen on flat colour — no more than ~55vh, so it never fills the screen on its own — followed by a hairline rule, then a photo band BELOW it that is clearly visible above the fold. CTA sits between the rule and the photo.",
    forbids: "The photo must NOT sit beside the headline. No two-column hero. The headline block must not occupy the whole first screen, leaving a slab of empty colour.",
    photoAboveFold: true,
    needsLandscape: true,
  },
  {
    id: "centred-monument",
    structure: "One enormous centred headline dominates the first screen, set on a field of flat colour with real texture (grain, a subtle radial, or a hairline grid). Rating, location and CTA sit small and symmetrically beneath it, and a row of three or four short proof points closes out the screen so it never reads as an empty slab.",
    forbids: "No left-aligned headline. No asymmetry in the hero. The first screen must not be more than half empty ground.",
    photoAboveFold: false,
  },
  {
    id: "asymmetric-rail",
    structure: "A narrow fixed left rail carries a vertical logotype and meta (rating, area). The wide content area holds the headline. A tall photo sliver bleeds off the right edge of the canvas.",
    forbids: "No 50/50 split. The photo must be a partial sliver that runs off-canvas, not a contained half.",
    photoAboveFold: true,
  },
  {
    id: "grid-mosaic",
    structure: "A 12-column grid where the headline, rating tile, CTA tile and two photos each occupy differently-sized named cells. Cells butt against each other with no gutters.",
    forbids: "No single dominant hero photo. No conventional headline-then-image flow.",
    photoAboveFold: true,
  },
  {
    id: "type-slab",
    structure: "The hero is pure typography on a flat, SATURATED field — headline, one-line value proposition, phone CTA, rating, and a closing row of opening hours or proof points. The field must be a colour that reads as deliberately painted against the page: use the accent, or the secondary accent, or the palette's ink. If the accent is white, near-white, or otherwise within a hair of the page background, do NOT use it for the field — pick the ink or the secondary accent instead. The type sits at high contrast on top of it.",
    forbids: "No gradients in the hero field. The field must never be left near-background-coloured, and the first screen must never be a mostly-empty slab of flat colour with a single line of type floating in it.",
    photoAboveFold: false,
  },
  {
    id: "framed-inset",
    structure: "All content sits inside a generous inset frame so the page colour shows as a wide margin on all four sides. The photo is a contained panel with a large corner radius inside that frame.",
    forbids: "Nothing bleeds to the viewport edge above the fold. No full-bleed photography in the hero.",
    photoAboveFold: true,
  },
  {
    id: "overlap-collage",
    structure: "The headline overlaps a photo panel with a hard offset so type crosses the image edge. A second smaller photo overlaps the opposite corner. Layered z-order is the point.",
    forbids: "No cleanly separated columns. Elements must genuinely overlap, not sit adjacent.",
    photoAboveFold: true,
  },
  {
    id: "split-horizon",
    structure: "The first screen is divided by one hard horizontal edge running the full width: flat colour above carrying the headline, photograph below. The CTA straddles the edge.",
    forbids: "The split must be horizontal, never vertical. No text over the photograph half.",
    photoAboveFold: true,
    needsLandscape: true,
  },
  {
    id: "sidebar-dossier",
    structure: "A fixed left sidebar holds nav, opening hours, phone and rating as a compact dossier. The scrolling content column to its right opens on a photograph.",
    forbids: "No conventional horizontal top nav bar. The sidebar must persist while the right column scrolls.",
    photoAboveFold: true,
  },
];

export interface HeroPattern {
  id: string;
  /** What the first screen actually SAYS, and in what order. */
  content: string;
  /** The element this pattern deliberately does without. */
  omits: string;
}

/**
 * What the fold communicates — the axis that was missing, and the reason every
 * generated site still read as generated after palette, type, composition and
 * motion were all varied.
 *
 * Those four axes only vary the surface. The INFORMATION ARCHITECTURE was fixed
 * by the system prompt, which asked every site for name + one-line value
 * proposition + CTA + rating above the fold. So a barber, a florist and a law
 * firm all opened with a tracked-out uppercase eyebrow, a two-line headline whose
 * second line was in the accent colour, a paragraph with one bolded phrase, a
 * filled-plus-ghost CTA pair, and a rating block in the corner. Four different
 * palettes, one building.
 *
 * Every pattern here omits something the old fixed recipe treated as mandatory.
 * That is the point: a real local business site is missing most of these
 * elements, which is exactly why it does not look designed by a machine.
 */
export const HERO_PATTERNS: HeroPattern[] = [
  {
    id: "proof-first",
    content: "A real customer's words are the largest type on the screen, set as a quotation with the reviewer's context beneath. The business name sits small, like a masthead. The phone number is the only call to action.",
    omits: "No slogan or value proposition of your own writing — the customer does the talking.",
  },
  {
    id: "utility-first",
    content: "The fold is practical, the way a regular reads a shop window: the name, today's opening hours, the address, and the phone number at a size you could read from across a room. Photography carries the atmosphere; the words carry the facts.",
    omits: "No marketing slogan at all. No headline in the persuasive sense.",
  },
  {
    id: "menu-forward",
    content: "The list of services IS the hero — set as a typographic list or price-style column, generously sized, the way a barber's board or a menu reads. Name and phone anchor it.",
    omits: "No abstract headline. Nothing that could be said about any other business in the category.",
  },
  {
    id: "single-statement",
    content: "One short declarative sentence in plain language, no more than about eight words, sitting alone with the photography. Everything else — hours, phone, rating — waits until the next screen.",
    omits: "No eyebrow line, no supporting paragraph, no secondary CTA. One sentence and the image.",
  },
  {
    id: "name-as-sign",
    content: "The business's own name is the display element, set enormous like painted signage or a shopfront fascia. Trade, street and phone sit small beneath it in a single line.",
    omits: "No invented headline or tagline — the name is the headline.",
  },
  {
    id: "numbers-lead",
    content: "Concrete figures carry the fold, set as the display type: years in business, the rating, the number of reviews, or a from-price. Short labels under each. A sentence of context follows, then the CTA.",
    omits: "No adjectival headline. The numbers make the argument.",
  },
  {
    id: "direct-address",
    content: "The fold speaks to one customer in the second person about the thing they actually came to find out — whether they can get in today, what it costs, where to park, how long it takes. The CTA answers the question directly.",
    omits: "No third-person brand copy, no 'we are a leading…' framing.",
  },
  {
    id: "photo-led-minimal",
    content: "Photography does nearly all the work. The only type in the fold is the business name, the trade, and the phone number, placed with restraint.",
    omits: "No headline, no paragraph, no rating block, no button — the phone number is a tel: link and that is the whole call to action.",
  },
];

export interface MotionSignature {
  id: string;
  /** Concrete entrance choreography for the hero. */
  entrance: string;
  /** What happens as later sections scroll into view. */
  scroll: string;
  /** Pointer feedback. */
  hover: string;
  /**
   * The state a reduced-motion render must show. render.ts screenshots with
   * `reducedMotion: "reduce"`, so every signature must settle to a complete,
   * fully-visible hero — never mid-fade, never blank.
   */
  settled: string;
}

/**
 * 10 motion signatures. The old prompt said only "animations are welcome", which
 * produced either nothing or improvised fades. These are choreography specs with
 * real durations and easing curves, so motion is designed per site.
 */
export const MOTION_SIGNATURES: MotionSignature[] = [
  {
    id: "mask-wipe",
    entrance: "Headline lines wipe up from clip-path inset(0 0 100% 0) to inset(0), 700ms cubic-bezier(.16,1,.3,1), 90ms stagger per line. Nav fades in over 400ms starting at 500ms.",
    scroll: "Sections translateY(28px) with opacity 0 to 1 via IntersectionObserver at 12% threshold, 600ms ease-out.",
    hover: "Accent underline scaleX(0 to 1) from the left on links, 220ms ease-out. Buttons shift background to accent2 over 200ms.",
    settled: "All headline lines fully visible at inset(0), nav fully opaque, every section at final position.",
  },
  {
    id: "counter-scroll",
    entrance: "Hero photo starts blur(12px) scale(1.04) and resolves to blur(0) scale(1) over 900ms ease-out; headline fades up 24px over 700ms.",
    scroll: "Hero photo translates at 0.12 of scroll while the headline translates at -0.05 (opposing directions). Later sections slide in alternately from left and right by 40px.",
    hover: "Images scale(1.03) with an accent border fading in, 400ms ease-out.",
    settled: "Photo unblurred at scale(1), headline at final position, no transform offsets applied.",
  },
  {
    id: "word-cascade",
    entrance: "Each headline word sits in an overflow-hidden span and rises from translateY(120%) to 0, 60ms stagger, 800ms cubic-bezier(.22,1,.36,1).",
    scroll: "Numeric stats count up once when they enter view over 1200ms. Section headings reuse the same word cascade.",
    hover: "Button fill sweeps upward from the bottom edge, 250ms ease-out.",
    settled: "Every word at translateY(0) and fully visible; stats showing their final values.",
  },
  {
    id: "draw-on-rules",
    entrance: "Hairline rules scaleX from 0 to 1 across 600ms ease-in-out from the left; the headline fades in with a 20px rise over 700ms, 150ms behind the rules.",
    scroll: "Each section's leading rule draws as it enters view; content fades up 18px behind it.",
    hover: "Links tighten letter-spacing from 0 to 0.04em over 200ms; rules thicken by 1px.",
    settled: "All rules at full width, headline fully visible at final position.",
  },
  {
    id: "curtain-lift",
    entrance: "A solid accent panel covers the hero then translateY(-100%) over 800ms cubic-bezier(.76,0,.24,1), revealing the content beneath. Content itself is already in place.",
    scroll: "Sections rise 24px with a fade, 550ms ease-out.",
    hover: "Cards lift translateY(-6px) and gain a soft shadow over 300ms.",
    settled: "Curtain panel fully offscreen (or absent), hero content completely visible and unobscured.",
  },
  {
    id: "focus-pull",
    entrance: "Hero photo begins scale(1.08) grayscale(1) and resolves to scale(1) grayscale(0) over 1100ms ease-out. Text fades in from 300ms over 600ms.",
    scroll: "Images sit desaturated until they enter view, then resolve to full colour over 800ms.",
    hover: "Accent chips rotate 3deg and lift slightly, 250ms ease-out.",
    settled: "Photo at full colour, scale(1), no grayscale filter; all text visible.",
  },
  {
    id: "grid-bloom",
    entrance: "Grid cells scale from 0.94 with opacity 0 to full, 70ms stagger in reading order, 650ms ease-out.",
    scroll: "Each later section blooms with the same stagger as it enters view.",
    hover: "An inset accent outline draws inside the hovered cell, 200ms.",
    settled: "All cells at scale(1) and full opacity, grid complete.",
  },
  {
    id: "weight-shift",
    entrance: "If the display family is variable, animate font-variation-settings weight from 300 to its final weight over 900ms ease-out while tracking tightens by 0.02em. If it is not variable, animate letter-spacing from 0.08em to its final value instead.",
    scroll: "Section headings repeat the weight or tracking shift as they enter view.",
    hover: "Nav items shift weight 400 to 700 (or tracking) over 180ms.",
    settled: "Headline at its final weight and tracking, fully legible.",
  },
  {
    id: "split-reveal",
    entrance: "The headline splits into two halves that slide apart from centre by ±30px as opacity rises, 750ms cubic-bezier(.16,1,.3,1). Any photo panel expands from clip-path circle(0%) to circle(75%) over 900ms.",
    scroll: "Sections stagger-fade in two columns, left leading the right by 100ms.",
    hover: "Arrow glyphs translateX(4px), 200ms ease-out.",
    settled: "Headline halves at their final positions, photo panel fully revealed at circle(75%) or larger.",
  },
  {
    id: "ambient-drift",
    entrance: "A slow looping gradient or grain field drifts behind the hero on a 20s linear infinite loop. Content fades up 24px over 700ms ease-out.",
    scroll: "Decorative shapes parallax at 0.08 of scroll; content fades up 20px.",
    hover: "The ambient glow intensifies behind the hovered element over 350ms.",
    settled: "Content fully visible. The ambient loop is decorative only and must look correct at ANY frame, including frame zero.",
  },
];

// ── Seeded selection ───────────────────────────────────────────────────────
// One INDEPENDENT hash per axis. The previous helper derived every axis from a
// single seed with a fixed multiplicative offset, which made the axes perfectly
// correlated: only 168 of 8064 briefs were reachable and "Brutalist" could only
// ever co-occur with four of the eight moods. Salting the hash per axis name
// decorrelates them, so the whole product space is available.

/**
 * FNV-1a plus a murmur3 fmix32 avalanche finalizer.
 *
 * The finalizer is load-bearing, not decoration. Raw FNV-1a preserves parity:
 * the multiplier is odd, so the low bit of the digest is just the initial basis
 * XOR-folded with the low bits of the input bytes. Two axis names differ from
 * each other by a CONSTANT parity, which means raw FNV gives
 * `parity(h(key::composition)) XOR parity(h(key::motion))` the same value for
 * every key — locking the two axes' parities together and making half of the
 * (composition, motion) pairs unreachable when both pools have even length.
 * fmix32 diffuses the high bits back down and breaks that.
 */
export function hashOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  h = Math.imul(h, 3266489909);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Pick from `pool` using a hash salted by the axis name, so axes don't correlate. */
export function pickAxis<T>(pool: T[], seedKey: string, axis: string): T {
  return pool[hashOf(`${seedKey}::${axis}`) % pool.length];
}

/** Relative luminance per WCAG 2.x. */
function luminance(hex: string): number {
  const ch = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

/** Pick whichever of white / near-black reads better on `hex`. */
export function readableOn(hex: string): string {
  return luminance(hex) > 0.42 ? "#0B0B0B" : "#FFFFFF";
}

/**
 * Narrow a palette pool before the draw, so the corpus comes out mostly white.
 *
 * Two seeded rolls, not a filter, so every business still gets a deterministic
 * palette and the pool keeps its variety:
 *
 *  1. MODE. A dark ground is drawn 1 time in 6. Dark pages photograph well and a
 *     few businesses genuinely want one, but a local trade owner opening their
 *     own mockup overwhelmingly expects a clean, light, printed-brochure page —
 *     and a dark site is the one aesthetic choice that makes them doubt the whole
 *     thing before reading a word.
 *  2. GROUND. Within light, a near-white ground wins 2 times in 3; the remaining
 *     third draws the soft tinted grounds (mint, sky, blush, cream, buttermilk).
 *     Those are the "soft bright colours" that keep the corpus from looking like
 *     one white template — they are never a saturated field.
 *
 * A pool that is all one mode (a category allow-list of dark palettes, say) is
 * returned untouched: the theme knows something we don't.
 */
const DARK_IN = 6; // 1 dark ground in every 6 leads
const TINTED_IN = 3; // 1 tinted light ground in every 3 light leads

/**
 * Is this ground white (or a neutral within a hair of it), as opposed to a tint?
 *
 * Luminance alone cannot answer this and gets it backwards: mint #E8FFF4 scores
 * 0.952 and near-white #FAFAF9 scores 0.955, yet one is obviously green and the
 * other is obviously white. What separates them is CHROMA — how far the channels
 * spread — so both are required. Spread ≤ 6/255 keeps #FFFFFF, #FAFAF9, #F4F6F5
 * and #F5F4F1; it excludes mint, buttermilk, blush, sky and the two creams.
 */
function isWhiteGround(hex: string): boolean {
  const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const spread = Math.max(...ch) - Math.min(...ch);
  return luminance(hex) >= 0.9 && spread <= 6;
}

export function biasPalettePool(pool: Palette[], seedKey: string): Palette[] {
  const light = pool.filter((p) => p.mode === "light");
  const dark = pool.filter((p) => p.mode === "dark");
  if (!light.length || !dark.length) return pool;

  if (hashOf(`${seedKey}::palette-mode`) % DARK_IN === 0) return dark;

  const white = light.filter((p) => isWhiteGround(p.bg));
  const tinted = light.filter((p) => !isWhiteGround(p.bg));
  if (!white.length || !tinted.length) return light;

  return hashOf(`${seedKey}::palette-ground`) % TINTED_IN === 0 ? tinted : white;
}

/** Look a palette up by id, falling back to the first when the id is unknown. */
export function paletteById(id: string): Palette {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0];
}

/**
 * Seed a palette from a category allow-list (`Theme.palettes`), so the template
 * engine varies per business while staying category-appropriate.
 */
export function paletteFor(allowed: string[], seedKey: string): Palette {
  const pool = allowed.map(paletteById);
  return pool.length ? pickAxis(pool, seedKey, "template-palette") : PALETTES[0];
}

/** Look a type set up by id, falling back to the first when the id is unknown. */
export function typeSetById(id: string): TypeSet {
  return TYPE_SETS.find((t) => t.id === id) ?? TYPE_SETS[0];
}

/**
 * Seed a type set from a category allow-list (`Theme.typeSets`), the typographic
 * counterpart to `paletteFor`.
 */
export function typeSetFor(allowed: string[], seedKey: string): TypeSet {
  const pool = allowed.map(typeSetById);
  return pool.length ? pickAxis(pool, seedKey, "type") : TYPE_SETS[0];
}

export interface SurfaceTreatment {
  id: string;
  /**
   * The literal CSS that puts texture on the page ground. Written against the
   * palette custom properties (--bg/--surface/--border/--accent) so one recipe
   * works on both a light and a dark palette.
   */
  css: string;
  /** How the treatment is distributed across the page. */
  usage: string;
}

/**
 * 10 background treatments.
 *
 * The prompt already asked for "atmosphere: layered backgrounds, texture/grain",
 * and the output came back as a flat fill anyway — the same failure the palette
 * and motion axes had before they were made literal. A business that sells
 * websites cannot show a prospect a page whose ground is one untextured colour,
 * so this is a spec with real CSS rather than an adjective.
 *
 * Every recipe is static (no animation), because render.ts screenshots with
 * reduced motion and the texture has to be present in that frame.
 *
 * Pattern colours are mixed from the INK, never from the border token. On a light
 * palette the border sits a few points off the ground (#F2D6DC on #FDF2F4), so a
 * grid drawn in it renders perfectly and is still invisible — the exact failure
 * this axis exists to prevent.
 */
export const SURFACE_TREATMENTS: SurfaceTreatment[] = [
  {
    id: "blueprint-grid",
    css: "background-image:background-image:linear-gradient(color-mix(in srgb,var(--ink) 9%,transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb,var(--ink) 9%,transparent) 1px,transparent 1px);background-size:72px 72px. Bake the alpha into the colour with color-mix rather than stacking an opacity multiplier on the layer.",
    usage: "Across the page ground, with two or three sections deliberately laid on a solid --surface panel so the grid shows through only between them.",
  },
  {
    id: "dot-matrix",
    css: "background-image:radial-gradient(color-mix(in srgb,var(--ink) 16%,transparent) 1.4px,transparent 1.4px);background-size:26px 26px, with a linear-gradient(180deg,#000 65%,transparent) mask so it softens toward the foot of the page.",
    usage: "Behind the hero and one mid-page section; solid elsewhere so it stays a texture rather than wallpaper.",
  },
  {
    id: "film-grain",
    css: "A fixed full-viewport ::after overlay with pointer-events:none carrying url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\") at opacity .045, mix-blend-mode:overlay.",
    usage: "Over the entire page, combined with one large soft radial glow in --accent at 8% alpha behind the hero so the ground has depth as well as tooth.",
  },
  {
    // WAS aurora-mesh: three overlapping soft radial-gradients in --accent and
    // --accent2 washed across the body. That is the mesh-gradient hero — the
    // single most recognisable generated-site background there is — and drawn
    // with any violet or magenta accent it reproduced the exact purple wash this
    // file is supposed to prevent. A large, soft, coloured gradient field is the
    // tell regardless of hue, so the recipe is gone rather than recoloured.
    id: "riso-misregister",
    css: "Two flat colour layers deliberately out of register, like a two-pass risograph print: a ::before layer filled var(--surface) and a ::after layer filled color-mix(in srgb,var(--accent) 12%,transparent), each clipped to large simple shapes (a wide band, a rectangle, a circle) and offset from each other by 6-10px on both axes, with mix-blend-mode:multiply on light palettes (screen on dark). Hard edges only — no blur, no gradient, no soft falloff anywhere.",
    usage: "Two or three places down the page — behind the hero, behind one mid-page band, behind the contact section. The misregistration must stay consistent in direction and distance everywhere it appears, because that is what reads as a print process rather than a mistake.",
  },
  {
    id: "hairline-rules",
    css: "background-image:repeating-linear-gradient(180deg,color-mix(in srgb,var(--ink) 8%,transparent) 0 1px,transparent 1px 96px), so a faint horizontal ruling runs the height of the page like a ledger.",
    usage: "Continuous down the page ground; content sections sit on --surface cards that interrupt the ruling, which is what creates the rhythm.",
  },
  {
    id: "diagonal-weave",
    css: "background-image:repeating-linear-gradient(45deg,color-mix(in srgb,var(--ink) 10%,transparent) 0 1px,transparent 1px 14px) on a ::before layer.",
    usage: "Confined to two or three band sections (a stats strip, the reviews band, the footer) rather than the whole page, with the rest solid.",
  },
  {
    id: "spotlight-vignette",
    // The accent glow is capped at 6% and confined to the top 35% of the hero.
    // At the old 10% across 55% of the viewport it read as a coloured gradient
    // wash rather than a light source — the same failure aurora-mesh was removed
    // for, just milder.
    css: "A radial-gradient(circle at 50% 0%,var(--accent) 0%,transparent 35%) at NO MORE THAN 6% alpha over --bg, confined to the hero rather than the body, plus an inset vignette: box-shadow:inset 0 0 240px 80px rgba(0,0,0,.28) on dark palettes (use a light equivalent on light ones). The vignette does the work; the accent is a hint of a light source, never a colour field.",
    usage: "Hero and footer carry the spotlight; middle sections alternate --bg and --surface so the page still has structure.",
  },
  {
    id: "contour-lines",
    css: "Stacked repeating-radial-gradient(circle at 20% 30%,transparent 0 38px,color-mix(in srgb,var(--ink) 11%,transparent) 38px 39px), giving soft topographic rings.",
    usage: "One oversized ring set bleeding off the left edge of the hero and a second off the right edge of the contact section; not repeated in between.",
  },
  {
    id: "panel-stack",
    css: "No page-wide pattern. Instead every section alternates between --bg and --surface, each --surface panel getting border-radius:24px, a 1px var(--border) outline and box-shadow:0 24px 60px -30px rgba(0,0,0,.45), inset into the page with margin on both sides.",
    usage: "The whole page reads as stacked physical cards on a ground — the texture comes from edges, insets and shadow rather than a pattern.",
  },
  {
    id: "gradient-seam",
    css: "The ground stays --bg, but every section boundary carries a seam: a 1px line of linear-gradient(90deg,transparent,var(--accent),transparent) at 45% alpha, and each section has a subtle top-to-bottom linear-gradient(var(--surface) 0%,var(--bg) 30%) so the ground shifts tone continuously down the page.",
    usage: "Page-wide; the accent seams are what stop long scrolls from reading as one flat sheet.",
  },
];

export interface IconSystem {
  id: string;
  /**
   * False for the one system that deliberately uses no pictograms. The audit
   * only demands inline SVG when this is true, so "no icons" stays a design
   * decision rather than the vacuum it used to be.
   */
  expectsSvg: boolean;
  /** Literal drawing rules — grid, stroke, caps, fill. */
  spec: string;
  /** Where icons appear, and where they must not. */
  usage: string;
}

/**
 * 7 icon systems.
 *
 * Every site generated before this axis existed contained ZERO inline <svg>.
 * The only glyphs across the whole corpus were 152 "★" and one "✆". That is not
 * restraint, it is an omission with a mechanical cause: the output contract bans
 * external resources, so the model cannot reach for Lucide or Heroicons the way
 * it would in any other context, and nothing told it to draw its own. So it drew
 * nothing, and every services list, hours block and contact row shipped as bare
 * text where a real site would have a mark.
 *
 * These are hand-built inline SVG, which the contract does allow. Varying the
 * system per business also makes iconography a diversity axis rather than one
 * more thing every site shares.
 */
export const ICON_SYSTEMS: IconSystem[] = [
  {
    id: "hairline-stroke",
    expectsSvg: true,
    spec: "24×24 viewBox, fill:none, stroke:currentColor, stroke-width:1.25, stroke-linecap:round, stroke-linejoin:round. Geometric construction on the 24-grid — circles centred on 12,12; lines landing on whole units. Rendered at 22-24px.",
    usage: "One icon per service row, one per contact detail (phone, address, hours). Never in the hero, never larger than 28px.",
  },
  {
    id: "heavy-stroke-blunt",
    expectsSvg: true,
    spec: "24×24 viewBox, fill:none, stroke:currentColor, stroke-width:2.5, stroke-linecap:butt, stroke-linejoin:miter. Blunt ends and hard corners — no rounding anywhere. Rendered at 26-30px.",
    usage: "Service rows and the process/how-it-works steps. Pair with the accent colour on hover. Keep them out of the footer.",
  },
  {
    id: "solid-glyph",
    expectsSvg: true,
    spec: "20×20 viewBox, single filled path, fill:currentColor, stroke:none. Solid silhouettes with generous counters so they read at small size. Rendered at 18-20px.",
    usage: "Inline with text — beside opening hours, the phone number, the address — sitting on the text baseline rather than in its own tile.",
  },
  {
    id: "duotone-accent",
    expectsSvg: true,
    spec: "24×24 viewBox, exactly two paths: a base shape filled var(--ink) and an accent shape filled var(--accent). No strokes. The accent path is the smaller, more specific element of the pair.",
    usage: "Service cards and proof points only — one per card, top-left, 28px. A duotone mark is loud, so it must not repeat more than about eight times on the page.",
  },
  {
    id: "circle-badged",
    expectsSvg: true,
    spec: "A 44px circle filled var(--surface) with a 1px var(--border) ring, holding a 20×20 stroked icon: fill:none, stroke:currentColor, stroke-width:1.5, round caps.",
    usage: "Wherever a list needs vertical rhythm — services, FAQ rows, the contact block. The badge is the alignment element, so left edges line up on the circle, not the text.",
  },
  {
    id: "sketch-irregular",
    expectsSvg: true,
    spec: "24×24 viewBox, fill:none, stroke:currentColor, stroke-width:2, stroke-linecap:round. Paths are deliberately imperfect — lines that overshoot their corner by a unit, circles drawn as a near-closed arc rather than a <circle>. It should read as drawn by hand, not plotted.",
    usage: "Service rows and section markers. This system carries the page's personality, so use it consistently and never mix it with a geometric mark.",
  },
  {
    id: "numeral-system",
    expectsSvg: false,
    spec: "NO pictograms anywhere on this page — no SVG icons, no emoji, no dingbats. The marking system is typographic instead: two-digit figures (01, 02, 03…) set in the display face at ~0.75× body size, in var(--muted), hanging in the left margin of each service row and each process step.",
    usage: "Numbers run continuously down the page in one sequence, on the SERVICES and process steps only. They must NEVER appear in the navigation — a numbered nav is one of the most recognisable generated-site tells there is. Because there are no icons at all, the figures must be set with real care: consistent margin, consistent baseline, never wrapping.",
  },
];

export interface SignatureDetail {
  id: string;
  /** The literal thing to build. */
  spec: string;
}

/**
 * 12 signature details — one hand-made element per site.
 *
 * This is the axis for the thing no default would ever produce. Palette, type,
 * composition and motion can all be varied and the page can still read as
 * assembled rather than designed, because everything on it is a component
 * anyone's starter template would emit. One element that is obviously built on
 * purpose, for this business, changes how the whole page reads.
 *
 * Written as literally as SURFACE_TREATMENTS, and for the same reason: asking
 * for "a distinctive touch" gets a rounded card with a shadow.
 */
export const SIGNATURE_DETAILS: SignatureDetail[] = [
  {
    id: "hanging-figures",
    spec: "The SERVICES list is numbered with figures that HANG in the left margin, outside the text column, set in the display face at ~2× body size in var(--accent) with their baselines aligned to the first line of each service name. Achieved with a negative text-indent or a grid column, never with list-style. The numbering applies to the services list only — never to the navigation, which is words.",
  },
  {
    id: "leader-dots",
    spec: "The services or hours list is set as a price/menu column with true leader dots: name hard left, figure hard right, and a row of dots filling the gap, built with a repeating-linear-gradient on a flex spacer (not typed periods) so it reflows correctly at every width.",
  },
  {
    id: "photo-cushion",
    spec: "Every photograph sits on a hand-made oval cushion: an ::before ellipse in var(--accent) at ~12% alpha, wider than the image and offset 10px down and 6px right, with a heavy blur, so each photo appears to rest on a soft shadow of its own rather than being cropped into a box.",
  },
  {
    id: "ticket-notch",
    spec: "The opening-hours card is a ticket stub: semicircular notches bitten out of both side edges at 40% height (radial-gradient masks or a CSS mask-image), and a vertical dashed rule separating the day column from the time column.",
  },
  {
    id: "rotated-stamp",
    spec: "The Google rating is a rubber stamp: the score, star row and review count inside a 2px ink-coloured double ring, the whole thing rotated -7deg, with slightly reduced opacity so it reads as ink pressed onto the page. It overlaps the edge of an adjacent photo or panel rather than sitting in clear space.",
  },
  {
    id: "drawn-underline",
    spec: "The single most important phrase in the hero carries a hand-drawn underline: an inline SVG path with a slightly uneven, non-parallel stroke in var(--accent), stroke-width 3, round caps, sitting below the baseline and overshooting the word at both ends. Never a border-bottom.",
  },
  {
    id: "drop-cap",
    spec: "The about/why-us paragraph opens with a real drop cap: ::first-letter set in the display face, float:left, spanning exactly three lines, with optical side-bearings tuned by negative margins so the cap's stem aligns with the paragraph's left edge and the following text sits tight against it.",
  },
  {
    id: "marginal-note",
    spec: "One aside — a note about parking, a walk-in policy, who does the work — is set as a genuine margin note: small, in the display face, rotated 90deg and running up the outer edge of a section, or hung in the outside margin at body size with a hairline rule connecting it to the line it annotates.",
  },
  {
    id: "stitched-edge",
    spec: "One full-width band (the reviews or the contact section) is edged top and bottom with a stitched seam: a repeating-linear-gradient dash in var(--accent) at 2px thickness with 6px dashes and 5px gaps, inset 24px from both ends so the stitching stops short of the viewport edge.",
  },
  {
    id: "tab-index",
    spec: "The section navigation is a set of file-folder tabs: each nav item has an asymmetric clipped top-left corner (clip-path polygon), they overlap each other by 8px in z-order, and the active one sits 3px taller and in var(--surface) so it reads as the tab in front.",
  },
  {
    id: "letterpress-heading",
    spec: "Every section heading is letterpressed into the ground: the text in var(--ink) with a 1px inset highlight below and a 1px shadow above (text-shadow with two offsets in opposing directions, both derived from the palette rather than pure black/white), so the type appears pressed into the page rather than sitting on it.",
  },
  {
    id: "corner-brackets",
    spec: "The hero content is framed by four hand-set corner brackets rather than a box: 28px L-shaped marks in 2px var(--accent), one at each corner of the content area, inset from the viewport edge, with no connecting edges between them. They must sit outside the text, never clipping it.",
  },
];

export interface PageRhythm {
  id: string;
  /** The order sections appear in below the hero. */
  sequence: string;
  /** Which grounds those sections sit on, and where the one accent band lands. */
  grounds: string;
  /** The section that deliberately breaks the established pattern. */
  breaks: string;
}

/**
 * 8 page rhythms.
 *
 * Every other axis in this file varies the HERO. Below the fold the brief had
 * nothing but prose rules ("alternate the ground", "do not centre every
 * section"), which is why two sites could draw different palettes, different
 * families and different compositions and still feel like relatives once you
 * scrolled: they ran the same sections in the same order on the same grounds.
 *
 * This is the below-the-fold counterpart to COMPOSITIONS.
 */
export const PAGE_RHYTHMS: PageRhythm[] = [
  {
    id: "proof-early",
    sequence: "reviews → services → about → process → hours+location → FAQ → contact",
    grounds: "Reviews open on a full-bleed accent band directly under the hero. Services and about alternate bg/surface. Hours and location share one inset surface panel.",
    breaks: "The process section runs as a horizontal three-column stepper against the vertical stack around it.",
  },
  {
    id: "services-first",
    sequence: "services → gallery → about → reviews → hours+location → contact",
    grounds: "Services sit on bg, gallery full-bleed edge to edge with no padding, about on surface, reviews on the accent band.",
    breaks: "The gallery is the only full-bleed section and carries no heading at all — the photographs run straight into the section above it.",
  },
  {
    id: "long-editorial",
    sequence: "about → services → gallery → reviews → staff-or-process → hours → location → contact",
    grounds: "A long run on bg with only two surface panels (services, contact), so the page reads as one continuous article rather than a stack of cards.",
    breaks: "One oversized pull-quote from a real review, set at display size on the accent, splits the page roughly in half.",
  },
  {
    id: "practical-front",
    sequence: "hours+location → services → about → reviews → FAQ → contact",
    grounds: "The practical block sits on surface immediately under the hero, tight and dense. Everything after it opens out onto bg with generous rhythm.",
    breaks: "The first section is deliberately the densest on the page; the density drops as the reader goes down.",
  },
  {
    id: "alternating-split",
    sequence: "about → services → process → reviews → gallery → hours+location → contact",
    grounds: "Every section is a two-column split, and the image/text sides swap on each one. Grounds alternate bg/surface with each swap.",
    breaks: "The reviews section abandons the split for a single centred column, and is the only centred thing on the page.",
  },
  {
    id: "band-stack",
    sequence: "services → reviews → about → gallery → FAQ → hours+location → contact",
    grounds: "Each section is a full-width band with no side margins, separated only by a change of ground: bg, surface, bg, accent, surface, bg, surface.",
    breaks: "The gallery band is twice the height of every other band and bleeds its images off both edges.",
  },
  {
    id: "sidebar-persistent",
    sequence: "services → about → reviews → process → gallery → hours+location → contact",
    grounds: "Content runs in a single column offset to one side, with hours, phone and rating persisting in a narrow sticky rail on the other. Sections alternate bg/surface within the content column only; the rail stays on surface throughout.",
    breaks: "The gallery is the one section that spans the full width, running underneath the rail.",
  },
  {
    id: "dense-then-open",
    sequence: "services → FAQ → reviews → about → gallery → hours+location → contact",
    grounds: "The top half is dense and rule-separated on a single bg with hairline dividers rather than ground changes. The bottom half opens into large surface panels with real spacing between them.",
    breaks: "There is exactly one ground change on the page — where the dense half ends and the open half begins — and it lands on the accent.",
  },
];

export interface ArtDirection {
  palette: Palette;
  type: TypeSet;
  composition: Composition;
  motion: MotionSignature;
  hero: HeroPattern;
  surface: SurfaceTreatment;
  icons: IconSystem;
  signature: SignatureDetail;
  rhythm: PageRhythm;
}

/** What the business's own material allows, constraining the draw. */
export interface DirectionConstraints {
  /** Palette ids the category permits (`Theme.palettes`). Empty → the full pool. */
  palettes?: string[];
  /** Type-set ids the category permits (`Theme.typeSets`). Empty → the full pool. */
  typeSets?: string[];
  /** False when there is no photography at all. */
  hasAny?: boolean;
  /** False when every available photo is portrait or square. */
  hasLandscape?: boolean;
}

/**
 * Resolve the full art direction for one business.
 *
 * `variant` lets a regeneration re-roll the direction. Previously the seed was
 * `placeId` alone, so a lead that drew a bad direction reproduced it on every
 * rebuild with no way out.
 *
 * Palette and type set are drawn from the theme's allow-lists rather than the
 * whole pool. Without that, the AI path ignored curation the template path
 * already respected, and a men's barbershop drew `sky-slate` — a clinical light
 * blue off the *medical* list, and the palette whose light ground made the
 * headline text invisible.
 *
 * The constraints default to permissive so a caller that knows nothing about the
 * photography gets the old unrestricted behaviour rather than a silently narrowed
 * pool.
 */
export function artDirectionFor(
  seedKey: string,
  variant = 0,
  constraints: DirectionConstraints = {},
): ArtDirection {
  const { palettes = [], typeSets = [], hasAny = true, hasLandscape = true } = constraints;
  const key = variant > 0 ? `${seedKey}#${variant}` : seedKey;

  // Filter first, then draw — drawing and then re-drawing on a miss would bias
  // the result toward whichever composition the fallback pool happens to hash to.
  let pool = COMPOSITIONS;
  if (!hasAny) {
    // With no photography, compositions built around an image would leave holes.
    pool = pool.filter((c) => !c.photoAboveFold);
  } else {
    // With photography, the business's own photos MUST be in the first screen.
    // This used to be a free draw across all ten compositions, so roughly a fifth
    // of leads with perfectly good photos drew `type-slab` or `centred-monument`
    // and the brief then instructed the designer, in as many words, not to put an
    // image in the hero. The prospect opened their mockup on a wall of type and
    // never scrolled to find their own shopfront.
    pool = pool.filter((c) => c.photoAboveFold);
    // With only tall photos, a full-bleed band can only be filled by upscaling one.
    if (!hasLandscape) pool = pool.filter((c) => !c.needsLandscape);
  }

  return {
    // Biased toward white grounds before the draw — see biasPalettePool. Applied
    // here rather than inside paletteFor() so the deterministic template keeps
    // drawing from its category's full list; this is a rule about the AI corpus.
    palette: pickAxis(
      biasPalettePool(palettes.length ? palettes.map(paletteById) : PALETTES, key),
      key,
      palettes.length ? "template-palette" : "palette",
    ),
    type: typeSets.length ? typeSetFor(typeSets, key) : pickAxis(TYPE_SETS, key, "type"),
    composition: pickAxis(pool.length ? pool : COMPOSITIONS, key, "composition"),
    motion: pickAxis(MOTION_SIGNATURES, key, "motion"),
    surface: pickAxis(SURFACE_TREATMENTS, key, "surface"),
    icons: pickAxis(ICON_SYSTEMS, key, "icons"),
    signature: pickAxis(SIGNATURE_DETAILS, key, "signature"),
    // Rhythms that lean on a gallery need photographs to fill it; with none, the
    // section would be an empty band — the exact failure the brief spends most of
    // its length trying to prevent.
    rhythm: pickAxis(
      hasAny ? PAGE_RHYTHMS : PAGE_RHYTHMS.filter((r) => !r.sequence.includes("gallery")),
      key,
      "rhythm",
    ),
    // `photo-led-minimal` leans entirely on the photography, so it can only be
    // drawn when there is some. With no photos it would leave a near-empty fold.
    hero: pickAxis(
      hasAny ? HERO_PATTERNS : HERO_PATTERNS.filter((h) => h.id !== "photo-led-minimal"),
      key,
      "hero",
    ),
  };
}
