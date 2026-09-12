// The "kit" engine: pick one of the ten hand-built templates in templates/ and
// fill it with a lead's real Google data.
//
// Unlike the other engines this one writes no copy at all. Each template ships
// its own <script id="template-defaults"> block — generic, category-true
// Slovene copy and a generic service list — and exposes exactly one seam, the
// <script id="business-data"> block. Generating a site is therefore a single
// substitution, free, deterministic, and reproducible. templates/README.md
// documents the data contract; scripts/build-showcase-sites.mjs does the same
// substitution by hand for the marketing gallery.
//
// The catch: those defaults are category-bound. The dentist template's defaults
// talk about fillings, the café's about coffee. Handing a business a template
// whose defaults are false about it is exactly what copyPolicy.ts forbids.
//
// So every lead gets a template, but by one of two routes:
//   · ON CATEGORY — its Google type is on a template's allow-list, and that
//     template's own defaults ship as they are.
//   · GENERIC — nothing matched, so one of the two layouts that can carry any
//     business (t04 when there are photos, t10 when there are not) is used with
//     its service list dropped and its category prose replaced by claim-free
//     copy built from the business's own name, type, address and hours.
// The generic page is shorter by design — a hero, the gallery, the reviews, the
// hours and the map — because those are the sections that need no claim.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { cleanDisplayName } from "./brand";
import { photoShapes } from "./photos";
import type { NormalizedPlaceDetails } from "@/lib/leadSource/types";

const TEMPLATE_DIR = path.join(process.cwd(), "templates");

export interface KitTemplate {
  /** Stable id, also the engine suffix recorded on the lead ("kit:t01"). */
  id: string;
  file: string;
  label: string;
  /**
   * Google Place types this template's default copy is actually TRUE for.
   * Deliberately narrow: a near-miss (a nail bar on the dentist template) ships
   * a page that claims services the business does not offer.
   */
  types: string[];
  /**
   * Present only on the layouts that can host a business of ANY category. The
   * overrides are merged over the business data, after the derived fields, and
   * carry the claim-free copy that replaces this template's own. `minPhotos` is
   * what the layout needs to still look deliberate.
   */
  generic?: {
    minPhotos: number;
    overrides: Record<string, unknown>;
    /** Nav links to delete, by href. An empty-string label cannot hide one: the
     * templates' label merge treats "" as "not provided" and keeps the default,
     * so a link to the dropped services section would survive and scroll the
     * visitor to nothing. */
    dropAnchors: string[];
  };
}

// Claim-free copy for the two generic hosts. Every string is either a fact the
// business itself publishes (via the {tokens} the templates expand) or a plain
// label. The empty `services` list is what makes the service section — the one
// part of these pages that cannot be written without knowing the business —
// hide itself.
const GENERIC_T04: Record<string, unknown> = {
  services: [],
  labels: {
    meta_description: "{type} na naslovu {street}, {city}. Pokličite {phone}.",
    nav_work: "Galerija",
    nav_work_sub: "Fotografije",
    hero_intro: "{type}, {city}.",
    hero_intro2: "Pokličite nas na {phone}.",
    statement: "{name}, {street}, {city}. Pokličite {phone}.",
    work_label: "Galerija",
    work_title: "Fotografije",
    book_label: "Kontakt",
    book_title: "Pokličite in dogovorimo se",
    directions: "Kako do nas",
    visit_label: "Obisk",
    visit_title: "Naslov in delovni čas",
    map_label: "Lokacija",
  },
};

const GENERIC_T10: Record<string, unknown> = {
  services: [],
  labels: {
    meta_description: "{type} na naslovu {street}, {city}. Pokličite {phone}.",
    // No category noun and no preposition: "{type} v {city}" needs the Slovene
    // locative ("v Ljubljani", not "v Ljubljana"), and nothing here knows how to
    // decline a place name. The comma form the templates use elsewhere is safe
    // for every business and every town.
    hero_title: "{name}",
    hero_sub: "{type}, {city}. Pokličite {phone}.",
    book: "Pokličite",
    book_long: "Pokličite {phone}",
    ui_book: "Kontakt",
    reviews_title: "Kaj pravijo [stranke]",
    review_anon: "Stranka na Googlu",
    hours_title: "Delovni čas",
    contact_label: "Pokličite nas",
  },
};

