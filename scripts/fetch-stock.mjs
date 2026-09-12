// Curate the category stock sets in assets/stock/ from Pexels.
//
// Run once per set, by hand, then LOOK at the contact sheet before committing:
//
//   PEXELS_API_KEY=... node --import ./scripts/lib/app-imports.mjs scripts/fetch-stock.mjs hair
//   node --import ./scripts/lib/app-imports.mjs scripts/fetch-stock.mjs hair --keep 1,4,7,9
//
// The first form searches, filters and writes candidates plus sheet.jpg. The
// second prunes the set to the numbered keepers and writes manifest.json, which
// is what src/lib/preview/stock.ts reads. Nothing here runs at generation time,
// so stock costs nothing per lead.
//
// Pexels' licence allows commercial use with no attribution. The automatic filter
// uses the same local CLIP model as photoRoles.ts to drop people, macro
// close-ups and anything with text; the human pass is still required, because
// "a hairdresser's chair" photographed with a stranger in it is exactly the stock
// picture that reads as "here is your staff" on someone else's business.
import { ROOT } from "./lib/app-imports.mjs";
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

// People-free phrasing on purpose: Pexels ranks by relevance, and "salon" alone
// returns mostly portraits.
const QUERIES = {
  hair: ["empty hair salon interior", "salon chairs mirrors", "hairdresser scissors comb", "hair salon products shelf", "hair dryer brushes"],
  spa: ["spa treatment room", "massage stones towels", "spa candles", "skincare products bottles", "wellness spa interior"],
  barber: ["empty barbershop interior", "barber chair", "straight razor shaving brush", "barber tools"],
  photo: ["photography studio lighting", "vintage camera", "camera lens", "photo studio backdrop"],
  driving: ["car steering wheel interior", "empty road aerial", "car dashboard", "road markings"],
  restaurant: ["restaurant interior empty", "grilled meat plate", "plated dish restaurant", "restaurant table setting", "wood fired oven"],
  carpentry: ["woodworking workshop", "carpentry tools wood", "wooden furniture handmade", "wood planks texture", "joinery"],
  cafe: ["cafe interior empty", "latte art coffee cup", "espresso machine", "croissants bakery", "coffee beans"],
  garage: ["auto repair garage interior", "car engine bay", "mechanic tools wrench", "car tire wheel", "car lift garage"],
  dental: ["dental clinic interior", "dentist chair", "dental tools", "clean medical clinic"],
  neutral: ["minimal interior natural light", "plant by window", "wooden table texture", "modern office interior empty"],
};

const OUT = path.join(ROOT, "assets", "stock");
const PER_QUERY = 12;
const MAX_EDGE = 1600;
const set = process.argv[2];
const keepIdx = process.argv.indexOf("--keep");

if (!set || !QUERIES[set]) {
  console.error(`usage: fetch-stock.mjs <${Object.keys(QUERIES).join("|")}> [--keep 1,2,3]`);
  process.exit(1);
}
const dir = path.join(OUT, set);

