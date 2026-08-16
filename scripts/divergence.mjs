// Measure whether the generated sites are actually different from each other,
// and whether each one is the site its brief asked for.
//
//   node scripts/divergence.mjs
//   node scripts/divergence.mjs --ai   # only the AI-designed sites
//
// This exists because there was no way to tell. The art direction in
// designTokens.ts has grown to nine seeded axes on the theory that they stop the
// output converging, every one of those axes was added in response to a failure
// somebody noticed by eye, and nothing ever checked whether any of it worked. At
// the time this was written all 15 stored previews predated the most recent
// prompt change, so the honest answer to "did that help?" was that nobody knew.
//
// Two questions, and they are different:
//
//   COMPLIANCE — the direction is a pure function of (placeId, variant), so the
//   brief each site was given can be recomputed exactly. Did the page that
//   shipped use the ground, the families and the icon system it was told to?
//   A palette pool of 25 buys nothing if the model quietly substitutes its own.
//
//   COLLISION — across the corpus, how are the axes actually distributed, and
//   how many businesses drew the same combination? Variation in the pools is not
//   variation in the output.
//
// Reads HTML off disk. No model calls, no cost, safe to run on every change.
import Database from "better-sqlite3";
import { readFile } from "node:fs/promises";
import { artDirectionFor } from "../src/lib/preview/designTokens.ts";
import { pickTheme } from "../src/lib/preview/theme.ts";
import { auditHtml, familyName } from "../src/lib/preview/audit.ts";

const aiOnly = process.argv.includes("--ai");
const db = new Database("dev.db", { readonly: true });
const leads = db
  .prepare(
    `select l.name, l.placeId, l.previewHtmlPath, l.previewEngine, l.previewVariant,
            r.query as query, p.raw as raw
       from Lead l
       left join SearchRun r on r.id = l.searchRunId
       left join PlaceCache p on p.placeId = l.placeId
      where l.previewHtmlPath is not null ${aiOnly ? "and l.previewEngine = 'ai'" : ""}
      order by l.name`,
  )
  .all();

if (!leads.length) {
  console.log("No previews to measure.");
  process.exit(0);
}

const tally = (map, key) => map.set(key, (map.get(key) ?? 0) + 1);
const axes = {
  palette: new Map(),
  type: new Map(),
  composition: new Map(),
  hero: new Map(),
  surface: new Map(),
  motion: new Map(),
  icons: new Map(),
  signature: new Map(),
  rhythm: new Map(),
};
const triples = new Map();

let compliant = 0;
const rows = [];

for (const lead of leads) {
  const html = await readFile(lead.previewHtmlPath, "utf8");

  // Recompute the brief this lead was given. The photo-derived constraints are
  // not recoverable from disk, so the composition and rhythm draws may differ
  // from the originals for photo-poor businesses; palette, type, icons and
  // signature do not depend on them and are exact.
  // `types` off the cached Places payload — the same field google.ts normalizes
  // into `categories`, which is what pickTheme matches on.
  let categories = [];
  try {
    categories = JSON.parse(lead.raw ?? "{}").types ?? [];
  } catch {
    // an unparseable cache row just means an unconstrained draw
  }
  const theme = pickTheme(categories, lead.query ?? "");
  const direction = artDirectionFor(lead.placeId || lead.name, lead.previewVariant ?? 0, {
    palettes: theme.palettes,
    typeSets: theme.typeSets,
  });

  for (const [axis, map] of Object.entries(axes)) {
    const value = direction[axis];
    tally(map, value.id ?? String(value));
  }
  tally(triples, `${direction.palette.id} / ${direction.type.id} / ${direction.composition.id}`);

  // Did the page comply? auditHtml already knows how to answer this; the
  // direction-aware checks are exactly the compliance questions.
  //
  // The template engine only honours part of the direction: it draws its palette
  // through paletteFor(), but sets type from theme.headingFont/bodyFont and has
  // no icon system at all. Holding it to the type and icon axes would report a
  // dozen failures that are really just "this is the other engine".
  const applicable =
    lead.previewEngine === "ai"
      ? ["palette-ground", "palette-partial", "missing-family", "banned-family", "missing-icons"]
      : ["palette-ground", "banned-family"];
  const findings = auditHtml(html, direction).filter((f) => applicable.includes(f.check));
  const svgCount = (html.match(/<svg[\s>]/gi) ?? []).length;
  if (!findings.length) compliant += 1;

  rows.push({
    name: (lead.name || "").slice(0, 32),
    engine: lead.previewEngine ?? "?",
    ground: direction.palette.bg,
    groundUsed: html.toLowerCase().includes(direction.palette.bg.toLowerCase()),
    display: familyName(direction.type.display),
    icons: direction.icons.id,
    svgCount,
    signature: direction.signature.id,
    findings,
  });
}

// ── Compliance ─────────────────────────────────────────────────────────────
console.log(`\nCOMPLIANCE — did each page build the brief it was given?\n`);
for (const r of rows) {
  const mark = r.findings.length ? "✗" : "✓";
  console.log(
    `${mark} ${r.name.padEnd(34)} ${r.engine.padEnd(9)} ground ${r.ground} ${
      r.groundUsed ? "used" : "SUBSTITUTED"
    }, ${r.display.padEnd(22)} ${String(r.svgCount).padStart(3)} svg (${r.icons})`,
  );
  for (const f of r.findings) console.log(`     · ${f.detail}`);
}
console.log(`\n${compliant}/${rows.length} pages complied with their brief.`);

const noIcons = rows.filter((r) => r.svgCount === 0).length;
console.log(`${noIcons}/${rows.length} pages contain no inline SVG at all.`);

// ── Collision ──────────────────────────────────────────────────────────────
console.log(`\nDISTRIBUTION — how the ${rows.length} briefs spread across each axis:\n`);
for (const [axis, map] of Object.entries(axes)) {
  const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]);
  const top = sorted
    .slice(0, 4)
    .map(([id, n]) => `${id}×${n}`)
    .join(", ");
  console.log(`  ${axis.padEnd(12)} ${String(map.size).padStart(2)} distinct  ${top}`);
}

const collisions = [...triples.entries()].filter(([, n]) => n > 1);
console.log(
  `\n${triples.size} distinct (palette / type / composition) triples across ${rows.length} sites.`,
);
if (collisions.length) {
  console.log(`Repeated combinations — these businesses drew the same core direction:`);
  for (const [triple, n] of collisions.sort((a, b) => b[1] - a[1])) {
    console.log(`  ×${n}  ${triple}`);
  }
} else {
  console.log(`No two sites share a core direction.`);
}
console.log();
