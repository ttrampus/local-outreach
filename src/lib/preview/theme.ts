// Art direction for generated previews. Each theme bundles a LAYOUT archetype
// (the structural family — editorial / bold / warm / clinical), a distinctive
// type pairing, and a palette. Matched against Google Place `types` (with the
// search query as a fallback). The goal: a café and a law firm should not look
// like the same template in different colors.

export type Layout = "editorial" | "bold" | "warm" | "clinical";

export interface Theme {
  key: string;
  match: string[]; // Google Maps-ish category buckets this theme matches
  label: string; // human label used in copy ("salon", "café", …)
  layout: Layout;
  headingFont: string;
  bodyFont: string;
  // Palette ----------------------------------------------------------------
  bg: string;
  surface: string;
  surface2: string;
  text: string;
  muted: string;
  border: string;
  // Accent options — one is chosen per business via the placeId seed, so two
  // salons in the same sweep don't come out identical. All must read against
  // `accentText`.
  accents: string[];
  accentText: string;
  // Palette allow-list (ids from designTokens.PALETTES). The per-theme colours
  // above only vary by accent, so every salon in a sweep used to render in the
  // same pink. Seeding a palette from this list instead gives each business its
  // own ground while keeping the choice category-appropriate — a dentist can't
  // draw oxblood, a barber can't draw clinical mint.
  palettes: string[];
  // Hero band -------------------------------------------------------------
  heroBg: string; // base color the mesh is layered over
  heroText: string; // text color on the hero, chosen for contrast
  heroMesh2: string; // second mesh hue (the accent is the first)
}

const THEMES: Theme[] = [
  {
    key: "salon",
    match: ["hair", "salon", "beauty", "barber", "nail", "spa", "cosmetic"],
    label: "salon",
    layout: "editorial",
    headingFont: "'Fraunces', Georgia, serif",
    bodyFont: "'Hanken Grotesk', system-ui, sans-serif",
    bg: "#f7f1ec",
    surface: "#fffaf6",
    surface2: "#f1e7df",
    text: "#2a211d",
    muted: "#8a7468",
    border: "#e6d8cd",
    accents: ["#b76e79", "#bd6a4c", "#9c5a78"],
    accentText: "#fffaf6",
    palettes: ["plum-noir", "oxblood", "graphite-mono", "blush-ink", "lilac-graphite", "pure-mono", "violet-acid", "stone-oxide", "sunset-duo", "bone-forest"],
    heroBg: "#f3e7df",
    heroText: "#34261f",
    heroMesh2: "#e7c9cf",
  },
  {
    key: "cafe",
    match: ["cafe", "coffee", "bakery", "restaurant", "food", "bar", "tea", "brunch"],
    label: "café",
    layout: "warm",
    headingFont: "'DM Serif Display', Georgia, serif",
    bodyFont: "'Work Sans', system-ui, sans-serif",
    bg: "#181210",
    surface: "#221a16",
    surface2: "#2c2019",
    text: "#f5ebe0",
    muted: "#b6a392",
    border: "#3a2c23",
    accents: ["#e0a458", "#d98756", "#c9994f"],
    accentText: "#1a1310",
    palettes: ["carbon-ember", "oxblood", "forest-brass", "emerald-gold", "stone-oxide", "linen-navy", "sunset-duo", "electric-pop", "bone-forest", "abyss-coral"],
    heroBg: "#1a1310",
    heroText: "#f7efe5",
    heroMesh2: "#7a4a28",
  },
  {
    key: "trades",
    match: ["plumber", "electrician", "contractor", "roofing", "hvac", "locksmith", "repair", "construction", "painter", "cleaning", "moving"],
    label: "service",
    layout: "bold",
    headingFont: "'Bricolage Grotesque', system-ui, sans-serif",
    bodyFont: "'Hanken Grotesk', system-ui, sans-serif",
    bg: "#0f1419",
    surface: "#161d25",
    surface2: "#1d2630",
    text: "#eef3f8",
    muted: "#8a98a6",
    border: "#26313d",
    accents: ["#ff6a3d", "#ffb000", "#2f9bff"],
    accentText: "#0f1419",
    palettes: ["obsidian-lime", "midnight-signal", "ink-cobalt", "carbon-ember", "graphite-mono", "paper-cobalt", "citrus-white", "electric-pop", "sapphire-ice"],
    heroBg: "#0f1419",
    heroText: "#ffffff",
    heroMesh2: "#1f3b57",
  },
  {
    key: "medical",
    match: ["dentist", "doctor", "clinic", "health", "physio", "dental", "veterinary", "pharmacy", "optician", "wellness"],
    label: "practice",
    layout: "clinical",
    headingFont: "'Syne', system-ui, sans-serif",
    bodyFont: "'Public Sans', system-ui, sans-serif",
    bg: "#f1f7f6",
    surface: "#ffffff",
    surface2: "#e6f1ef",
    text: "#13302c",
    muted: "#5d7d77",
    border: "#d4e6e2",
    accents: ["#0fae96", "#1f8fb0", "#2f8f6f"],
    accentText: "#ffffff",
    palettes: ["mint-clinic", "sky-slate", "paper-cobalt", "sapphire-ice", "neo-mint-black", "citrus-white", "pure-mono", "linen-navy"],
    heroBg: "#ecf6f4",
    heroText: "#0f2723",
    heroMesh2: "#bfe8df",
  },
  {
    key: "florist",
    match: ["florist", "flower", "garden", "nursery", "plant", "landscaping"],
    label: "studio",
    layout: "editorial",
    headingFont: "'Cormorant Garamond', Georgia, serif",
    bodyFont: "'Work Sans', system-ui, sans-serif",
    bg: "#f5f6ef",
    surface: "#fcfcf6",
    surface2: "#e6ebd9",
    text: "#26301f",
    muted: "#6f7a60",
    border: "#dde2d0",
    accents: ["#5c8a3a", "#bd6a4c", "#9a7bb0"],
    accentText: "#fcfcf6",
    palettes: ["blush-ink", "lilac-graphite", "bone-forest", "neo-mint-black", "mint-clinic", "stone-oxide", "sunset-duo", "emerald-gold"],
    heroBg: "#eef1e6",
    heroText: "#26301f",
    heroMesh2: "#cdddb6",
  },
  {
    key: "fitness",
    match: ["gym", "fitness", "yoga", "pilates", "crossfit", "martial", "dance", "sport"],
    label: "studio",
    layout: "bold",
    headingFont: "'Anton', system-ui, sans-serif",
    bodyFont: "'Hanken Grotesk', system-ui, sans-serif",
    bg: "#0c0d0f",
    surface: "#15171a",
    surface2: "#1d2024",
    text: "#f3f5f7",
    muted: "#9aa1a8",
    border: "#262a2f",
    accents: ["#c6f53d", "#ff4d57", "#33d6a6"],
    accentText: "#0c0d0f",
    palettes: ["obsidian-lime", "midnight-signal", "graphite-mono", "carbon-ember", "electric-pop", "violet-acid", "abyss-coral", "pure-mono", "ink-cobalt"],
    heroBg: "#0c0d0f",
    heroText: "#ffffff",
    heroMesh2: "#2a3a0e",
  },
  {
    key: "automotive",
    match: ["car", "auto", "mechanic", "tire", "garage", "vehicle", "motorcycle", "detailing"],
    label: "garage",
    layout: "bold",
    headingFont: "'Archivo', system-ui, sans-serif",
    bodyFont: "'Hanken Grotesk', system-ui, sans-serif",
    bg: "#101114",
    surface: "#181a1f",
    surface2: "#20232a",
    text: "#eef0f3",
    muted: "#969ba3",
    border: "#282c33",
    accents: ["#e23b3b", "#f5a623", "#3a7bd5"],
    accentText: "#ffffff",
    palettes: ["graphite-mono", "ink-cobalt", "carbon-ember", "obsidian-lime", "midnight-signal", "oxblood", "pure-mono", "sapphire-ice"],
    heroBg: "#101114",
    heroText: "#ffffff",
    heroMesh2: "#3a1414",
  },
  {
    key: "professional",
    match: ["lawyer", "legal", "attorney", "accountant", "notary", "consultant", "real_estate", "insurance", "architect", "agency", "finance"],
    label: "practice",
    layout: "editorial",
    headingFont: "'Playfair Display', Georgia, serif",
    bodyFont: "'Work Sans', system-ui, sans-serif",
    bg: "#f4f3ef",
    surface: "#fbfbf8",
    surface2: "#eae8e0",
    text: "#1b2330",
    muted: "#5f6878",
    border: "#dcdacf",
    accents: ["#1f3a5f", "#7a5b32", "#3a5a40"],
    accentText: "#fbfbf8",
    palettes: ["linen-navy", "paper-cobalt", "sapphire-ice", "ink-cobalt", "stone-oxide", "pure-mono", "citrus-white", "emerald-gold", "graphite-mono"],
    heroBg: "#ecebe4",
    heroText: "#1b2330",
    heroMesh2: "#c9c6b4",
  },
];