if (keepIdx > 0) {
  const keep = new Set(process.argv[keepIdx + 1].split(",").map((n) => n.trim().padStart(2, "0")));
  // Renumber into a fresh directory, then swap. Renaming in place clobbers
  // candidates not yet read: keeping 00 writes 01.webp over the original 01.
  const staged = `${dir}.keep`;
  await rm(staged, { recursive: true, force: true });
  await mkdir(staged, { recursive: true });
  const manifest = [];
  for (const f of (await readdir(dir)).filter((f) => f.endsWith(".webp")).sort()) {
    if (!keep.has(f.slice(0, 2))) continue;
    const src = path.join(dir, f);
    const meta = JSON.parse(await readFile(`${src}.json`, "utf8"));
    const name = `${String(manifest.length + 1).padStart(2, "0")}.webp`;
    await writeFile(path.join(staged, name), await readFile(src));
    manifest.push({ file: name, width: meta.width, height: meta.height, source: meta.source, photographer: meta.photographer });
  }
  if (manifest.length !== keep.size) {
    await rm(staged, { recursive: true, force: true });
    console.error(`${set}: asked to keep ${keep.size}, found ${manifest.length} — nothing changed`);
    process.exit(1);
  }
  await writeFile(path.join(staged, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  await rm(dir, { recursive: true, force: true });
  await rename(staged, dir);
  console.log(`${set}: kept ${manifest.length}`);
  process.exit(0);
}

const key = process.env.PEXELS_API_KEY;
if (!key) {
  console.error("PEXELS_API_KEY is not set (free at https://www.pexels.com/api/)");
  process.exit(1);
}

const tf = await import("@huggingface/transformers");
tf.env.cacheDir = path.join(ROOT, "data", "models");
const clf = await tf.pipeline("zero-shot-image-classification", "Xenova/clip-vit-base-patch32", { dtype: "q8" });
const LABELS = {
  // CLIP scores are relative across labels, so this wording is per set: naming
  // cars and cameras for every set pulls "ok" probability away from rooms and
  // food, and the restaurant set dropped from 41 candidates to 6.
  ok: ["driving", "photo", "garage"].includes(set)
    ? "a photo of a room, a car, a road, a camera, equipment, tools, materials, products or food with no people"
    : "a photo of a room, tools, materials, products or food with no people",
  person: "a photo with a person, a face, hands or people in it",
  closeup: "an extreme close-up macro photo of an eye, skin, lips or fingernails",
  text: "a logo, sign, poster or an image with text",
};
const L = Object.keys(LABELS), T = L.map((k) => LABELS[k]);

await rm(dir, { recursive: true, force: true });
await mkdir(dir, { recursive: true });

// The network drops requests now and then; one timeout should cost a retry,
// not the whole set.
async function fetchRetry(url, init, tries = 4) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(30_000) });
      if (res.ok || i >= tries || (res.status < 500 && res.status !== 429)) return res;
    } catch (err) {
      if (i >= tries) throw err;
    }
    await new Promise((r) => setTimeout(r, 1500 * i));
  }
}

const seen = new Set();
let n = 0;
for (const q of QUERIES[set]) {
  const res = await fetchRetry(
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&orientation=landscape&size=large&per_page=${PER_QUERY}`,
    { headers: { Authorization: key } },
  );
  if (!res.ok) {
    console.error(`${q}: HTTP ${res.status}`);
    continue;
  }
  const { photos = [] } = await res.json();
  for (const p of photos) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    try {
      const img = await fetchRetry(p.src.large2x);
      if (!img.ok) continue;
      const raw = Buffer.from(await img.arrayBuffer());

      const { data, info } = await sharp(raw).resize(336, 336, { fit: "inside" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const out = await clf(new tf.RawImage(new Uint8ClampedArray(data), info.width, info.height, 3), T);
      const verdict = L[T.indexOf(out[0].label)];
      const personScore = out.find((o) => o.label === LABELS.person)?.score ?? 0;
      // "ok" winning is not enough: a hand at the edge of a tools shot still reads
      // as a person on a stranger's site, so any real person signal is a reject.
      if (verdict !== "ok" || out[0].score < 0.55 || personScore >= 0.12) continue;

      const webp = await sharp(raw).resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true }).webp({ quality: 72 }).toBuffer();
      const meta = await sharp(webp).metadata();
      const name = `${String(n++).padStart(2, "0")}.webp`;
      await writeFile(path.join(dir, name), webp);
      await writeFile(path.join(dir, `${name}.json`), JSON.stringify({ width: meta.width, height: meta.height, source: p.url, photographer: p.photographer, query: q }));
    } catch (err) {
      console.error(`${set} · photo ${p.id} skipped: ${err.message}`);
    }
  }
  console.log(`${set} · ${q}: ${n} kept so far`);
}

// Numbered contact sheet, 5 across, for the human pass.
const files = (await readdir(dir)).filter((f) => f.endsWith(".webp")).sort();
const W = 320, H = 213, C = 5;
const tiles = await Promise.all(files.map(async (f, i) => ({
  input: await sharp(path.join(dir, f)).resize(W, H, { fit: "cover" }).composite([{
    input: Buffer.from(`<svg width="${W}" height="${H}"><rect width="40" height="28" fill="black"/><text x="6" y="21" font-size="20" font-family="sans-serif" fill="yellow">${f.slice(0, 2)}</text></svg>`),
  }]).toBuffer(),
  left: (i % C) * W,
  top: Math.floor(i / C) * H,
})));
if (tiles.length) {
  await sharp({ create: { width: C * W, height: Math.ceil(files.length / C) * H, channels: 3, background: "#111" } })
    .composite(tiles).jpeg({ quality: 78 }).toFile(path.join(dir, "sheet.jpg"));
}
console.log(`${set}: ${files.length} candidates → ${path.join(dir, "sheet.jpg")}`);
