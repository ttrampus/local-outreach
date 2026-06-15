// Pick tasteful typography + color per business category so previews don't look
// like one default template. Matched against Google Place `types` (and the search
// query as a fallback), with a neutral-but-polished default.

export interface Theme {
  key: string;
  // Google Maps-ish category buckets this theme matches.
  match: string[];
  label: string; // human label used in copy ("salon", "café", …)
  headingFont: string;
  bodyFont: string;
  // CSS color tokens
  bg: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  accentText: string; // text color that sits ON the accent (e.g. button label)
  heroGradient: string;
  heroText: string; // text color for the hero/contact bands, picked for contrast
}

const THEMES: Theme[] = [
  {
    key: "salon",
    match: ["hair", "salon", "beauty", "barber", "nail", "spa"],
    label: "salon",
    headingFont: "'Playfair Display', Georgia, serif",
    bodyFont: "'Inter', system-ui, sans-serif",
    bg: "#fbf7f4",
    surface: "#ffffff",
    text: "#2b2320",
    muted: "#8a7d75",
    accent: "#b76e79",
    accentText: "#ffffff",
    heroGradient: "linear-gradient(135deg, #f3d9d3 0%, #e9c6cf 100%)",
    heroText: "#3a2b28",
  },
  {
    key: "cafe",
    match: ["cafe", "coffee", "bakery", "restaurant", "food", "bar", "tea"],
    label: "café",
    headingFont: "'Fraunces', Georgia, serif",
    bodyFont: "'Inter', system-ui, sans-serif",
    bg: "#1c1714",
    surface: "#26201b",
    text: "#f3ece4",
    muted: "#b3a596",
    accent: "#d99a4e",
    accentText: "#1c1714",
    heroGradient: "linear-gradient(135deg, #3a2c20 0%, #1c1714 100%)",
    heroText: "#f6efe6",
  },
  {
    key: "trades",
    match: ["plumber", "electrician", "contractor", "roofing", "hvac", "locksmith", "repair", "construction", "painter"],
    label: "service",
    headingFont: "'Archivo', system-ui, sans-serif",
    bodyFont: "'Inter', system-ui, sans-serif",
    bg: "#f4f6f8",
    surface: "#ffffff",
    text: "#16202b",
    muted: "#5d6b7a",
    accent: "#1f6feb",
    accentText: "#ffffff",
    heroGradient: "linear-gradient(135deg, #1f6feb 0%, #13315c 100%)",
    heroText: "#ffffff",
  },
  {
    key: "medical",
    match: ["dentist", "doctor", "clinic", "health", "physio", "dental", "veterinary", "pharmacy"],
    label: "practice",
    headingFont: "'Poppins', system-ui, sans-serif",
    bodyFont: "'Inter', system-ui, sans-serif",
    bg: "#f3faf9",
    surface: "#ffffff",
    text: "#13302c",
    muted: "#5a7a74",
    accent: "#0fae96",
    accentText: "#ffffff",
    heroGradient: "linear-gradient(135deg, #b7ece3 0%, #0fae96 100%)",
    heroText: "#0c2723",
  },
  {
    key: "florist",
    match: ["florist", "flower", "garden", "nursery", "plant"],
    label: "studio",
    headingFont: "'Cormorant Garamond', Georgia, serif",
    bodyFont: "'Inter', system-ui, sans-serif",
    bg: "#f7f8f3",
    surface: "#ffffff",
    text: "#26301f",
    muted: "#6f7a63",
    accent: "#5c8a3a",
    accentText: "#ffffff",
    heroGradient: "linear-gradient(135deg, #dbe8c7 0%, #a9c98a 100%)",
    heroText: "#26301f",
  },
];

const DEFAULT_THEME: Theme = {
  key: "default",
  match: [],
  label: "business",
  headingFont: "'Sora', system-ui, sans-serif",
  bodyFont: "'Inter', system-ui, sans-serif",
  bg: "#0f1115",
  surface: "#171a21",
  text: "#eef1f6",
  muted: "#9aa3b2",
  accent: "#6366f1",
  accentText: "#ffffff",
  heroGradient: "linear-gradient(135deg, #6366f1 0%, #312e81 100%)",
  heroText: "#ffffff",
};

/**
 * Choose a theme. The business's OWN categories (Google `types`) take priority;
 * the free-text fallback (e.g. the search query) is only consulted if categories
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

// Google Fonts used by the themes above, loaded once in the template <head>.
export const GOOGLE_FONTS_HREF =
  "https://fonts.googleapis.com/css2?" +
  [
    "family=Inter:wght@400;500;600;700",
    "family=Playfair+Display:wght@500;700",
    "family=Fraunces:opsz,wght@9..144,500;9..144,700",
    "family=Archivo:wght@600;700;800",
    "family=Poppins:wght@500;600;700",
    "family=Cormorant+Garamond:wght@500;600;700",
    "family=Sora:wght@500;600;700",
  ].join("&") +
  "&display=swap";
