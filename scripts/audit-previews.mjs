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
// The checks themselves live in src/lib/preview/audit.ts, which the build
// pipeline also runs on every generated site. This script is the retrospective
// view over what is already on disk; keeping both on one implementation is what
// stops the two from drifting into disagreeing about what "broken" means.
//
// Pages are rendered with prefers-reduced-motion:reduce, which is the settled
// state: scroll-reveals are supposed to start visible there. A page that is blank
// under reduce is genuinely broken, not merely un-scrolled.
import { chromium } from "playwright";
import Database from "better-sqlite3";
import { readFile } from "node:fs/promises";
import { auditRenderedPage, auditHtml } from "../src/lib/preview/audit.ts";

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

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1280, height: 900 },
  reducedMotion: "reduce",
});

let totalIssues = 0;

for (const lead of leads) {
  const label = (lead.name || "").slice(0, 34);

  await page.goto(`file://${lead.previewHtmlPath}`, { waitUntil: "load", timeout: 60000 });
  await page.waitForTimeout(400);

  const { findings, height, sections } = await auditRenderedPage(page);

  // The static half too, on what is actually stored. No art direction is passed:
  // it is a pure function of placeId and the pools, and recomputing it here would
  // only be meaningful for sites built since the current pools landed. The
  // direction-free checks — banned families, external hosts, spacing scale —
  // still apply to every site ever generated.
  const source = await readFile(lead.previewHtmlPath, "utf8");
  findings.push(...auditHtml(source));

  totalIssues += findings.length;
  const screens = (height / 900).toFixed(1);
  if (findings.length) {
    console.log(`\n✗ ${label}  (${sections} sections, ${screens} screens)`);
    for (const f of findings) console.log(`    · [${f.severity}] ${f.check}: ${f.detail}`);
  } else {
    console.log(`✓ ${label}  (${sections} sections, ${screens} screens)`);
  }
}

await browser.close();
console.log(`\n${leads.length} preview(s) audited, ${totalIssues} issue(s) found.`);
process.exit(totalIssues ? 1 : 0);
