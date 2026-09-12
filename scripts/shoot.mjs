// Full-page screenshot of a generated preview, for judging a design end to end.
// renderPreview only captures the first viewport (that is what outreach shows);
// designing the sections below the fold needs the whole page.
//
//   node scripts/shoot.mjs data/previews/<file>.html [out.png] [--width=1280]
import { chromium } from "playwright";
import path from "node:path";
import { pathToFileURL } from "node:url";

const file = process.argv[2];
if (!file) {
  console.error("usage: node scripts/shoot.mjs <html file> [out.png] [--width=N]");
  process.exit(1);
}
const out = process.argv[3]?.startsWith("--")
  ? "/tmp/shot.png"
  : (process.argv[3] ?? "/tmp/shot.png");
const width = Number(process.argv.find((a) => a.startsWith("--width="))?.split("=")[1] ?? 1280);

// Default to reduced motion, like render.ts: reveal-on-scroll then has no hidden
// state, so the capture shows the real layout instead of whatever the observer
// happened to have triggered. --motion opts back in.
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({
  viewport: { width, height: 900 },
  deviceScaleFactor: 1,
  reducedMotion: process.argv.includes("--motion") ? "no-preference" : "reduce",
});
await page.goto(pathToFileURL(path.resolve(file)).href, { waitUntil: "networkidle" });
// Let scroll-reveal fire for every section before capturing.
await page.evaluate(async () => {
  for (let y = 0; y < document.body.scrollHeight; y += 400) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 60));
  }
  window.scrollTo(0, 0);
});
await page.waitForTimeout(900);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log(out);
