// The brand, in one place. Importable from client and server alike (no
// "server-only"), because the logo renders on both sides of the line.
//
// Colour names and the usage rules below come from the logo package
// ("Avenyo logo concepts/avenyo-svg/README.txt"), which is the source of truth
// for the artwork; the SVG originals also ship verbatim under /public/brand for
// anything that needs a file rather than a component.
export const BRAND = {
  name: "Avenyo",
  /** Neutral dark — the lanes on a light ground. */
  ink: "#1E2227",
  /** Near-white — the lanes on a dark ground. */
  paper: "#FAFAFA",
  /** The accent the centre marker carries, on a light ground. */
  signal: "#2C6BE4",
  /** The same accent, lightened for legibility on a dark ground. */
  signalLight: "#6098FF",
  /** Below this the lockup stops being readable — use the icon tile instead. */
  minLockupPx: 28,
} as const;