export const KIT_TEMPLATES: KitTemplate[] = [
  {
    id: "t01",
    file: "t01-frizerski-salon-oakame.html",
    label: "Hair salon",
    types: ["hair_salon", "hair_care"],
  },
  {
    id: "t02",
    file: "t02-masaze-wellness-alveos.html",
    label: "Spa / massage / beauty",
    types: [
      "beauty_salon",
      "spa",
      "massage",
      "nail_salon",
      "skin_care_clinic",
      "makeup_artist",
      "sauna",
      "wellness_center",
    ],
  },
  { id: "t03", file: "t03-brivnica-aplos.html", label: "Barbershop", types: ["barber_shop"] },
  {
    id: "t04",
    file: "t04-fotograf-aker.html",
    label: "Photographer",
    types: ["photographer", "photography_studio", "photo_lab"],
    // Photo-led all the way down: a full-bleed hero and a masonry portfolio.
    // Give it fewer than three photos and it is mostly empty frames.
    generic: { minPhotos: 3, overrides: GENERIC_T04, dropAnchors: ["#storitve"] },
  },
  {
    id: "t05",
    file: "t05-avtosola-lightship.html",
    label: "Driving school",
    types: ["driving_school"],
  },
  {
    id: "t06",
    file: "t06-gostilna-hungry-tiger.html",
    label: "Restaurant / grill",
    types: [
      "restaurant",
      "bar_and_grill",
      "barbecue_restaurant",
      "steak_house",
      "pizza_restaurant",
      "fine_dining_restaurant",
      "italian_restaurant",
      "seafood_restaurant",
      "meal_takeaway",
    ],
  },
  {
    id: "t07",
    file: "t07-mizarstvo-ashton.html",
    label: "Carpenter / joinery",
    // Not general_contractor: the defaults are kitchens, wardrobes and stairs,
    // which is a joiner's work and not a builder's.
    types: ["carpenter", "cabinet_maker", "furniture_maker"],
  },
  {
    id: "t08",
    file: "t08-kavarna-sweetgreen.html",
    label: "Café / bakery",
    types: ["cafe", "coffee_shop", "bakery", "tea_house"],
  },
  {
    id: "t09",
    file: "t09-avtoservis-lamborghini.html",
    label: "Car service / garage",
    types: ["car_repair"],
  },
  {
    id: "t10",
    file: "t10-zobozdravnik-alden.html",
    label: "Dentist / clinic",
    types: ["dentist", "dental_clinic"],
    // Centered and type-led: the one layout that holds up with no photography
    // at all, which makes it the last-resort host.
    generic: { minPhotos: 0, overrides: GENERIC_T10, dropAnchors: ["#storitve"] },
  },
];

const BY_TYPE = new Map<string, KitTemplate>(
  KIT_TEMPLATES.flatMap((t) => t.types.map((ty) => [ty, t] as const)),
);

export interface TemplateChoice {
  template: KitTemplate;
  /** True when the template was chosen as a host rather than on its category,
   * so its own service list and category prose must not ship. */
  generic: boolean;
}

/**
 * Which of the ten this business gets. `primaryType` wins — it is Google's own
 * single most specific answer — and the remaining categories are only consulted
 * when the primary type is an umbrella one ("establishment", "point_of_interest").
 * Nothing matched → the best generic host for the photos we have.
 */
export function pickTemplate(
  details: Pick<NormalizedPlaceDetails, "primaryType" | "categories">,
  photoCount: number,
): TemplateChoice {
  const primary = details.primaryType ? BY_TYPE.get(details.primaryType) : undefined;
  if (primary) return { template: primary, generic: false };
  for (const c of details.categories ?? []) {
    const hit = BY_TYPE.get(c);
    if (hit) return { template: hit, generic: false };
  }

  // Richest layout the photo set can actually fill, so a business with a good
  // gallery never lands on the text-only page.
  const hosts = KIT_TEMPLATES.filter((t) => t.generic).sort(
    (a, b) => b.generic!.minPhotos - a.generic!.minPhotos,
  );
  const host = hosts.find((t) => photoCount >= t.generic!.minPhotos) ?? hosts[hosts.length - 1];
  return { template: host, generic: true };
}

/**
 * The word that goes in the big hero type. Google names lead with the category
 * ("Frizerski salon Tamara", "Gostilna Trnovski pristan"), and setting the
 * category in 120px type next to a line that already prints it reads as a
 * mistake — so any word the category label already contains is dropped.
 */
export function shortBrandName(displayName: string, type: string | undefined): string {
  if (!type) return displayName;
  const typeWords = new Set(
    type
      .toLocaleLowerCase("sl")
      .split(/[^\p{L}]+/u)
      .filter(Boolean),
  );
  const kept = displayName
    .split(/\s+/)
    .filter((w) => !typeWords.has(w.replace(/[^\p{L}]/gu, "").toLocaleLowerCase("sl")));
  const short = kept.join(" ").trim();
  return short.length >= 2 ? short : displayName;
}

