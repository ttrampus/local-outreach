// Build the marketing site's example pages from the ten templates, using
// INVENTED businesses and stock photos only.
//
// These pages used to be filled with real Slovene businesses fetched from
// Google: their names, addresses, phone numbers, opening hours, Google reviews
// and photos — published on our site without their permission. That is a
// liability (their trademarks, their photographers' copyright, reviewers'
// words and names) and a trust problem: a prospect who finds a neighbour's
// salon in our portfolio fairly asks whether theirs is next. So every example is
// now a business that does not exist, labelled as an example, illustrated with
// the same hand-reviewed stock sets the previews fall back on.
//
// Invented details are chosen to be unmistakably sample data where it matters:
// one shared sample phone number, and names distinctive enough not to point at
// a real shop. Reviews come from the templates' own invented demo reviews and
// carry no author names.
//
// Outputs, all derived — never hand-edit them:
//   public/site/work/<slug>.html   the example page
//   public/site/work/<slug>.webp   full-page screenshot for the gallery card
//   public/site/work/photos/<tid>/ the stock photos each page references
//   public/site/work/manifest.json the list /examples and the marketing page read
//   public/avenyo-site.html        the gallery cards between the WORKGRID markers
//
//   node --import ./scripts/lib/app-imports.mjs scripts/build-showcase-sites.mjs
import { copyFile, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { ROOT } from "./lib/app-imports.mjs";

const { KIT_TEMPLATES } = await import("@/lib/preview/kit");

const TEMPLATE_DIR = path.join(ROOT, "templates");
const OUT_DIR = path.join(ROOT, "public", "site", "work");
const STOCK_DIR = path.join(ROOT, "assets", "stock");
const MARKETING = path.join(ROOT, "public", "avenyo-site.html");

/** Shown on every example. Recognisably a placeholder, and dials nobody. */
const SAMPLE_PHONE = "+386 1 234 56 78";
/** Stock photos per page: hero, slots and a full gallery, with room to spare. */
const PHOTOS_PER_PAGE = 8;

const SITES = [
  {
    tid: "t01",
    slug: "frizerski-studio-lunara",
    name: "Frizerski studio Lunara",
    short: "Lunara",
    type: "Frizerski salon",
    // t01's own data block is a real business, so it gets a full invented set.
    data: {
      address: "Trubarjeva cesta 14, 1000 Ljubljana, Slovenija",
      rating: 4.9,
      review_count: 212,
      hours: ["ponedeljek: 8:00–19:00", "torek: 8:00–19:00", "sreda: 8:00–19:00", "četrtek: 8:00–19:00", "petek: 8:00–17:00", "sobota: 8:00–13:00", "nedelja: Zaprto"],
      reviews: [
        { text: "Končno frizerka, ki posluša. Barva je točno taka, kot sem si jo želela, in drži že dva meseca.", rating: 5 },
        { text: "Prijazno, točno in brez hitenja. Svetovali so mi, kako lase negovati doma, kar zelo cenim.", rating: 5 },
        { text: "Moški striženj v petnajstih minutah in vedno enako dober. Termin se vedno najde.", rating: 5 },
      ],
    },
  },
  { tid: "t02", slug: "wellness-tisina", name: "Wellness Tišina", short: "Tišina", type: "Masažni salon" },
  { tid: "t03", slug: "brivnica-ostri-rob", name: "Brivnica Ostri rob", short: "Ostri rob", type: "Brivnica" },
  { tid: "t04", slug: "fotostudio-svetloba", name: "Fotostudio Svetloba", short: "Svetloba", type: "Fotografski studio" },
  { tid: "t05", slug: "avtosola-zeleni-val", name: "Avtošola Zeleni val", short: "Zeleni val", type: "Avtošola" },
  { tid: "t06", slug: "gostilna-zerjavica", name: "Gostilna Žerjavica", short: "Žerjavica", type: "Gostilna in žar" },
  { tid: "t07", slug: "mizarstvo-grca", name: "Mizarstvo Grča", short: "Grča", type: "Mizarstvo" },
  { tid: "t08", slug: "kavarna-mlincek", name: "Kavarna Mlinček", short: "Mlinček", type: "Kavarna in pekarna" },
  { tid: "t09", slug: "avtoservis-zobnik", name: "Avtoservis Zobnik", short: "Zobnik", type: "Avtoservis" },
  { tid: "t10", slug: "zobna-ordinacija-belina", name: "Zobna ordinacija Belina", short: "Belina", type: "Zobozdravnik" },
];

const DATA_BLOCK = /(<script type="application\/json" id="business-data">)([\s\S]*?)(<\/script>)/;

/** Copy a stock set into the page's photo folder and describe it for the template. */
async function stockFor(tid, set) {
  const manifest = JSON.parse(await readFile(path.join(STOCK_DIR, set, "manifest.json"), "utf8"));
  const dir = path.join(OUT_DIR, "photos", tid);
  await mkdir(dir, { recursive: true });
  const photos = [];
  for (const e of manifest.slice(0, PHOTOS_PER_PAGE)) {
    await copyFile(path.join(STOCK_DIR, set, e.file), path.join(dir, e.file));
    photos.push({ src: `photos/${tid}/${e.file}`, width: e.width, height: e.height, stock: true });
  }
  return photos;
}

// Start clean: every previous page, screenshot and photo came from real
// businesses, and nothing of them may survive a rebuild.
const KEEP = new Set();
await mkdir(OUT_DIR, { recursive: true });
for (const f of await readdir(OUT_DIR)) {
  if (!KEEP.has(f)) await rm(path.join(OUT_DIR, f), { recursive: true, force: true });
}

const manifest = [];
for (const site of SITES) {
  const tpl = KIT_TEMPLATES.find((t) => t.id === site.tid);
  if (!tpl) throw new Error(`no kit template ${site.tid}`);

  let html = await readFile(path.join(TEMPLATE_DIR, tpl.file), "utf8");
  // The template header names the design reference; a note to us, not content.
  html = html.replace(/^<!-- Template \d+ · .*?-->\n/m, "");

  const m = html.match(DATA_BLOCK);
  if (!m) throw new Error(`${tpl.file}: business-data block not found`);
  const demo = JSON.parse(m[2]);

  const data = {
    ...demo,
    ...(site.data ?? {}),
    name_raw: site.name,
    name: site.name,
    short_name: site.short,
    type: site.type,
    phone: SAMPLE_PHONE,
    photos: await stockFor(site.tid, tpl.stockSet),
  };
  delete data._demo;
  // No link to a real Google listing, and no real review authors, ever.
  delete data.google_maps_url;
  data.reviews = (data.reviews ?? []).map((r) =>
    typeof r === "string" ? { text: r } : { text: r.text, rating: r.rating },
  );

  html = html.replace(DATA_BLOCK, (_, open, _old, close) => `${open}\n${JSON.stringify(data, null, 2)}\n${close}`);
  await writeFile(path.join(OUT_DIR, `${site.slug}.html`), html);
  manifest.push({ slug: site.slug, name: site.name, type: site.type, template: site.tid });
  console.log(`${site.tid} → public/site/work/${site.slug}.html  (${site.name})`);
}
await writeFile(path.join(OUT_DIR, "manifest.json"), `${JSON.stringify(manifest, null, 1)}\n`);

// Full-page screenshots for the gallery cards, which scroll through the page on
// hover. Lazy images are forced eager and the page is scrolled first, or the
// lower half of every screenshot is empty frames.
const { chromium } = await import("playwright");
const sharp = (await import("sharp")).default;
const browser = await chromium.launch();
for (const site of SITES) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`file://${path.join(OUT_DIR, `${site.slug}.html`)}`);
  await page.waitForTimeout(1500);
  for (let y = 0; y < 12000; y += 700) {
    await page.mouse.wheel(0, 700);
    await page.waitForTimeout(60);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1200);
  const png = await page.screenshot({ fullPage: true });
  await sharp(png).webp({ quality: 70 }).toFile(path.join(OUT_DIR, `${site.slug}.webp`));
  await page.close();
}
await browser.close();

// The gallery cards on the marketing page, regenerated between markers so the
// page never lists a site that no longer exists.
const cards = SITES.map((s) => `    <a class="wk" href="site/work/${s.slug}.html" target="_blank" rel="noopener">
      <span class="wk-chrome"><i></i><i></i><i></i><span class="wk-url">${s.slug}.avenyo.app</span></span>
      <span class="wk-shot"><img loading="lazy" src="site/work/${s.slug}.webp" alt="${s.name} — primer strani"></span>
      <span class="wk-foot">
        <span class="wk-name">${s.name}</span>
        <span class="wk-open" data-sl="Odpri">Open
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 17 17 7M9 7h8v8"/></svg>
        </span>
      </span>
    </a>`).join("\n");
const page = await readFile(MARKETING, "utf8");
const START = "<!-- WORKGRID:START -->", END = "<!-- WORKGRID:END -->";
const a = page.indexOf(START), b = page.indexOf(END);
if (a < 0 || b < a) throw new Error("avenyo-site.html: WORKGRID markers not found");
await writeFile(MARKETING, `${page.slice(0, a + START.length)}\n${cards}\n    ${page.slice(b)}`);

console.log(`\n${SITES.length} example sites, screenshots and gallery cards written`);
