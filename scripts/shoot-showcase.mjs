// Screenshot every showcase page for the marketing site's work gallery, and
// report anything the page complained about on the way.
//
// The gallery scrolls the whole page inside a fixed frame on hover, so these are
// full-page captures, not viewport ones. WebP because a 1280px full-page PNG of
// a photo-heavy site runs to several megabytes.
//
//   node --import ./scripts/lib/app-imports.mjs scripts/shoot-showcase.mjs
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import sharp from "sharp";
import { ROOT } from "./lib/app-imports.mjs";

const DIR = path.join(ROOT, "public", "site", "work");
const WIDTH = 1280;

const manifest = JSON.parse(await readFile(path.join(DIR, "manifest.json"), "utf8"));
const browser = await chromium.launch({ args: ["--no-sandbox"] });
let problems = 0;

for (const site of manifest) {
  const page = await browser.newPage({
    viewport: { width: WIDTH, height: 900 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce", // reveal-on-scroll leaves no hidden state to capture
  });

  const notes = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") notes.push(`${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => notes.push(`pageerror: ${e.message}`));
  page.on("requestfailed", (r) => notes.push(`failed: ${r.url().slice(0, 100)}`));

  // The live Google Maps embed keeps chattering (tiles, telemetry) for as long
  // as the page is open, so "networkidle" never arrives. Wait for load, then
  // give the photos a fixed window to settle before the scroll pass.
  await page.goto(pathToFileURL(path.join(DIR, `${site.slug}.html`)).href, {
    waitUntil: "load",
  });
  await page.waitForTimeout(3000);
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 400) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(800);

  // Anything the renderer could not fill is a mismatch worth seeing, not a
  // blank box to ship: an unresolved {token}, a visible label placeholder, or a
  // gallery that hid itself because every photo URL broke.
  const audit = await page.evaluate(() => {
    const body = document.body.innerText;
    const leftovers = body.match(/\{[a-z_]+\}/g) ?? [];
    const imgs = [...document.images];
    return {
      title: document.title,
      height: document.body.scrollHeight,
      leftovers: [...new Set(leftovers)],
      brokenImages: imgs.filter((i) => i.complete && i.naturalWidth === 0).length,
      totalImages: imgs.length,
      jsonLd: !!document.querySelector('script[type="application/ld+json"]'),
    };
  });

  const png = await page.screenshot({ fullPage: true });
  await writeFile(
    path.join(DIR, `${site.slug}.webp`),
    await sharp(png).webp({ quality: 78 }).toBuffer(),
  );
  await page.close();

  const bad = notes.length || audit.leftovers.length || audit.brokenImages;
  if (bad) problems++;
  console.log(
    `${bad ? "!" : "·"} ${site.slug.padEnd(28)} ${String(audit.height).padStart(6)}px  ` +
      `${audit.totalImages - audit.brokenImages}/${audit.totalImages} img  ` +
      `${audit.jsonLd ? "ld+json" : "NO ld+json"}  "${audit.title}"`,
  );
  for (const l of audit.leftovers) console.log(`    unfilled token ${l}`);
  for (const n of [...new Set(notes)].slice(0, 6)) console.log(`    ${n}`);
}

await browser.close();
console.log(problems ? `\n${problems} page(s) reported something` : "\nall clean");
