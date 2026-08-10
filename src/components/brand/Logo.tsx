import { Archivo } from "next/font/google";
import { BRAND } from "@/lib/brand";

// The wordmark is Archivo Bold. The supplied lockup SVGs draw it as live <text>,
// which only renders correctly on a machine that happens to have Archivo
// installed — so the wordmark is set as real text here instead, with the font
// self-hosted by next/font. Same result everywhere, selectable, and it scales
// with the surrounding type.
const archivo = Archivo({ subsets: ["latin"], weight: "700", display: "swap" });

/** `light` = on a dark ground (the default here — this app is dark throughout). */
type Tone = "light" | "dark";

function lanes(tone: Tone) {
  return tone === "light" ? BRAND.paper : BRAND.ink;
}

function marker(tone: Tone) {
  return tone === "light" ? BRAND.signalLight : BRAND.signal;
}

/**
 * The symbol alone: two lanes converging, with the centre marker carrying the
 * accent. Geometry is copied verbatim from `public/brand/avenyo-mark.svg`.
 *
 * `size` is the size of the 100x100 grid, not of the ink — the glyph occupies
 * the middle ~67% of it, so the brand minimum of an 18px mark means size >= 27.
 * Below that reach for the icon tile (`/brand/avenyo-app-icon.svg`).
 */
export function AvenyoMark({
  size = 28,
  tone = "light",
  className,
}: {
  size?: number;
  tone?: Tone;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M6 87 L27 87 L48.5 20 L43 20 Z" fill={lanes(tone)} />
      <path d="M94 87 L73 87 L51.5 20 L57 20 Z" fill={lanes(tone)} />
      <rect x="44.5" y="55" width="11" height="17" rx="2.5" fill={marker(tone)} />
    </svg>
  );
}

/**
 * The horizontal lockup: mark + wordmark. Proportions follow the supplied
 * lockup — wordmark at 0.62x the mark grid, set a third of a mark away from it.
 *
 * Render the mark alone (`wordmark={false}`) rather than shrinking this below
 * the brand's 28px floor.
 */
export function AvenyoLogo({
  size = 28,
  tone = "light",
  wordmark = true,
  className,
}: {
  size?: number;
  tone?: Tone;
  wordmark?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center ${className ?? ""}`}
      style={{ gap: size * 0.32 }}
    >
      <AvenyoMark size={size} tone={tone} />
      {/* The mark is aria-hidden, so the name has to come from here either way —
          visibly as the wordmark, or for assistive tech alone when it is off. */}
      {wordmark ? (
        <span
          className={archivo.className}
          style={{
            fontSize: size * 0.62,
            lineHeight: 1,
            letterSpacing: "0.005em",
            color: lanes(tone),
          }}
        >
          AVENYO
        </span>
      ) : (
        <span className="sr-only">{BRAND.name}</span>
      )}
    </span>
  );
}
