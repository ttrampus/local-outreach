// Check a generated site against the brief it was built from.
//
// The design brief in aiSite.ts is ~100 lines of rules, and until this module
// existed every one of them was a hope: the pipeline generated a page, took a
// screenshot and shipped it. The failures documented all over this directory
// ("which has happened", "that is the single most visible failure mode") were
// each found by a human opening a preview weeks later.
//
// Two halves, deliberately separable:
//   auditHtml        — pure, synchronous, no browser. Checks the things that are
//                      decidable from the source: did it use the palette it was
//                      given, the families it was given, the spacing scale.
//   auditRenderedPage — needs a real layout. Checks the things only the rendered
//                      pixels can answer: bands of bare ground, content left
//                      invisible, an unreadable button label.
//
// The rendered half is lifted from scripts/audit-previews.mjs, which had these
// checks first and had them right; the script is now a thin CLI over this module
// so the two can never drift.
//
// Deliberately free of `server-only` and of `@/` path aliases: scripts/ imports
// this file directly under plain node (which strips the types), and both would
// break that.
import sharp from "sharp";
import type { Page } from "playwright";
import type { ArtDirection } from "./designTokens";

/**
 * `blocking` findings are worth spending another model call to repair — they are
 * the ones a prospect would notice. `cosmetic` ones are logged and fed to a
 * repair that is happening anyway, but never trigger one on their own: a stray
 * 7px radius is a tell, not a reason to re-bill an Opus generation.
 */
export type Severity = "blocking" | "cosmetic";

export interface Finding {
  severity: Severity;
  /** Stable machine-readable check name, for grouping across a corpus. */
  check: string;
  detail: string;
}

const blocking = (check: string, detail: string): Finding => ({ severity: "blocking", check, detail });
const cosmetic = (check: string, detail: string): Finding => ({ severity: "cosmetic", check, detail });

// ── Static checks ──────────────────────────────────────────────────────────

/**
 * Families the brief bans outright. Matched against whole font-stack entries
 * rather than as substrings — "Inter" is a substring of "Instrument Serif",
 * which is a family the brief actively recommends.
 */
const BANNED_FAMILIES = new Set([
  "inter",
  "roboto",
  "arial",
  "helvetica",
  "helvetica neue",
  "system-ui",
  "-apple-system",
  "space grotesk",
]);

/** The spacing ramp the brief specifies. Anything else was improvised per-element. */
const SPACING_SCALE = new Set([0, 4, 8, 16, 24, 40, 64, 96, 160]);

/** The only hosts the output contract permits. */
const ALLOWED_HOSTS = new Set(["fonts.googleapis.com", "fonts.gstatic.com"]);

/**
 * Strip the trailing weight list off a type-set entry: the pools store
 * "Big Shoulders Display 700,900", and the family name is everything before the
 * weights.
 */
export function familyName(spec: string): string {
  return spec.replace(/\s+[\d,\s]+$/, "").trim();
}

