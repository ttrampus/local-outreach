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
  { id: "plum-noir",       mode: "dark",  bg: "#12070F", surface: "#1D0E19", ink: "#F6E9F2", muted: "#B295A8", border: "#301B2A", accent: "#FF4D9D", accent2: "#8E3A6B" },
  { id: "forest-brass",    mode: "dark",  bg: "#0C1410", surface: "#14201A", ink: "#E7F0E9", muted: "#93A99C", border: "#22322A", accent: "#D4AF37", accent2: "#6B8E76" },
  { id: "carbon-ember",    mode: "dark",  bg: "#121212", surface: "#1C1C1C", ink: "#EDEDED", muted: "#A2A2A2", border: "#2A2A2A", accent: "#FF5A1F", accent2: "#FFB38A" },
  { id: "abyss-coral",     mode: "dark",  bg: "#04191C", surface: "#082A2F", ink: "#E3F5F4", muted: "#8CB2B1", border: "#103B41", accent: "#FF6B5A", accent2: "#4FD1C5" },
  { id: "oxblood",         mode: "dark",  bg: "#1A0A0C", surface: "#261115", ink: "#F6E7E7", muted: "#B89797", border: "#3A1D22", accent: "#E23E57", accent2: "#F0C05A" },
  { id: "graphite-mono",   mode: "dark",  bg: "#1A1A1A", surface: "#242424", ink: "#FAFAFA", muted: "#A8A8A8", border: "#333333", accent: "#FFFFFF", accent2: "#FF3B30" },
  { id: "sunset-duo",      mode: "dark",  bg: "#1B1020", surface: "#291733", ink: "#FBEEF7", muted: "#AF97B9", border: "#3D2449", accent: "#FF8A3D", accent2: "#D946EF" },

  // ── Jewel / saturated ───────────────────────────────────────────────────
  { id: "emerald-gold",    mode: "dark",  bg: "#06231C", surface: "#0B3229", ink: "#EAF7F1", muted: "#8FBCAB", border: "#14493C", accent: "#F2C14E", accent2: "#34D399" },
  { id: "sapphire-ice",    mode: "dark",  bg: "#071634", surface: "#0D2249", ink: "#E6EEFF", muted: "#98ACD0", border: "#17325F", accent: "#7DD3FC", accent2: "#FBBF24" },
  { id: "violet-acid",     mode: "dark",  bg: "#150B2E", surface: "#1F1142", ink: "#EDE7FB", muted: "#A89BCC", border: "#2E1E5C", accent: "#D6FF3D", accent2: "#A78BFA" },

  // ── Light, non-cream ────────────────────────────────────────────────────
  { id: "paper-cobalt",    mode: "light", bg: "#FFFFFF", surface: "#F4F6FB", ink: "#0A1633", muted: "#5A6785", border: "#DDE3F0", accent: "#1D4ED8", accent2: "#F97316" },
  { id: "mint-clinic",     mode: "light", bg: "#F2FBF7", surface: "#FFFFFF", ink: "#08241A", muted: "#4B7362", border: "#CFE9DE", accent: "#059669", accent2: "#0F766E" },
  { id: "blush-ink",       mode: "light", bg: "#FDF2F4", surface: "#FFFFFF", ink: "#2A0E16", muted: "#805C68", border: "#F2D6DC", accent: "#E11D48", accent2: "#7C2D4B" },
  { id: "sky-slate",       mode: "light", bg: "#F1F6FC", surface: "#FFFFFF", ink: "#0F2233", muted: "#54697D", border: "#D6E4F0", accent: "#0284C7", accent2: "#F43F5E" },
  { id: "stone-oxide",     mode: "light", bg: "#F5F4F1", surface: "#FFFFFF", ink: "#1C1A17", muted: "#67635C", border: "#E2DFD8", accent: "#C2410C", accent2: "#3F6212" },
  { id: "lilac-graphite",  mode: "light", bg: "#F6F4FD", surface: "#FFFFFF", ink: "#1B1630", muted: "#635B7D", border: "#E3DEF5", accent: "#6D28D9", accent2: "#DB2777" },
  { id: "citrus-white",    mode: "light", bg: "#FFFFFF", surface: "#FAFAF7", ink: "#14140F", muted: "#646456", border: "#E6E6DC", accent: "#A16207", accent2: "#166534" },
  { id: "pure-mono",       mode: "light", bg: "#FFFFFF", surface: "#F2F2F2", ink: "#000000", muted: "#5F5F5F", border: "#DCDCDC", accent: "#000000", accent2: "#E60000" },

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

  // Serif display.
  { id: "fraunces-hanken",    display: "Fraunces 600,900",             body: "Hanken Grotesk 400,600",   treatment: "Display sentence case at 5-8vw, optical size high, line-height 0.98.", variableDisplay: true },
  { id: "playfair-worksans",  display: "Playfair Display 700,900",     body: "Work Sans 400,500",        treatment: "Display sentence case at 5-8vw, tracking -0.015em, line-height 1.02.", variableDisplay: true },
  { id: "dmserif-manrope",    display: "DM Serif Display 400",         body: "Manrope 400,600",          treatment: "Display sentence case at 5.5-8.5vw, line-height 1.0.", variableDisplay: false },
  { id: "instrument-figtree", display: "Instrument Serif 400",         body: "Figtree 400,600",          treatment: "Display sentence case at 6-10vw, line-height 0.95; one word may be italic.", variableDisplay: false },
  { id: "bodoni-jakarta",     display: "Bodoni Moda 700,900",          body: "Plus Jakarta Sans 400,600", treatment: "Display sentence case at 5-8vw, high contrast, line-height 1.0.", variableDisplay: true },
  { id: "youngserif-public",  display: "Young Serif 400",              body: "Public Sans 400,600",      treatment: "Display sentence case at 5-8vw, line-height 1.05, generous word spacing.", variableDisplay: false },
  { id: "gloock-mulish",      display: "Gloock 400",                   body: "Mulish 400,600",           treatment: "Display sentence case at 5.5-9vw, line-height 1.0.", variableDisplay: false },
  { id: "cormorant-mulish",   display: "Cormorant Garamond 300,600",   body: "Mulish 300,500",           treatment: "Display at 6-10vw in light weight, tracking 0.01em, line-height 1.05.", variableDisplay: false },

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
  /** False when the composition wants no photograph above the fold. */
  photoAboveFold: boolean;
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
  },
  {
    id: "stacked-editorial",
    structure: "A full-width headline block occupies the top of the page on flat colour, followed by a hairline rule, then a full-bleed photo band BELOW it. CTA sits between the rule and the photo.",
    forbids: "The photo must NOT sit beside the headline. No two-column hero.",
    photoAboveFold: true,
  },
  {
    id: "centred-monument",
    structure: "One enormous centred headline dominates the first screen. Rating, location and CTA sit small and symmetrically beneath it. The first photograph appears only in a later section.",
    forbids: "No photograph above the fold. No left-aligned headline. No asymmetry in the hero.",
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
    structure: "The hero is pure typography on a flat accent-coloured field — headline, one-line value proposition, phone CTA, rating. The first photograph appears immediately after the fold.",
    forbids: "No images of any kind above the fold. No gradients in the hero field.",
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
  },
  {
    id: "sidebar-dossier",
    structure: "A fixed left sidebar holds nav, opening hours, phone and rating as a compact dossier. The scrolling content column to its right opens on a photograph.",
    forbids: "No conventional horizontal top nav bar. The sidebar must persist while the right column scrolls.",
    photoAboveFold: true,
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

export interface ArtDirection {
  palette: Palette;
  type: TypeSet;
  composition: Composition;
  motion: MotionSignature;
}

/**
 * Resolve the full art direction for one business.
 *
 * `variant` lets a regeneration re-roll the direction. Previously the seed was
 * `placeId` alone, so a lead that drew a bad direction reproduced it on every
 * rebuild with no way out.
 */
export function artDirectionFor(seedKey: string, variant = 0, hasPhotos = true): ArtDirection {
  const key = variant > 0 ? `${seedKey}#${variant}` : seedKey;

  let composition = pickAxis(COMPOSITIONS, key, "composition");
  // With no photography, compositions built around an image would leave holes.
  if (!hasPhotos && composition.photoAboveFold) {
    const typeLed = COMPOSITIONS.filter((c) => !c.photoAboveFold);
    composition = pickAxis(typeLed, key, "composition-typeled");
  }

  return {
    palette: pickAxis(PALETTES, key, "palette"),
    type: pickAxis(TYPE_SETS, key, "type"),
    composition,
    motion: pickAxis(MOTION_SIGNATURES, key, "motion"),
  };
}
