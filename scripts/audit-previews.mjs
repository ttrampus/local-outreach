// Audit the stored generated sites for the defects that are invisible in the
// outreach screenshot but obvious to the business owner who opens the link.
//
// The hero screenshot we send only covers the first ~2000px, so every problem
// below the fold ships unseen: bands of bare background, sections stretched far
// past their content, a submit button whose label renders the same colour as the
// button, a contact form appended below the copyright line.
//
//   node scripts/audit-previews.mjs            # every lead with a preview
//   node scripts/audit-previews.mjs --showcase # only the portfolio
//
// Pages are rendered with prefers-reduced-motion:reduce, which is the settled
// state: scroll-reveals are supposed to start visible there. A page that is blank
// under reduce is genuinely broken, not merely un-scrolled.
import { chromium } from "playwright";
import Database from "better-sqlite3";
import sharp from "sharp";

const showcaseOnly = process.argv.includes("--showcase");
const db = new Database("dev.db", { readonly: true });
const leads = db
  .prepare(
    `select name, previewHtmlPath from Lead
      where previewHtmlPath is not null ${showcaseOnly ? "and showcase = 1" : ""}
      order by score desc`,
  )
  .all();

if (!leads.length) {
  console.log("No previews to audit.");
  process.exit(0);
}

// Emptiness is measured in rendered pixels, not in text length: a photo gallery
// carries almost no text but is not empty, and a counting heuristic flags it
// wrongly. Instead we render the settled page and look for runs of consecutive
// rows that are uniform across their whole width — literal bands of bare ground.
const EMPTY_BAND_PX = 450; // a run this tall reads as "the page just stopped"
const ROW_UNIFORM_TOLERANCE = 6; // max luma spread within a row to call it bare

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1280, height: 900 },
  reducedMotion: "reduce",
});

let totalIssues = 0;

for (const lead of leads) {
  const label = (lead.name || "").slice(0, 34);
  const issues = [];

  await page.goto(`file://${lead.previewHtmlPath}`, { waitUntil: "load", timeout: 60000 });
  await page.waitForTimeout(400);

  const info = await page.evaluate(() => {
    const out = { height: document.documentElement.scrollHeight, hidden: [], sections: 0 };
    out.sections = document.querySelectorAll("section, header, footer, main > div").length;

    // Content left invisible in the settled state — a reveal authored outside
    // the no-preference media query never comes back for these users.
    for (const el of document.querySelectorAll("*")) {
      const t = (el.innerText || "").trim();
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
  const bands = [];
  let runStart = null;
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
    issues.push(`${b.h}px of bare background starting at y=${b.top} (${((b.h / meta.height) * 100).toFixed(0)}% of the page)`);
  }
  if (info.hidden.length) {
    issues.push(`${info.hidden.length} element(s) invisible in the settled state, e.g. ${JSON.stringify(info.hidden[0])}`);
  }
  if (!info.form) {
    issues.push("no contact form on the page");
  } else if (info.form.orphan) {
    issues.push("contact form is a direct child of <body> — appended below the footer, not placed in a section");
  }

  // Submit button legibility, measured in rendered pixels rather than computed
  // style: the label may be flipped by filter/blend, which computed colour misses.
  const button = await page.$(".__lo-cf button");
  if (button) {
    await button.scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
    const shot = await button.screenshot();
    const { data, info: meta } = await sharp(shot).raw().toBuffer({ resolveWithObject: true });
    let min = 255;
    let max = 0;
    for (let i = 0; i < data.length; i += meta.channels) {
      const luma = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      if (luma < min) min = luma;
      if (luma > max) max = luma;
    }
    const spread = Math.round(max - min);
    if (spread < 25) issues.push(`submit button label is invisible (luma spread ${spread}/255)`);
  }

  totalIssues += issues.length;
  const screens = (info.height / 900).toFixed(1);
  if (issues.length) {
    console.log(`\n✗ ${label}  (${info.sections} sections, ${screens} screens)`);
    for (const i of issues) console.log(`    · ${i}`);
  } else {
    console.log(`✓ ${label}  (${info.sections} sections, ${screens} screens)`);
  }
}

await browser.close();
console.log(`\n${leads.length} preview(s) audited, ${totalIssues} issue(s) found.`);
process.exit(totalIssues ? 1 : 0);
