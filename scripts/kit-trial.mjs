// Trial the "kit" engine over a spread of cached leads: pick one of the ten
// templates/ per business, fill it, render it, and print what each lead got.
//
// Free and offline: photos are read from the on-disk cache only (photoRefs are
// deliberately not passed, so a missing cache yields a no-photo page rather than
// a billed Place Photos call), and the kit engine itself makes no API calls.
//
//   node --import ./scripts/lib/app-imports.mjs scripts/kit-trial.mjs [limit]
import { ROOT } from "./lib/app-imports.mjs";
import path from "node:path";
import { access } from "node:fs/promises";

const { prisma } = await import("@/lib/prisma");
const { generateKitSiteHtml, pickTemplate } = await import("@/lib/preview/kit");
const { fetchPreviewPhotos } = await import("@/lib/preview/photos");
const { renderPreview } = await import("@/lib/preview/render");
const { injectContactForm } = await import("@/lib/preview/contactForm");
const { detectLocale } = await import("@/lib/preview/i18n");

// --cache widens the pool from real leads to every cached place. The lead table
// is nearly all hair salons, so it exercises three templates out of ten; the
// cache has restaurants, a café, garages and a pile of uncategorizable places,
// which is what the other seven and the generic hosts need.
const CACHE_MODE = process.argv.includes("--cache");
const LIMIT = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 12);

const leads = CACHE_MODE
  ? (await prisma.placeCache.findMany()).map((c) => ({ id: "trial", placeId: c.placeId }))
  : await prisma.lead.findMany({ orderBy: { createdAt: "asc" } });
const cache = new Map(
  (await prisma.placeCache.findMany()).map((c) => [c.placeId, JSON.parse(c.raw)]),
);

// One lead per template choice first, then fill the rest — a run of twelve hair
// salons says nothing about whether the other nine templates work.
const seen = new Set();
const spread = [];
const rest = [];
for (const lead of leads) {
  const details = cache.get(lead.placeId);
  if (!details) continue;
  const { template, generic } = pickTemplate(details, details.photoCount ?? 0);
  const key = `${template.id}${generic ? ":generic" : ""}`;
  (seen.has(key) ? rest : spread).push({ lead, details, key });
  seen.add(key);
}
const chosen = [...spread, ...rest].slice(0, LIMIT);

console.log(`${leads.length} leads, ${cache.size} cached, ${seen.size} distinct template choices`);
console.log(`rendering ${chosen.length}…\n`);

for (const { lead, details } of chosen) {
  const photoDir = path.join(ROOT, "data", "place-photos", lead.placeId.replace(/[^\w-]/g, "_"));
  const hasPhotos = await access(photoDir).then(
    () => true,
    () => false,
  );
  // undefined refs → cache-only, never a download.
  const photos = hasPhotos ? await fetchPreviewPhotos(lead.placeId, undefined) : [];

  const kit = await generateKitSiteHtml(details, photos);
  const engine = `kit:${kit.template.id}`;
  const html = injectContactForm(kit.html, lead.id, detectLocale(details));
  const { imagePath } = await renderPreview(lead.placeId, html, engine, 0);

  console.log(
    [
      kit.template.id.padEnd(4),
      (kit.generic ? "generic" : "on-type").padEnd(8),
      String(details.primaryType ?? "?").padEnd(24),
      `${photos.length}p`.padEnd(4),
      imagePath.padEnd(46),
      details.name,
    ].join(" "),
  );
}
