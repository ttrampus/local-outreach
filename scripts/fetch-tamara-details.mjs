// One-off: refresh the Tamara place (template 01's real business) into the same
// shape as the other showcase places.
//
// The business-data block shipped in t01 carried Google's TRUNCATED review
// snippets ("…svetujejo, kak…") and no per-review rating, so the template's
// "drop anything under 4 stars" guard had nothing to act on. This pulls the
// full review objects, and rebuilds her web photos from the bytes already
// cached on disk — so it costs one Place Details call and no photo calls.
import { mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { ROOT } from "./lib/app-imports.mjs";

const PLACE_ID = "ChIJY3ogh4UyZUcRMyVSb1MGOw4"; // Frizerski studio Tamara
const SLUG = "t01";
const BASE = "https://places.googleapis.com/v1";
const OUT_JSON = path.join(ROOT, "data", "showcase-places.json");

const envText = await readFile(path.join(ROOT, ".env.local"), "utf8");
const envOf = (key) => {
  const line = envText.split("\n").find((l) => l.trim().startsWith(`${key}=`));
  return line ? line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "") : "";
};
const API_KEY = envOf("GOOGLE_PLACES_API_KEY");
const LANG = envOf("GOOGLE_PLACES_LANGUAGE") || "sl";

const FIELD_MASK = [
  "id", "displayName", "formattedAddress", "internationalPhoneNumber", "websiteUri",
  "rating", "userRatingCount", "photos", "businessStatus", "regularOpeningHours",
  "types", "primaryType", "primaryTypeDisplayName", "googleMapsUri", "reviews",
].join(",");

const res = await fetch(`${BASE}/places/${PLACE_ID}?languageCode=${LANG}`, {
  headers: { "X-Goog-Api-Key": API_KEY, "X-Goog-FieldMask": FIELD_MASK },
});
if (!res.ok) throw new Error(`details ${res.status}: ${await res.text()}`);
const place = await res.json();
console.log(`${place.displayName?.text} — ${place.rating}★ / ${place.userRatingCount}, ${place.reviews?.length ?? 0} reviews`);

// Web copies from the archived originals. Only four were ever cached (the
// preview generator's photo budget at the time), so top the archive up to the
// same eight the other showcase pages get before converting.
const archive = path.join(ROOT, "data", "place-photos", PLACE_ID);
const web = path.join(ROOT, "public", "site", "work", "photos", SLUG);
await mkdir(web, { recursive: true });
let topUps = 0;
{
  const have = (await readdir(archive)).filter((f) => /^\d\d\./i.test(f)).length;
  const refs = (place.photos ?? []).slice(0, 8);
  for (let i = have; i < refs.length; i++) {
    const url = `${BASE}/${refs[i].name}/media?maxHeightPx=4800&maxWidthPx=4800&skipHttpRedirect=false`;
    const r = await fetch(url, { headers: { "X-Goog-Api-Key": API_KEY } });
    if (!r.ok) continue;
    const buf = Buffer.from(await r.arrayBuffer());
    if (!buf.byteLength) continue;
    await writeFile(path.join(archive, `${String(i).padStart(2, "0")}.jpg`), buf);
    topUps++;
  }
}
const files = (await readdir(archive)).filter((f) => /^\d\d\.(jpg|jpeg|png|webp)$/i.test(f)).sort();
const photos = [];
for (const f of files.slice(0, 8)) {
  const stem = path.parse(f).name;
  const out = await sharp(await readFile(path.join(archive, f)))
    .rotate()
    .resize({ width: 1800, height: 1800, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
  await writeFile(path.join(web, `${stem}.webp`), out);
  const meta = await sharp(out).metadata();
  photos.push({ src: `photos/${SLUG}/${stem}.webp`, width: meta.width, height: meta.height });
}
console.log(`${photos.length} photos → public/site/work/photos/${SLUG}/`);

const all = JSON.parse(await readFile(OUT_JSON, "utf8"));
const entry = { slug: SLUG, type: "Frizerski salon", place, photos };
const at = all.findIndex((c) => c.slug === SLUG);
if (at === -1) all.unshift(entry);
else all[at] = entry;
await writeFile(OUT_JSON, JSON.stringify(all, null, 2));
console.log(`billed: 1 Place Details (Enterprise+Atmosphere), ${topUps} Place Photos`);
