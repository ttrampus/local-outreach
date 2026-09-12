// Responsive stress test for the generated-site engine (src/lib/preview).
//
//   node --import ./scripts/lib/app-imports.mjs scripts/responsive-stress-designs.mjs [--keep]
//
// The counterpart to responsive-stress.mjs, which covers the ten hand-built
// templates. This one renders every full-page Design and every legacy hero
// archetype through generateSiteHtml with the same kind of hostile lead data,
// then audits each at every viewport.
import { writeFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { ROOT } from "./lib/app-imports.mjs";
import { generateSiteHtml } from "@/lib/preview/template";
import { DESIGN_IDS } from "@/lib/preview/designs";
import { auditTargets, VIEWPORTS } from "./responsive-audit.mjs";

const OUT = path.join(ROOT, ".stress-designs");

function photo(w, h, i) {
  const hue = (i * 53) % 360;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
    `<rect width="100%" height="100%" fill="hsl(${hue} 32% 58%)"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const LONG_WORD = "Donaudampfschifffahrtsgesellschaftskapitaen";

// Each fixture is [label, place, photos].
const FIXTURES = [
  [
    "maximal",
    {
      placeId: "stress-max",
      name: "Frizerski in kozmetični salon Lepota ter dobro počutje Marjana Kovačič s.p.",
      address: "Ulica bratov Učakar 132, 1000 Ljubljana - Šentvid, Slovenija",
      phone: "+386 (0)1 500 60 70",
      website: "https://www.lepota-in-dobro-pocutje-ljubljana.si/rezervacije",
      rating: 4.9,
      reviewCount: 1284,
      photoCount: 14,
      reviewSnippets: [
        "Zelo sem zadovoljna s storitvijo in odnosom, saj so si vzeli čas, razložili vse po vrsti in poskrbeli, da sem odšla nasmejana ter povsem prepričana, da se bom vrnila.",
        "Vedno odlično. Prijazno osebje, čisto in urejeno, termini so vedno na voljo tudi v zadnjem trenutku, kar je pri nas velika redkost.",
        "Priporočam vsem, ki iščejo nekoga, ki zna prisluhniti.",
      ],
      categories: ["hair_salon", "beauty_salon", "spa"],
      openingHours: [
        "ponedeljek: 7:00–15:00",
        "torek: 7:00–15:00",
        "sreda: 12:00–20:00",
        "četrtek: 7:00–15:00",
        "petek: 7:00–13:00",
        "sobota: Zaprto",
        "nedelja: Zaprto",
      ],
    },
    [photo(3000, 1000, 1), photo(1200, 2400, 2), photo(2400, 1600, 3), photo(1600, 1600, 4),
     photo(4000, 1200, 5), photo(900, 1800, 6), photo(1800, 1200, 7), photo(1800, 1200, 8)],
  ],
  [
    "minimal",
    {
      placeId: "stress-min",
      name: "Ana",
      reviewCount: 0,
      photoCount: 0,
      reviewSnippets: [],
      categories: [],
    },
    [],
  ],
  [
    "unbreakable",
    {
      placeId: "stress-unbreakable",
      name: LONG_WORD,
      address: `${LONG_WORD} 14, ${LONG_WORD}, Slovenija`,
      phone: "+386 31 000 000",
      website: `https://${LONG_WORD.toLowerCase()}.example.si/kontakt`,
      rating: 3.9,
      reviewCount: 7,
      photoCount: 2,
      reviewSnippets: [LONG_WORD, "Ok."],
      categories: ["carpenter"],
      openingHours: [`ponedeljek: 0:00–23:59`, "nedelja: Zaprto"],
    },
    [photo(2000, 1333, 11), photo(1000, 1000, 12)],
  ],
  [
    "typical",
    {
      placeId: "stress-typical",
      name: "Kavarna Zrno",
      address: "Slovenska cesta 55, 1000 Ljubljana",
      phone: "+386 1 234 56 78",
      rating: 4.6,
      reviewCount: 214,
      photoCount: 6,
      reviewSnippets: ["Odlična kava.", "Prijazno osebje in lepa terasa.", "Vedno se rada vrnem."],
      categories: ["cafe", "bakery"],
      openingHours: ["ponedeljek: 7:00–19:00", "nedelja: 8:00–14:00"],
    },
    [photo(1800, 1200, 31), photo(1800, 1200, 32), photo(1200, 1800, 33), photo(1600, 1600, 34)],
  ],
];

// Every Design, plus the legacy archetypes (designId undefined, variant picks
// the archetype) so neither path regresses.
const ENGINES = [...DESIGN_IDS.map((id) => ({ label: id, designId: id })),
                 ...[0, 1, 2, 3].map((v) => ({ label: `archetype-v${v}`, variant: v }))];

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

const built = [];
for (const [fixture, place, photos] of FIXTURES) {
  for (const eng of ENGINES) {
    const html = generateSiteHtml(place, "", photos, null, eng.variant ?? 0, undefined, eng.designId);
    const file = path.join(OUT, `${eng.label}--${fixture}.html`);
    await writeFile(file, html);
    built.push(file);
  }
}
console.log(`built ${built.length} pages (${ENGINES.length} engines × ${FIXTURES.length} fixtures)`);

const report = await auditTargets(built, VIEWPORTS);

let total = 0;
for (const { target, results } of report) {
  const seen = new Map();
  for (const r of results) {
    for (const p of r.problems) {
      const key = `${p.kind}|${p.detail}`;
      if (!seen.has(key)) seen.set(key, { ...p, at: [] });
      seen.get(key).at.push(r.width);
    }
  }
  if (!seen.size) continue;
  total += seen.size;
  console.log(`\n${path.basename(target, ".html")} — ${seen.size}`);
  for (const p of [...seen.values()].slice(0, 20)) {
    console.log(`  [${p.kind}] @${p.at.join(",")} — ${p.detail}`);
  }
}
console.log(`\n${total} distinct issue(s) across ${built.length} generated pages.`);
if (!process.argv.includes("--keep")) await rm(OUT, { recursive: true, force: true });
process.exit(total ? 1 : 0);