const DEFAULT_THEME: Theme = {
  key: "default",
  match: [],
  label: "business",
  layout: "bold",
  headingFont: "'Bricolage Grotesque', system-ui, sans-serif",
  bodyFont: "'DM Sans', system-ui, sans-serif",
  bg: "#0d0f14",
  surface: "#161922",
  surface2: "#1e222d",
  text: "#eef1f6",
  muted: "#9aa3b2",
  border: "#262b38",
  accents: ["#6c5ce7", "#00b894", "#ff7675"],
  accentText: "#ffffff",
    palettes: ["paper-cobalt", "midnight-signal", "stone-oxide", "sky-slate", "carbon-ember", "graphite-mono", "citrus-white", "linen-navy", "emerald-gold", "ink-cobalt"],
  heroBg: "#0d0f14",
  heroText: "#ffffff",
  heroMesh2: "#241f47",
};

/**
 * Choose a theme. The business's OWN categories (Google `types`) take priority;
 * the free-text fallback (the search query) is only consulted if categories
 * match nothing — otherwise searching "hair salon" would mis-theme a café it found.
 */
export function pickTheme(categories: string[], fallbackText = ""): Theme {
  const catText = categories.join(" ").toLowerCase();
  for (const theme of THEMES) {
    if (theme.match.some((m) => catText.includes(m))) return theme;
  }
  const fallback = fallbackText.toLowerCase();
  for (const theme of THEMES) {
    if (theme.match.some((m) => fallback.includes(m))) return theme;
  }
  return DEFAULT_THEME;
}

/** Distinctive Google Fonts used across the themes, loaded once in the <head>. */
export const GOOGLE_FONTS_HREF =
  "https://fonts.googleapis.com/css2?" +
  [
    "family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700",
    "family=Playfair+Display:wght@500;600;700;800",
    "family=Cormorant+Garamond:wght@500;600;700",
    "family=DM+Serif+Display:ital@0;1",
    "family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800",
    "family=Syne:wght@600;700;800",
    "family=Archivo:wght@600;700;800;900",
    "family=Anton",
    "family=Hanken+Grotesk:wght@400;500;600;700",
    "family=Work+Sans:wght@400;500;600;700",
    "family=Public+Sans:wght@400;500;600;700",
    "family=DM+Sans:wght@400;500;600;700",
  ].join("&") +
  "&display=swap";
