// Populate every template with deliberately hostile lead data, then audit the
// result at every viewport.
//
//   node scripts/responsive-stress.mjs [--keep] [--only=t01,t04]
//
// The templates are only ever seen by a human with their placeholder content.
// What actually ships is a template filled from a Google Place: a name that runs
// to sixty characters, an address with no spaces to break on, twelve services or
// none, fourteen photos or zero, a review that is one 300-character sentence.
// Each fixture below is one of those failure shapes, and the audit has to come
// back clean for all of them — "looks right with the demo data" is not a test.
//
// Photos are SVG data URIs at controlled dimensions: deterministic, offline, and
// they let a fixture ask for a 3:1 panorama or a 1:3 tower on purpose.
import { readFile, writeFile, mkdir, rm, readdir } from "node:fs/promises";
import path from "node:path";
import { auditTargets, VIEWPORTS } from "./responsive-audit.mjs";

const ROOT = process.cwd();
const TEMPLATE_DIR = path.join(ROOT, "templates");
const OUT = path.join(ROOT, ".stress");

function photo(w, h, i) {
  const hue = (i * 47) % 360;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
    `<rect width="100%" height="100%" fill="hsl(${hue} 35% 62%)"/>` +
    `<text x="50%" y="50%" font-family="sans-serif" font-size="${Math.round(Math.min(w, h) / 6)}" ` +
    `fill="rgba(255,255,255,.85)" text-anchor="middle" dominant-baseline="middle">${w}×${h}</text></svg>`;
  return { src: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`, width: w, height: h };
}

const LONG_NAME =
  "Frizerski in kozmetični salon Lepota ter dobro počutje Marjana Kovačič Novak s.p.";
const LONG_WORD = "Donaudampfschifffahrtsgesellschaftskapitaen";

function services(n, long) {
  return Array.from({ length: n }, (_, i) => ({
    name: long
      ? `Celovita nega las in lasišča s toplotno obdelavo ${i + 1}`
      : `Storitev ${i + 1}`,
    desc: long
      ? "Daljši opis storitve, ki se razteza čez več vrstic in preizkusi, ali kartica " +
        "raste navzdol namesto da bi razbila mrežo ali povozila sosednjo celico."
      : "Kratek opis.",
    price: long ? "od 129,90 €" : "20 €",
    category: ["Kava", "Zajtrk", "Sladice"][i % 3],
    note: String.fromCharCode(65 + (i % 26)),
  }));
}

function reviews(n, long) {
  return Array.from({ length: n }, () => ({
    rating: 5,
    author: long ? "Marija Novak Kovačič Podlesnik" : "A",
    text: long
      ? "Zelo sem zadovoljna s storitvijo in odnosom, saj so si vzeli čas, razložili " +
        "vse po vrsti in poskrbeli, da sem odšla nasmejana ter povsem prepričana, da " +
        "se bom z veseljem vrnila tudi naslednjič in pripeljala še koga s sabo."
      : "Super!",
  }));
}

const HOURS_FULL = [
  "ponedeljek: 7:00–15:00",
  "torek: 7:00–15:00",
  "sreda: 12:00–20:00",
  "četrtek: 7:00–15:00",
  "petek: 7:00–13:00",
  "sobota: Zaprto",
  "nedelja: Zaprto",
];

// --------------------------------------------------------------------------
// The fixtures. Each is a complete business-data block.
// --------------------------------------------------------------------------
const FIXTURES = {
  // Everything at its longest and most numerous at once.
  maximal: {
    name_raw: LONG_NAME,
    name: "Frizerski in kozmetični salon Lepota ter dobro počutje",
    short_name: "Lepota ter dobro počutje",
    type: "Frizerski, kozmetični in pedikerski salon",
    categories: ["hair_salon", "beauty_salon", "spa"],
    address: "Ulica bratov Učakar 132, 1000 Ljubljana - Šentvid, Slovenija",
    phone: "+386 (0)1 500 60 70",
    email: "rezervacije@lepota-in-dobro-pocutje-ljubljana.si",
    rating: 4.9,
    review_count: 1284,
    hours: HOURS_FULL,
    reviews: reviews(8, true),
    photos: [
      photo(3000, 1000, 1), // panorama
      photo(1200, 2400, 2), // tower
      photo(2400, 1600, 3),
      photo(1600, 1600, 4),
      photo(4000, 1200, 5),
      photo(900, 1800, 6),
      ...Array.from({ length: 8 }, (_, i) => photo(1800, 1200, i + 7)),
    ],
    services: services(12, true),
    instagram: "https://instagram.com/lepota-in-dobro-pocutje-ljubljana",
    facebook: "https://facebook.com/lepota-in-dobro-pocutje-ljubljana",
    booking_url: "https://rezervacije.example.si/lepota-in-dobro-pocutje/termin",
    map_mode: "click",
  },

  // The other end: a business Google barely knows anything about.
  minimal: {
    name_raw: "Ana",
    name: "Ana",
    short_name: "Ana",
    type: "Salon",
    categories: [],
    address: "Trg 1, Bled",
    phone: "+386 40 111 222",
    hours: [],
    reviews: [],
    photos: [],
    map_mode: "click",
  },

  // One unbreakable token everywhere a name is printed — the case that defeats
  // wrapping entirely and can only be handled by shrinking or breaking.
  unbreakable: {
    name_raw: LONG_WORD,
    name: LONG_WORD,
    short_name: LONG_WORD,
    type: LONG_WORD,
    categories: ["carpenter"],
    address: `${LONG_WORD} 14, ${LONG_WORD}, Slovenija`,
    phone: "+386 31 000 000",
    email: `narocila@${LONG_WORD.toLowerCase()}.si`,
    rating: 3.9,
    review_count: 7,
    hours: [`ponedeljek: 0:00–23:59`, "nedelja: Zaprto"],
    reviews: reviews(2, false),
    photos: [photo(2000, 1333, 11), photo(1000, 1000, 12)],
    services: services(2, false),
    map_mode: "click",
  },

  // Awkward middles: an odd service count, one review, two photos of opposite
  // shapes — the counts that leave grids half-empty rather than overflowing.
  sparse: {
    name_raw: "Mizarstvo Kovač d.o.o.",
    name: "Mizarstvo Kovač",
    short_name: "Kovač",
    type: "Mizarstvo",
    categories: ["carpenter"],
    address: "Obrtna cesta 3, 4000 Kranj",
    phone: "+386 4 201 30 40",
    rating: 5,
    review_count: 3,
    hours: ["ponedeljek: 8:00–16:00", "sobota: Zaprto"],
    reviews: reviews(1, true),
    photos: [photo(3600, 1000, 21), photo(800, 2000, 22)],
    services: services(1, true),
    map_mode: "click",
  },

  // A plain, realistic business — the control.
  typical: {
    name_raw: "Kavarna Zrno d.o.o.",
    name: "Kavarna Zrno",
    short_name: "Zrno",
    type: "Kavarna",
    categories: ["cafe", "bakery"],
    address: "Slovenska cesta 55, 1000 Ljubljana",
    phone: "+386 1 234 56 78",
    email: "info@zrno.si",
    rating: 4.6,
    review_count: 214,
    hours: HOURS_FULL,
    reviews: reviews(4, false),
    photos: Array.from({ length: 6 }, (_, i) => photo(1800, 1200, i + 31)),
    services: services(6, false),
    map_mode: "click",
  },
};

const BLOCK = /(<script type="application\/json" id="business-data">)[\s\S]*?(<\/script>)/;

const only = process.argv.find((a) => a.startsWith("--only="))?.split("=")[1]?.split(",");

const templates = (await readdir(TEMPLATE_DIR))
  .filter((f) => /^t\d\d-.*\.html$/.test(f))
  .filter((f) => !only || only.some((p) => f.startsWith(p)))
  .sort();

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

const built = [];
for (const t of templates) {
  const src = await readFile(path.join(TEMPLATE_DIR, t), "utf8");
  if (!BLOCK.test(src)) {
    console.error(`${t}: no business-data block`);
    continue;
  }
  for (const [fixture, data] of Object.entries(FIXTURES)) {
    const html = src.replace(
      BLOCK,
      (_m, open, close) => `${open}\n${JSON.stringify(data, null, 2)}\n${close}`,
    );
    const file = path.join(OUT, `${t.slice(0, 3)}--${fixture}.html`);
    await writeFile(file, html);
    built.push(file);
  }
}

console.log(`built ${built.length} stress pages (${templates.length} templates × ${Object.keys(FIXTURES).length} fixtures)`);

// Phones and tablet portrait are where content-driven breakage shows up; the
// desktop widths are included so a fix for mobile cannot quietly break them.
const report = await auditTargets(built, VIEWPORTS);

let total = 0;
const byTemplate = new Map();
for (const { target, results } of report) {
  const seen = new Map();
  for (const r of results) {
    for (const p of r.problems) {
      const key = `${p.kind}|${p.detail}`;
      if (!seen.has(key)) seen.set(key, { ...p, at: [] });
      seen.get(key).at.push(r.width);
    }
  }
  total += seen.size;
  const name = path.basename(target, ".html");
  if (seen.size) byTemplate.set(name, [...seen.values()]);
}

for (const [name, problems] of byTemplate) {
  console.log(`\n${name} — ${problems.length}`);
  for (const p of problems.slice(0, 25)) {
    console.log(`  [${p.kind}] @${p.at.join(",")} — ${p.detail}`);
  }
  if (problems.length > 25) console.log(`  … and ${problems.length - 25} more`);
}

console.log(`\n${total} distinct issue(s) across ${built.length} stress pages.`);
if (!process.argv.includes("--keep")) await rm(OUT, { recursive: true, force: true });
process.exit(total ? 1 : 0);
