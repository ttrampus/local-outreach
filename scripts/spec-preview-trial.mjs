// One-off trial of the "spec" preview engine.
//
// Generates spec-engine previews for a few named leads and prints the measured
// cost, so the output can be compared against the AI previews those same leads
// already have. Deliberately does NOT write to the Lead table: the existing
// previewHtmlPath/previewImagePath stay pointed at the AI builds, so nothing
// that cost real money gets orphaned by a trial run.
// Every app module is imported through app() rather than a static import: the
// resolve hook that teaches node the "@/" alias is registered by the module
// below, and static imports are resolved before any module body runs.
import { app } from "./lib/app-imports.mjs";

const { prisma } = await app("src/lib/prisma.ts");
const { getCachedDetails } = await app("src/lib/places.ts");
const { fetchPreviewPhotos } = await app("src/lib/preview/photos.ts");
const { fetchStaticMap } = await app("src/lib/preview/staticMap.ts");
const { generateSiteSpec } = await app("src/lib/preview/spec.ts");
const { generateSiteHtml } = await app("src/lib/preview/template.ts");
const { renderPreview } = await app("src/lib/preview/render.ts");

// --template renders the same lead through the plain deterministic template
// (no API call, no spend), so the two tiers can be compared on one business.
const PLAIN = process.argv.includes("--template");
// --design=<id> renders a full-page design instead of the hero archetypes.
const DESIGN = process.argv.find((a) => a.startsWith("--design="))?.split("=")[1];
const NAMES = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (!NAMES.length) {
  console.error("usage: node scripts/spec-preview-trial.mjs [--template] <lead name substring> ...");
  process.exit(1);
}

const started = new Date();

for (const needle of NAMES) {
  const lead = await prisma.lead.findFirst({
    where: { name: { contains: needle } },
    include: { searchRun: true },
  });
  if (!lead) {
    console.log(`\n— no lead matching "${needle}"`);
    continue;
  }

  const details = await getCachedDetails(lead.placeId);
  if (!details) {
    console.log(`\n— ${lead.name}: no cached details, skipping`);
    continue;
  }

  console.log(`\n=== ${lead.name} ===`);
  const photos = await fetchPreviewPhotos(lead.placeId, details.photoRefs);
  const mapUri = await fetchStaticMap(lead.placeId, details);
  const searchHint = lead.searchRun?.query ?? "";

  const spec = PLAIN ? null : await generateSiteSpec(details, searchHint);
  if (!PLAIN && !spec) {
    console.log("  spec generation returned null — would fall back to the plain template");
    continue;
  }
  if (spec) {
    console.log(`  eyebrow   : ${spec.eyebrow ?? "(default)"}`);
    console.log(`  tagline   : ${spec.tagline}`);
    for (const s of spec.services ?? []) console.log(`  service   : ${s.title} — ${s.blurb}`);
  } else {
    console.log("  (plain template — canned copy, no API call)");
  }

  const html = generateSiteHtml(details, searchHint, photos, mapUri, 0, spec ?? undefined, DESIGN);
  const rendered = await renderPreview(lead.placeId, html, DESIGN ?? (spec ? "spec" : "template"), 0);
  console.log(`  rendered  : ${rendered.imagePath}`);
}

// Cost for exactly the calls this run made.
const rows = await prisma.aiUsage.findMany({ where: { createdAt: { gte: started } } });
const total = rows.reduce((sum, r) => sum + r.costUsd, 0);
console.log(`\n── ${rows.length} billed call(s), $${total.toFixed(4)} total`);
for (const r of rows) {
  console.log(
    `   ${r.purpose} (${r.model}): ${r.inputTokens} in / ${r.outputTokens} out = $${r.costUsd.toFixed(4)}`,
  );
}
if (rows.length) console.log(`   average per preview: $${(total / rows.length).toFixed(4)}`);
await prisma.$disconnect();
