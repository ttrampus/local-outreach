// Render generated site HTML headless with Playwright and capture a single hero
// screenshot — the cheap default artifact. Also persists the HTML to disk so the
// opt-in deploy step can reuse it without regenerating.
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const PREVIEW_IMG_DIR = path.join(process.cwd(), "public", "previews");
const PREVIEW_HTML_DIR = path.join(process.cwd(), "data", "previews");

export interface RenderResult {
  imagePath: string; // web path under /public, e.g. /previews/{placeId}.png
  htmlPath: string; // absolute path to stored HTML on disk
}

/**
 * Where this render's artifacts go.
 *
 * AI output is expensive and unreproducible — the design is non-deterministic, so
 * a regenerated site is a DIFFERENT site, not the same one rebuilt. It therefore
 * gets a unique name (engine + variant + UTC timestamp) and is never written
 * over: not by a later AI run, and — the case that actually bit us — not by a
 * `regenerate-all` sweep falling back to the template because the API key was
 * missing or out of credit.
 *
 * Template output is deterministic and free, so it keeps the stable
 * `{placeId}.html` name and overwrites in place. Nothing of value is lost.
 */
function artifactBase(safeId: string, engine: string, variant: number): string {
  if (engine !== "ai") return safeId;
  const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  // The timestamp is second-resolution and a design takes minutes, so a clash is
  // already unlikely — but "unlikely" is not what this function is for. The suffix
  // makes the name unconditionally unique.
  const suffix = Math.random().toString(16).slice(2, 6);
  return `${safeId}--ai-v${variant}-${stamp}-${suffix}`;
}

export async function renderPreview(
  placeId: string,
  html: string,
  engine: string = "template",
  variant: number = 0,
): Promise<RenderResult> {
  await mkdir(PREVIEW_IMG_DIR, { recursive: true });
  await mkdir(PREVIEW_HTML_DIR, { recursive: true });

  const safeId = placeId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const base = artifactBase(safeId, engine, variant);
  const htmlPath = path.join(PREVIEW_HTML_DIR, `${base}.html`);
  const imgFsPath = path.join(PREVIEW_IMG_DIR, `${base}.png`);
  const imgWebPath = `/previews/${base}.png`;

  await writeFile(htmlPath, html, "utf8");

  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({
      // 1000px rather than 820: the hero composition varies well below the old
      // fold, and the screenshot is what both the operator and the prospect judge.
      viewport: { width: 1280, height: 1000 },
      deviceScaleFactor: 2, // crisp retina screenshot
      // The template's entrance/scroll animations are gated behind
      // `prefers-reduced-motion: no-preference`, so emulating "reduce" here makes
      // the screenshot capture the settled end-state (full hero, nothing mid-fade)
      // while the live preview iframe — a normal browser — still animates.
      reducedMotion: "reduce",
    });
    // Tolerate slow font CDNs: load, then wait briefly for webfonts.
    await page.setContent(html, { waitUntil: "load", timeout: 15_000 });
    await page
      .evaluate(() => (document as Document).fonts.ready)
      .catch(() => {});
    await page.waitForTimeout(700);

    // Hero screenshot = the above-the-fold viewport (nav + hero band).
    await page.screenshot({ path: imgFsPath, fullPage: false });
    return { imagePath: imgWebPath, htmlPath };
  } finally {
    await browser.close().catch(() => {});
  }
}
