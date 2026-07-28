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

export async function renderPreview(
  placeId: string,
  html: string,
): Promise<RenderResult> {
  await mkdir(PREVIEW_IMG_DIR, { recursive: true });
  await mkdir(PREVIEW_HTML_DIR, { recursive: true });

  const safeId = placeId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const htmlPath = path.join(PREVIEW_HTML_DIR, `${safeId}.html`);
  const imgFsPath = path.join(PREVIEW_IMG_DIR, `${safeId}.png`);
  const imgWebPath = `/previews/${safeId}.png`;

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
