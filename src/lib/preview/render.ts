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
  mobileImagePath: string | null; // same, at a phone viewport; null if that shot failed
  htmlPath: string; // absolute path to stored HTML on disk
}

// iPhone-class portrait viewport. Most prospects open a cold-outreach link on a
// phone, so the desktop shot alone was never evidence the page actually holds up.
const MOBILE_VIEWPORT = { width: 390, height: 844 };

/**
 * Where this render's artifacts go.
 *
 * The template is the ONLY engine whose output is cheap and reproducible: same
 * inputs, same page, for free. So it keeps the stable `{placeId}` name and
 * overwrites in place — nothing of value is lost.
 *
 * Everything else is unreproducible. An AI design is non-deterministic, so a
 * rebuild is a DIFFERENT site rather than the same one recreated, and it cost
 * money; a manual paste-back cost human effort. Both get a unique name (engine +
 * variant + UTC timestamp + random suffix) and are never written over: not by a
 * later run of the same engine, and — the case that actually bit us — not by a
 * `regenerate-all` sweep falling back to the template because the API key was
 * missing or out of credit.
 */
function artifactBase(safeId: string, engine: string, variant: number): string {
  if (engine === "template") return safeId;
  const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  // The timestamp is second-resolution and a design takes minutes, so a clash is
  // already unlikely — but "unlikely" is not what this function is for. The suffix
  // makes the name unconditionally unique.
  const suffix = Math.random().toString(16).slice(2, 6);
  return `${safeId}--${engine}-v${variant}-${stamp}-${suffix}`;
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
  const mobileFsPath = path.join(PREVIEW_IMG_DIR, `${base}--mobile.png`);
  const mobileWebPath = `/previews/${base}--mobile.png`;

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

    // Then the same page at phone width. Reusing the page rather than launching a
    // second browser keeps this nearly free; the context's deviceScaleFactor of 2
    // carries over, so the phone shot is retina too. Best-effort: a layout that
    // breaks the resize must not cost us the desktop artifact we already have.
    let mobileImagePath: string | null = null;
    try {
      await page.setViewportSize(MOBILE_VIEWPORT);
      await page.waitForTimeout(500); // let the responsive reflow settle
      await page.screenshot({ path: mobileFsPath, fullPage: false });
      mobileImagePath = mobileWebPath;
    } catch {
      // leave null — the panel simply won't offer a Mobile toggle for this render
    }

    return { imagePath: imgWebPath, mobileImagePath, htmlPath };
  } finally {
    await browser.close().catch(() => {});
  }
}