/** Every font-family declaration's entries, lowercased and unquoted. */
function fontStacks(css: string): string[][] {
  const out: string[][] = [];
  for (const m of css.matchAll(/font-family\s*:\s*([^;}]+)/gi)) {
    out.push(
      m[1]
        .split(",")
        .map((f) => f.trim().replace(/^['"]|['"]$/g, "").toLowerCase())
        .filter(Boolean),
    );
  }
  return out;
}

/**
 * Check the source of a generated page against its brief.
 *
 * Run this on the RAW html, before injectContactForm swaps the token out —
 * otherwise the contact-form check can never fire.
 */
export function auditHtml(html: string, direction?: ArtDirection): Finding[] {
  const findings: Finding[] = [];
  const lower = html.toLowerCase();

  // ── Palette substitution ────────────────────────────────────────────────
  // The single failure this whole system is built around: the brief hands over
  // exact hex values and the model quietly resolves them back to its house
  // cream. The brief requires the values verbatim as custom properties, so a
  // briefed hex that appears nowhere in the document was not used.
  if (direction) {
    const p = direction.palette;
    const missing = (["bg", "surface", "ink", "muted", "accent"] as const).filter(
      (k) => !lower.includes(p[k].toLowerCase()),
    );
    if (missing.includes("bg")) {
      findings.push(
        blocking(
          "palette-ground",
          `the briefed page ground ${p.bg} (palette "${p.id}") appears nowhere in the document — the model substituted its own background`,
        ),
      );
    }
    const others = missing.filter((k) => k !== "bg");
    if (others.length) {
      findings.push(
        cosmetic(
          "palette-partial",
          `briefed palette values unused: ${others.map((k) => `${k} ${p[k]}`).join(", ")}`,
        ),
      );
    }
  }

  // ── Typography ──────────────────────────────────────────────────────────
  const stacks = fontStacks(html);
  const bannedPrimary = new Set<string>();
  const bannedFallback = new Set<string>();
  for (const stack of stacks) {
    stack.forEach((family, i) => {
      if (!BANNED_FAMILIES.has(family)) return;
      (i === 0 ? bannedPrimary : bannedFallback).add(family);
    });
  }
  if (bannedPrimary.size) {
    findings.push(
      blocking(
        "banned-family",
        `banned typeface set as a primary family: ${[...bannedPrimary].join(", ")}`,
      ),
    );
  }
  if (bannedFallback.size) {
    findings.push(
      cosmetic("banned-fallback", `banned typeface used as a fallback: ${[...bannedFallback].join(", ")}`),
    );
  }

  if (direction) {
    // The briefed families have to actually be loaded. A page that names
    // Fraunces in its CSS but never links it renders in a system serif, which
    // looks like a different (and much cheaper) design decision.
    for (const [role, spec] of [
      ["display", direction.type.display],
      ["body", direction.type.body],
    ] as const) {
      const family = familyName(spec).toLowerCase();
      const linked = lower.includes(family.replace(/\s+/g, "+")) || lower.includes(family);
      if (!linked) {
        findings.push(
          blocking("missing-family", `the briefed ${role} family "${familyName(spec)}" is never loaded or used`),
        );
      }
    }
  }

  // ── Spacing scale ───────────────────────────────────────────────────────
  // Fluid values are exactly what the brief allows for section rhythm, so
  // anything wrapped in clamp/calc/var/min/max is skipped rather than counted.
  const offScale = new Map<number, number>();
  for (const m of html.matchAll(/(?:padding|margin|gap|row-gap|column-gap)[a-z-]*\s*:\s*([^;}]+)/gi)) {
    const value = m[1];
    if (/clamp\(|calc\(|var\(|min\(|max\(|%|auto/i.test(value)) continue;
    for (const px of value.matchAll(/(\d+(?:\.\d+)?)px/g)) {
      const n = Number(px[1]);
      if (!SPACING_SCALE.has(n)) offScale.set(n, (offScale.get(n) ?? 0) + 1);
    }
  }
  // A handful of odd values is noise; the tell the brief is after is systematic
  // improvisation. The threshold is set from the corpus: sites run 34-69 off-scale
  // values, so 25 flags the drift without firing on every page that rounded a
  // couple of gaps by hand.
  const offScaleTotal = [...offScale.values()].reduce((a, b) => a + b, 0);
  if (offScaleTotal >= 25) {
    const worst = [...offScale.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([px, n]) => `${px}px×${n}`)
      .join(", ");
    findings.push(
      cosmetic(
        "spacing-scale",
        `${offScaleTotal} spacing values off the 4/8/16/24/40/64/96/160 scale (${worst})`,
      ),
    );
  }

  // ── Output contract ─────────────────────────────────────────────────────
  const hosts = new Set<string>();
  for (const m of html.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']|url\(\s*["']?([^"')]+)/gi)) {
    const raw = (m[1] ?? m[2] ?? "").trim();
    if (!/^https?:\/\//i.test(raw)) continue; // data: and relative are fine
    try {
      const { host } = new URL(raw);
      if (!ALLOWED_HOSTS.has(host)) hosts.add(host);
    } catch {
      // an unparseable URL is not what this check is for
    }
  }
  if (hosts.size) {
    findings.push(
      blocking(
        "external-resource",
        `references hosts the output contract forbids: ${[...hosts].join(", ")} — these will not load for the prospect`,
      ),
    );
  }

  // ── Contact form ────────────────────────────────────────────────────────
  // Only meaningful pre-injection. Once injectContactForm has run the token is
  // gone by design, so checking for it then would flag every page ever built —
  // the injected form's own class is the signal that we are looking too late.
  // The rendered audit's orphan check covers the same ground from the far side.
  const tokens = (html.match(/\{\{CONTACT_FORM\}\}/g) ?? []).length;
  const alreadyInjected = html.includes("__lo-cf");
  if (alreadyInjected) {
    // nothing to say — the token has served its purpose
  } else if (tokens === 0) {
    findings.push(
      blocking(
        "contact-form-token",
        "no {{CONTACT_FORM}} token — the form will be appended below the copyright line as an unstyled stray box",
      ),
    );
  } else if (tokens > 1) {
    findings.push(blocking("contact-form-token", `${tokens} {{CONTACT_FORM}} tokens — the form will be duplicated`));
  }

  // ── Leftover placeholders ───────────────────────────────────────────────
  // Only meaningful AFTER substitution. On the raw document {{PHOTO_n}} and
  // {{MAP}} are not leftovers, they are the entire mechanism — the design model
  // never sees the photo bytes and builds against these tokens by design.
  if (alreadyInjected) {
    const stray = html.match(/\{\{[A-Z_0-9]+\}\}/g);
    if (stray) {
      findings.push(
        cosmetic(
          "stray-placeholder",
          `unresolved placeholder(s) left in the markup: ${[...new Set(stray)].join(", ")}`,
        ),
      );
    }
  }

  // ── The two clichés that survived every prose rule ──────────────────────
  // Both of these shipped repeatedly while the brief was telling the model not
  // to produce them, which is the whole argument for checking rather than
  // asking. They are cheap to detect and unambiguous when they appear.

  // A nav whose items are numbered "01 … 02 … 03". Matched on the rendered
  // anchor text inside a nav/header, so numbered SERVICE rows (which several
  // art directions legitimately require) don't trip it.
  for (const navBlock of html.matchAll(/<(nav|header)\b[^>]*>([\s\S]{0,4000}?)<\/\1>/gi)) {
    const numbered = (navBlock[2].match(/>\s*0\d\s*</g) ?? []).length;
    if (numbered >= 3) {
      findings.push(
        blocking(
          "numbered-nav",
          `the navigation numbers its items (${numbered}× "01"/"02"-style figures inside <${navBlock[1]}>) — one of the most recognisable generated-site tells`,
        ),
      );
      break;
    }
  }

  // A large soft coloured gradient used as a ground. Hairline seams, pattern
  // masks and photo scrims are all legitimate and all small or transparent —
  // what this looks for is a gradient painted across a big area in real colour.
  const meshy = [...html.matchAll(/(?:radial|linear|conic)-gradient\([^;{}]{0,300}/gi)]
    .map((m) => m[0])
    .filter((g) => {
      // Two or more opaque colour stops = a colour field rather than a fade to
      // transparent. Anything referencing only ink/border or fading out is fine.
      const stops = (g.match(/#[0-9a-f]{3,8}\b|var\(--accent2?\)|rgba?\(/gi) ?? []).length;
      return stops >= 2 && !/transparent\s*\)/i.test(g) && !/var\(--ink\)|var\(--border\)/i.test(g);
    });
  if (meshy.length >= 3) {
    findings.push(
      cosmetic(
        "gradient-field",
        `${meshy.length} multi-stop colour gradients — check none is being used as a section ground (mesh/aurora washes are the classic AI hero)`,
      ),
    );
  }

  // ── Iconography ─────────────────────────────────────────────────────────
  // Every site in the corpus before this landed had zero inline SVG: the output
  // contract bans external icon sets, so with nothing telling it to draw its
  // own, the model drew none at all.
  if (direction?.icons?.expectsSvg) {
    const svgCount = (html.match(/<svg[\s>]/gi) ?? []).length;
    if (svgCount === 0) {
      findings.push(
        blocking(
          "missing-icons",
          `icon system "${direction.icons.id}" was briefed but the page contains no inline <svg> at all`,
        ),
      );
    }
  }

  return findings;
}

// ── Rendered checks ────────────────────────────────────────────────────────

// Emptiness is measured in rendered pixels, not in text length: a photo gallery
// carries almost no text but is not empty, and a counting heuristic flags it
// wrongly. Instead we render the settled page and look for runs of consecutive
// rows that are uniform across their whole width — literal bands of bare ground.
const EMPTY_BAND_PX = 450; // a run this tall reads as "the page just stopped"
const ROW_UNIFORM_TOLERANCE = 6; // max luma spread within a row to call it bare

/** Luma spread below this means a button's label is the same colour as its fill. */
const MIN_LABEL_CONTRAST = 25;

export interface RenderedAudit {
  findings: Finding[];
  /** Total document height in CSS px, for logging and the divergence harness. */
  height: number;
  sections: number;
}

/**
 * Audit an already-navigated page.
 *
 * The page MUST have been loaded with `reducedMotion: "reduce"`. That is the
 * settled state: scroll-reveals are supposed to start visible there, so anything
 * still invisible is genuinely broken rather than merely un-scrolled.
 */
export async function auditRenderedPage(page: Page): Promise<RenderedAudit> {
  const findings: Finding[] = [];

  const info = await page.evaluate(() => {
    const out = {
      height: document.documentElement.scrollHeight,
      hidden: [] as string[],
      sections: 0,
      form: null as { orphan: boolean } | null,
    };
    out.sections = document.querySelectorAll("section, header, footer, main > div").length;

    // Content left invisible in the settled state — a reveal authored outside
    // the no-preference media query never comes back for these users.
    for (const el of document.querySelectorAll("*")) {
      const t = ((el as HTMLElement).innerText || "").trim();
      if (!t || el.children.length) continue;
      const cs = getComputedStyle(el);
      if (cs.opacity === "0" || cs.visibility === "hidden") out.hidden.push(t.slice(0, 30));
    }

    const cf = document.querySelector(".__lo-cf");
    out.form = cf ? { orphan: cf.parentElement === document.body } : null;
    return out;
  });

  // Find bands of bare ground in the rendered page.
  const full = await page.screenshot({ fullPage: true });
  const { data, info: meta } = await sharp(full).greyscale().raw().toBuffer({ resolveWithObject: true });
  let runStart: number | null = null;
  const bands: { top: number; h: number }[] = [];
  for (let y = 0; y < meta.height; y++) {
    let min = 255;
    let max = 0;
    for (let x = 0; x < meta.width; x++) {
      const v = data[y * meta.width + x];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    const bare = max - min <= ROW_UNIFORM_TOLERANCE;
    if (bare && runStart === null) runStart = y;
    if (!bare && runStart !== null) {
      if (y - runStart >= EMPTY_BAND_PX) bands.push({ top: runStart, h: y - runStart });
      runStart = null;
    }
  }
  if (runStart !== null && meta.height - runStart >= EMPTY_BAND_PX) {
    bands.push({ top: runStart, h: meta.height - runStart });
  }
  for (const b of bands) {
    findings.push(
      blocking(
        "bare-band",
        `${b.h}px of bare background starting at y=${b.top} (${((b.h / meta.height) * 100).toFixed(0)}% of the page)`,
      ),
    );
  }

  if (info.hidden.length) {
    findings.push(
      blocking(
        "invisible-content",
        `${info.hidden.length} element(s) invisible in the settled state, e.g. ${JSON.stringify(info.hidden[0])}`,
      ),
    );
  }
  if (!info.form) {
    findings.push(blocking("contact-form-missing", "no contact form on the page"));
  } else if (info.form.orphan) {
    findings.push(
      blocking(
        "contact-form-orphan",
        "contact form is a direct child of <body> — appended below the footer, not placed in a section",
      ),
    );
  }

  // Submit button legibility, measured in rendered pixels rather than computed
  // style: the label may be flipped by filter/blend, which computed colour misses.
  const button = await page.$(".__lo-cf button");
  if (button) {
    await button.scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
    const shot = await button.screenshot();
    const { data: bd, info: bmeta } = await sharp(shot).raw().toBuffer({ resolveWithObject: true });
    let min = 255;
    let max = 0;
    for (let i = 0; i < bd.length; i += bmeta.channels) {
      const luma = 0.2126 * bd[i] + 0.7152 * bd[i + 1] + 0.0722 * bd[i + 2];
      if (luma < min) min = luma;
      if (luma > max) max = luma;
    }
    const spread = Math.round(max - min);
    if (spread < MIN_LABEL_CONTRAST) {
      findings.push(blocking("button-label", `submit button label is invisible (luma spread ${spread}/255)`));
    }
  }

  return { findings, height: info.height, sections: info.sections };
}

/** One-line summary for logs. */
export function summarize(findings: Finding[]): string {
  if (!findings.length) return "clean";
  const b = findings.filter((f) => f.severity === "blocking").length;
  return `${b} blocking, ${findings.length - b} cosmetic`;
}
