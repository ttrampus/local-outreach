// Fill the ten standalone templates with the real businesses fetched by
// fetch-showcase-places.mjs and publish them to the marketing site's work
// gallery.
//
// Each template exposes exactly one seam — a <script id="business-data"> JSON
// block — so "generating a site" is a single block substitution. Everything
// else (services, page text, schema.org, the open/closed line) comes from the
// template's own defaults, which is deliberate: the defaults are generic
// category copy, and generic-but-true is the rule these pages live by
// (src/lib/preview/copyPolicy.ts). Inventing services or prices for a business
// that never asked to be on this site is exactly what that policy forbids.
//
//   node --import ./scripts/lib/app-imports.mjs scripts/build-showcase-sites.mjs
import { readFile, writeFile, mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { ROOT } from "./lib/app-imports.mjs";

const TEMPLATE_DIR = path.join(ROOT, "templates");
const OUT_DIR = path.join(ROOT, "public", "site", "work");
const PLACES = path.join(ROOT, "data", "showcase-places.json");

// Per-site presentation, which Google cannot supply.
//
// `name` and `short` exist because raw Google names carry the owner's name, the
// legal form and often the city ("Šola vožnje (avtošola) Modrivoznik.si -
// Ljubljana"). `type` is the category line the page prints; it is kept to what
// Google's own primaryTypeDisplayName and the business's registered name
// already assert, never widened into a claim about what they offer.
const SITES = {
  t01: {
    template: "t01-frizerski-salon-oakame.html",
    slug: "frizerski-studio-tamara",
    name: "Frizerski studio Tamara",
    short: "Tamara",
    type: "Frizerski salon",
  },
  t02: {
    template: "t02-masaze-wellness-alveos.html",
    slug: "lepotni-center-aloe-vera",
    name: "Lepotni center Aloe Vera",
    short: "Aloe Vera",
    type: "Masažni in kozmetični salon",
  },
  t03: {
    template: "t03-brivnica-aplos.html",
    slug: "dd-brivnica",
    name: "D.D. Brivnica",
    short: "D.D.",
    type: "Brivnica",
  },
  t04: {
    template: "t04-fotograf-aker.html",
    slug: "fotooko",
    name: "Fotooko",
    short: "Fotooko",
    type: "Fotografski studio",
    // The one place a template's generic category copy is simply wrong about the
    // business. Fotooko is not a portrait-and-weddings photographer: they
    // photograph the iris and turn it into a print. Everything below is taken
    // from what the business already states publicly — the sign in its own
    // Google photos reads "Unikatne slike iz fotografij tvojih oči", and the
    // gift voucher is named by two of the reviews. The template's defaults would
    // have had them advertising wedding shoots they do not do.
    data: {
      services: [
        { name: "Fotografiranje oči", desc: "Fotografija šarenice, posneta v studiu." },
        { name: "Unikatna slika", desc: "Iz posnetka vašega očesa nastane slika za na steno." },
        { name: "Darilni bon", desc: "Bon za fotografiranje, ki ga lahko podarite." },
      ],
      labels: {
        meta_description:
          "{type} na naslovu {street}, {city}. Unikatne slike iz fotografij vaših oči. Pokličite {phone}.",
        hero_intro: "{type}, {city}. Unikatne slike iz fotografij vaših oči.",
        hero_intro2: "Termine usklajujemo po telefonu.",
        services_label: "Kaj delamo",
        nav_services_sub: "Kaj delamo",
        services_title: "Slika iz fotografije vašega očesa.",
        statement:
          "Fotografiranje poteka v studiu. Iz posnetka nastane slika, ki jo pripravimo za tisk.",
        work_label: "Galerija",
        work_title: "Iz studia",
        nav_work_sub: "Iz studia",
        book_title: "Dogovorimo se za termin fotografiranja",
      },
    },
  },
  t05: {
    template: "t05-avtosola-lightship.html",
    slug: "avtosola-modri-voznik",
    name: "Avtošola Modri voznik",
    short: "Modri voznik",
    type: "Avtošola",
  },
  t06: {
    template: "t06-gostilna-hungry-tiger.html",
    slug: "gostilna-trnovski-pristan",
    name: "Gostilna Trnovski pristan",
    short: "Trnovski pristan",
    type: "Gostilna",
  },
  t07: {
    template: "t07-mizarstvo-ashton.html",
    slug: "ambius-pohistvo",
    name: "Ambius pohištvo",
    short: "Ambius",
    type: "Mizarstvo in pohištvo",
  },
  t08: {
    template: "t08-kavarna-sweetgreen.html",
    slug: "crno-zrno",
    name: "Črno Zrno",
    short: "Črno Zrno",
    type: "Kavarna",
  },
  t09: {
    template: "t09-avtoservis-lamborghini.html",
    slug: "avto-svetek-studenec",
    name: "Avto-Svetek Studenec",
    short: "Avto-Svetek",
    type: "Avtoservis",
  },
  t10: {
    template: "t10-zobozdravnik-alden.html",
    slug: "modri-zob",
    name: "Modri Zob",
    short: "Modri Zob",
    type: "Zobozdravstvena ordinacija",
  },
};

/**
 * Google truncates long review text with an ellipsis. The template trims a
 * truncated snippet back to a clean ending, but it can only do that if it can
 * see the ellipsis — so the text is passed through untouched, and only the
 * whitespace Google leaves behind is normalised.
 */
function reviewText(r) {
  const t = (r.originalText?.text ?? r.text?.text ?? "").replace(/\s+/g, " ").trim();
  return t;
}

function buildBusinessData(entry, site) {
  const p = entry.place;
  const reviews = (p.reviews ?? [])
    .map((r) => ({
      text: reviewText(r),
      rating: r.rating,
      author: r.authorAttribution?.displayName,
    }))
    // The template drops anything under review_min_rating on its own, but a
    // one-star review has no business travelling in the file at all: these
    // pages get opened by the businesses themselves.
    .filter((r) => r.text.length > 20 && (r.rating ?? 0) >= 4)
    .slice(0, 5);

  return {
    name_raw: p.displayName?.text,
    name: site.name,
    short_name: site.short,
    type: site.type,
    categories: p.types ?? [],
    address: p.formattedAddress,
    phone: p.internationalPhoneNumber,
    rating: p.rating,
    review_count: p.userRatingCount,
    hours: p.regularOpeningHours?.weekdayDescriptions ?? [],
    reviews,
    photos: entry.photos.map((ph) => ({ src: ph.src, width: ph.width, height: ph.height })),
    google_maps_url: p.googleMapsUri,
    // map_mode is left at the template default ("embed"): a showcase page is a
    // sales artefact, and the map has to be on screen the moment it opens.
    // Per-site overrides last, so a site that needs them wins over the derived
    // values; everything else keeps using the template's own defaults.
    ...(site.data ?? {}),
  };
}

const places = JSON.parse(await readFile(PLACES, "utf8"));
await mkdir(OUT_DIR, { recursive: true });

// Clear out the previous six pages and their screenshots; the photos/ subtree
// and the design thumbnails used elsewhere on the marketing page stay.
const KEEP = new Set(["photos", "manifest.json", "atelier.webp", "kiosk.webp", "maison.webp", "noir.webp", "vitrine.webp"]);
for (const f of await readdir(OUT_DIR)) {
  if (!KEEP.has(f)) await rm(path.join(OUT_DIR, f), { recursive: true, force: true });
}

const manifest = [];
for (const entry of places.sort((a, b) => a.slug.localeCompare(b.slug))) {
  const site = SITES[entry.slug];
  if (!site) {
    console.warn(`no SITES mapping for ${entry.slug} — skipped`);
    continue;
  }

  let html = await readFile(path.join(TEMPLATE_DIR, site.template), "utf8");

  // The template header names the Refero site each design was studied from.
  // That is a note to us, not something to publish under a real business's name.
  html = html.replace(/^<!-- Template \d+ · .*?-->\n/m, "");

  const json = JSON.stringify(buildBusinessData(entry, site), null, 2);
  const before = html;
  html = html.replace(
    /(<script type="application\/json" id="business-data">)[\s\S]*?(<\/script>)/,
    (_, open, close) => `${open}\n${json}\n${close}`,
  );
  if (html === before) throw new Error(`${site.template}: business-data block not found`);

  await writeFile(path.join(OUT_DIR, `${site.slug}.html`), html);
  manifest.push({
    slug: site.slug,
    name: site.name,
    type: site.type,
    template: entry.slug,
    placeId: entry.place.id,
  });
  console.log(`${entry.slug} → public/site/work/${site.slug}.html  (${site.name})`);
}

await writeFile(path.join(OUT_DIR, "manifest.json"), `${JSON.stringify(manifest, null, 1)}\n`);
console.log(`\nwrote manifest.json with ${manifest.length} sites`);