/**
 * The town out of a formatted address, via its postal code — "…, 1260
 * Ljubljana-Polje, Slovenija" → "Ljubljana-Polje". Null when there is no code
 * to anchor on, which leaves the template's own comma-splitting in charge.
 */
export function cityFromAddress(address: string): string | null {
  const m = address.match(/\b\d{4,5}\s+([^,]+)/);
  return m ? m[1].trim() : null;
}

/**
 * The <script id="business-data"> payload for one lead. Only fields Google
 * actually gave us are emitted; every omitted key falls back to the template's
 * own default, which is the whole point of the kit.
 */
export async function buildKitBusinessData(
  details: NormalizedPlaceDetails,
  photos: string[],
): Promise<Record<string, unknown>> {
  const name = cleanDisplayName(details.name);
  const type = details.primaryTypeDisplayName;
  const shapes = await photoShapes(photos);

  const data: Record<string, unknown> = {
    name_raw: details.name,
    name,
    short_name: shortBrandName(name, type),
    categories: details.categories ?? [],
  };
  if (type) data.type = type;
  if (details.address) {
    data.address = details.address;
    // The templates derive the town by splitting the address on commas, which
    // breaks on the three-part Slovene addresses Google returns ("Novo Polje,
    // cesta X 20a, 1260 Ljubljana-Polje" put the street in the town slot and
    // printed a house number as the city). The postal code is unambiguous, so
    // when it is there we name the town outright.
    const city = cityFromAddress(details.address);
    if (city) data.city = city;
  }
  if (details.phone) data.phone = details.phone;
  if (details.rating != null) data.rating = details.rating;
  if (details.reviewCount) data.review_count = details.reviewCount;
  if (details.openingHours?.length) data.hours = details.openingHours;
  // reviewSnippets are plain strings; the template accepts those verbatim and
  // trims Google's ellipsis back to a clean ending itself.
  if (details.reviewSnippets?.length) data.reviews = details.reviewSnippets.slice(0, 5);
  if (photos.length) {
    data.photos = photos.map((src, i) => {
      const s = shapes[i];
      return s && s.w > 0 && s.h > 0 ? { src, width: s.w, height: s.h } : src;
    });
  }
  if (details.googleMapsUri) data.google_maps_url = details.googleMapsUri;
  return data;
}

/** The header comment naming the Refero site each design was studied from. That
 * is a note to us, not something to publish under a real business's name. */
const REFERENCE_HEADER = /^<!-- Template \d+ · .*?-->\n/m;
const DATA_BLOCK = /(<script type="application\/json" id="business-data">)[\s\S]*?(<\/script>)/;

/** Fill one template file with a business-data payload. Exported for scripts. */
export async function fillTemplate(
  tpl: KitTemplate,
  data: Record<string, unknown>,
): Promise<string> {
  const raw = await readFile(path.join(TEMPLATE_DIR, tpl.file), "utf8");
  const html = raw.replace(REFERENCE_HEADER, "");
  const json = JSON.stringify(data, null, 2);
  const filled = html.replace(DATA_BLOCK, (_, open: string, close: string) =>
    `${open}\n${json}\n${close}`,
  );
  // A template whose seam has been renamed would otherwise ship silently with
  // the demo business still in it.
  if (filled === html) throw new Error(`${tpl.file}: business-data block not found`);
  return filled;
}

export interface KitSite {
  html: string;
  template: KitTemplate;
  generic: boolean;
}

/**
 * Build a kit site for one lead. Free and deterministic: same lead, same page,
 * no API calls.
 */
export async function generateKitSiteHtml(
  details: NormalizedPlaceDetails,
  photos: string[],
): Promise<KitSite> {
  const { template, generic } = pickTemplate(details, photos.length);
  const data = await buildKitBusinessData(details, photos);
  if (!generic) return { html: await fillTemplate(template, data), template, generic };

  const g = template.generic!;
  // Labels merge key by key: the overrides only neutralize the category prose,
  // and every label they don't name keeps the template's own.
  Object.assign(data, g.overrides, {
    labels: { ...(data.labels as object), ...(g.overrides.labels as object) },
  });
  let html = await fillTemplate(template, data);
  for (const href of g.dropAnchors) {
    const before = html;
    html = html.replace(new RegExp(`<a[^>]*href="${href}"[^>]*>.*?</a>`, "gs"), "");
    if (html === before) throw new Error(`${template.file}: no nav link to ${href} to drop`);
  }
  return { html, template, generic };
}
