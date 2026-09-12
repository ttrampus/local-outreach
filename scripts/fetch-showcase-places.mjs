// Fetch real Google Places data for the showcase pages on the marketing site.
//
// The lead database only ever swept hair salons, so seven of the ten templates
// (dentist, restaurant, café, garage, joinery, photographer, driving school)
// have no real business to fill them. This does one Text Search per category
// with the FULL detail field mask — Text Search at the Enterprise+Atmosphere
// tier returns reviews and hours inline, so one billed call per category
// replaces a search + a details call.
//
// Two fields the app's own google.ts does not ask for matter here:
//   · reviews[].rating          — the templates drop reviews below 4 stars
//   · photos[].widthPx/heightPx — the templates place photos by size and shape
//
//   node --import ./scripts/lib/app-imports.mjs scripts/fetch-showcase-places.mjs
//   node ... scripts/fetch-showcase-places.mjs --dry     (search only, no photos)
import { mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { ROOT } from "./lib/app-imports.mjs";

const BASE = "https://places.googleapis.com/v1";
const DRY = process.argv.includes("--dry");
const PHOTOS_PER_PLACE = 8;
const OUT_JSON = path.join(ROOT, "data", "showcase-places.json");
const ARCHIVE_DIR = path.join(ROOT, "data", "place-photos");
const WEB_DIR = path.join(ROOT, "public", "site", "work", "photos");

// Read the key straight out of .env.local: this script is deliberately outside
// the app's env module so it can run without the whole Next config graph.
const envText = await readFile(path.join(ROOT, ".env.local"), "utf8");
const envOf = (key) => {
  const line = envText.split("\n").find((l) => l.trim().startsWith(`${key}=`));
  return line ? line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "") : "";
};
const API_KEY = envOf("GOOGLE_PLACES_API_KEY");
const LANG = envOf("GOOGLE_PLACES_LANGUAGE") || "sl";
if (!API_KEY) throw new Error("GOOGLE_PLACES_API_KEY missing from .env.local");

const FIELD_MASK = [
  "id",
  "displayName",
  "formattedAddress",
  "internationalPhoneNumber",
  "websiteUri",
  "rating",
  "userRatingCount",
  "photos",
  "businessStatus",
  "regularOpeningHours",
  "types",
  "primaryType",
  "primaryTypeDisplayName",
  "googleMapsUri",
  "reviews",
]
  .map((f) => `places.${f}`)
  .join(",");

// One entry per template that needs filling. `type` is the human category the
// template prints; `queries` are tried in order until a candidate passes.
const TARGETS = [
  { slug: "t02", type: "Masažni in wellness salon", queries: ["masažni salon Ljubljana", "wellness masaže Ljubljana"] },
  { slug: "t03", type: "Brivnica", queries: ["brivnica Ljubljana", "barbershop Ljubljana"] },
  { slug: "t04", type: "Fotografski studio", queries: ["fotografski studio Ljubljana", "fotograf Ljubljana"] },
  { slug: "t05", type: "Avtošola", queries: ["avtošola Ljubljana"] },
  { slug: "t06", type: "Gostilna", queries: ["gostilna Ljubljana", "restavracija Ljubljana"] },
  { slug: "t07", type: "Mizarstvo", queries: ["mizarstvo Ljubljana", "mizar po meri Ljubljana"] },
  { slug: "t08", type: "Kavarna", queries: ["kavarna Ljubljana", "kavarna in pekarna Ljubljana"] },
  { slug: "t09", type: "Avtoservis", queries: ["avtoservis Ljubljana", "avtomehanik Ljubljana"] },
  { slug: "t10", type: "Zobozdravstvena ordinacija", queries: ["zobozdravstvena ordinacija Ljubljana", "zobozdravnik Ljubljana"] },
];

async function searchText(textQuery) {
  const res = await fetch(`${BASE}/places:searchText`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": API_KEY,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({ textQuery, languageCode: LANG, maxResultCount: 20 }),
  });
  if (!res.ok) throw new Error(`searchText ${res.status}: ${await res.text()}`);
  return (await res.json()).places ?? [];
}

/**
 * A candidate has to be able to carry a whole page: open for business, well
 * reviewed enough that the rating is worth printing, with hours to drive the
 * open/closed line and enough photos to fill the gallery.
 */
function usable(p) {
  return (
    p.businessStatus === "OPERATIONAL" &&
    (p.rating ?? 0) >= 4.4 &&
    (p.userRatingCount ?? 0) >= 25 &&
    (p.regularOpeningHours?.weekdayDescriptions?.length ?? 0) >= 7 &&
    (p.photos?.length ?? 0) >= 5 &&
    Boolean(p.internationalPhoneNumber) &&
    (p.reviews ?? []).filter((r) => (r.rating ?? 0) >= 4).length >= 2
  );
}

function score(p) {
  // Prefer a lot of recent-looking social proof, then photo depth.
  return (p.rating ?? 0) * 20 + Math.min(p.userRatingCount ?? 0, 400) / 10 + Math.min(p.photos?.length ?? 0, 10);
}

async function fetchPhoto(photoName) {
  const url = `${BASE}/${photoName}/media?maxHeightPx=4800&maxWidthPx=4800&skipHttpRedirect=false`;
  const res = await fetch(url, { headers: { "X-Goog-Api-Key": API_KEY } });
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.byteLength ? buf : null;
}

const chosen = [];
const taken = new Set();
let searchCalls = 0;
let photoCalls = 0;

for (const target of TARGETS) {
  let pick = null;
  for (const q of target.queries) {
    const places = await searchText(q);
    searchCalls++;
    const ranked = places
      .filter((p) => usable(p) && !taken.has(p.id))
      .sort((a, b) => score(b) - score(a));
    console.log(`[${target.slug}] "${q}" → ${places.length} results, ${ranked.length} usable`);
    if (ranked.length) {
      pick = ranked[0];
      break;
    }
  }
  if (!pick) {
    console.warn(`[${target.slug}] NO CANDIDATE — leaving unfilled`);
    continue;
  }
  taken.add(pick.id);
  console.log(`  → ${pick.displayName?.text} (${pick.rating}★ / ${pick.userRatingCount}) ${pick.id}`);
  chosen.push({ ...target, place: pick });
}

// Photos: archived under the same data/place-photos/<placeId>/ layout the app
// uses, so a later preview regeneration for one of these places reads the cache
// instead of re-billing, and a web-sized WebP copy for the showcase page.
if (!DRY) {
  for (const c of chosen) {
    const id = c.place.id;
    const archive = path.join(ARCHIVE_DIR, id);
    const web = path.join(WEB_DIR, c.slug);
    await mkdir(archive, { recursive: true });
    await mkdir(web, { recursive: true });

    const cachedNames = existsSync(archive)
      ? (await readdir(archive)).filter((f) => /^\d\d\.(jpg|png|webp)$/.test(f)).sort()
      : [];

    const refs = (c.place.photos ?? []).slice(0, PHOTOS_PER_PLACE);
    c.photos = [];
    for (let i = 0; i < refs.length; i++) {
      const stem = String(i).padStart(2, "0");
      let buf = null;
      const hit = cachedNames.find((f) => f.startsWith(stem));
      if (hit) {
        buf = await readFile(path.join(archive, hit));
      } else {
        buf = await fetchPhoto(refs[i].name);
        if (!buf) continue;
        photoCalls++;
        await writeFile(path.join(archive, `${stem}.jpg`), buf);
      }
      // 1800px long edge: enough for the templates' hi-res hero threshold
      // (~1.5 MP) without shipping a 4800px original to a phone.
      const img = sharp(buf).rotate();
      const meta = await img.metadata();
      const out = await img.resize({ width: 1800, height: 1800, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
      await writeFile(path.join(web, `${stem}.webp`), out);
      const shaped = await sharp(out).metadata();
      c.photos.push({
        src: `photos/${c.slug}/${stem}.webp`,
        width: shaped.width,
        height: shaped.height,
        original: { width: meta.width, height: meta.height },
      });
    }
    console.log(`[${c.slug}] ${c.photos.length} photos → public/site/work/photos/${c.slug}/`);
  }
}

await mkdir(path.dirname(OUT_JSON), { recursive: true });
await writeFile(OUT_JSON, JSON.stringify(chosen, null, 2));
console.log(`\nwrote ${OUT_JSON}`);
console.log(`billed: ${searchCalls} Text Search (Enterprise+Atmosphere), ${photoCalls} Place Photos`);
