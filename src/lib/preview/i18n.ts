// Deterministic, free localization for the generated site. The business's own
// content (name, review quotes) is already in its language; only the template's
// fixed chrome — nav, CTAs, section headings, service copy — needs translating.
// We detect the locale from the place's country (Slovenia → Slovene) and look up
// a string table. No LLM, no per-preview cost. Add a locale by extending LOCALES.
import type { NormalizedPlaceDetails } from "@/lib/leadSource/types";

export type Locale = "sl" | "en";

// Theme keys mirror theme.ts (salon, cafe, trades, …). Kept loose so a new theme
// key without a translation falls back to the English service set + label.
type ThemeKey = string;

export interface Service {
  title: string;
  blurb: string;
}

export interface LocaleStrings {
  // nav
  navServices: string;
  navAbout: string;
  navReviews: string;
  navBook: string;
  // CTAs
  bookNow: string;
  makeBooking: string;
  reserveTable: string;
  bookOnline: string;
  seeServices: string;
  ourServices: string;
  requestAppointment: string;
  getInTouch: string;
  call: (name: string) => string;
  // rating / chips
  reviewsWord: string;
  ratingLine: (rating: string, count: number) => string;
  // bold statbar
  local: string;
  independent: string;
  sameDay: string;
  fastResponse: string;
  // editorial meta
  rated: string;
  reviews: string;
  foundIn: string;
  booking: string;
  open: string;
  // clinical info card
  visitUs: string;
  area: string;
  phone: string;
  rating: string;
  hours: string;
  byAppointment: string;
  ratedChip: (rating: string) => string;
  onlineBooking: string;
  newPatients: string;
  // sections
  whatWeDo: string;
  everythingDoneWithCare: string;
  galleryOverline: string;
  aLookInside: string;
  aboutOverline: string;
  reviewsOverline: string;
  inTheirWords: string;
  comeSayHello: string;
  footer: (name: string, year: number) => string;
  aboutCopy: (area: string | null, label: string, reviewCount: number) => string;
  // varied copy
  eyebrows: string[];
  taglines: ((label: string, area: string | null) => string)[];
  // per-theme
  label: Record<ThemeKey, string>;
  services: Record<ThemeKey, Service[]>;
}

const EN_SERVICES: Record<ThemeKey, Service[]> = {
  salon: [
    { title: "Cuts & Styling", blurb: "Precision cuts and finishes tailored to you." },
    { title: "Colour", blurb: "Balayage, highlights and full colour by specialists." },
    { title: "Treatments", blurb: "Restorative care that keeps hair healthy and bright." },
  ],
  cafe: [
    { title: "Specialty Coffee", blurb: "Single-origin espresso and slow pour-overs." },
    { title: "Fresh Bakes", blurb: "Pastries and bread baked in-house each morning." },
    { title: "All-Day Brunch", blurb: "Seasonal plates made from local produce." },
  ],
  trades: [
    { title: "Emergency Callouts", blurb: "Fast same-day response when it matters most." },
    { title: "Repairs & Installs", blurb: "Done right the first time, guaranteed." },
    { title: "Maintenance", blurb: "Planned upkeep that prevents costly surprises." },
  ],
  medical: [
    { title: "Check-ups", blurb: "Thorough, unhurried consultations." },
    { title: "Treatments", blurb: "Modern, evidence-based care you can trust." },
    { title: "Online Booking", blurb: "Reserve a slot in seconds, any time of day." },
  ],
  florist: [
    { title: "Bouquets", blurb: "Seasonal arrangements for every occasion." },
    { title: "Events & Weddings", blurb: "Florals designed around your day." },
    { title: "Same-Day Delivery", blurb: "Fresh stems delivered across the area." },
  ],
  fitness: [
    { title: "Group Classes", blurb: "High-energy sessions for every level." },
    { title: "Personal Training", blurb: "One-to-one coaching built around your goals." },
    { title: "Open Gym", blurb: "Premium equipment, room to move, no queues." },
  ],
  automotive: [
    { title: "Servicing", blurb: "Full inspections that keep you on the road." },
    { title: "Repairs", blurb: "Honest diagnostics and lasting fixes." },
    { title: "Tyres & MOT", blurb: "Quick turnaround, no upsell, fair pricing." },
  ],
  professional: [
    { title: "Consultation", blurb: "Clear advice, no jargon, from the first call." },
    { title: "Representation", blurb: "Experienced hands working in your interest." },
    { title: "Ongoing Support", blurb: "We stay with you long after the paperwork." },
  ],
  default: [
    { title: "Our Work", blurb: "Quality service our customers come back for." },
    { title: "Local & Trusted", blurb: "Proudly serving the neighbourhood." },
    { title: "Get In Touch", blurb: "We'd love to hear what you need." },
  ],
};

const SL_SERVICES: Record<ThemeKey, Service[]> = {
  salon: [
    { title: "Striženje in oblikovanje", blurb: "Natančni rezi in zaključki, prilagojeni vam." },
    { title: "Barvanje", blurb: "Pramen, prelivi in polno barvanje pri specialistih." },
    { title: "Nega las", blurb: "Obnovitvena nega, ki ohranja lase zdrave in sijoče." },
  ],
  cafe: [
    { title: "Vrhunska kava", blurb: "Espresso enega izvora in počasne filtrske kave." },
    { title: "Sveža peka", blurb: "Pecivo in kruh, sveže pečeni vsako jutro." },
    { title: "Brunch ves dan", blurb: "Sezonski krožniki iz lokalnih sestavin." },
  ],
  trades: [
    { title: "Nujni klici", blurb: "Hiter odziv še isti dan, ko je najbolj pomembno." },
    { title: "Popravila in montaže", blurb: "Opravljeno pravilno že prvič, z garancijo." },
    { title: "Vzdrževanje", blurb: "Načrtno vzdrževanje, ki preprečuje drage okvare." },
  ],
  medical: [
    { title: "Pregledi", blurb: "Temeljiti in neobremenjeni posveti." },
    { title: "Zdravljenje", blurb: "Sodobna oskrba, ki temelji na dokazih in ji zaupate." },
    { title: "Spletno naročanje", blurb: "Rezervirajte termin v nekaj sekundah, kadar koli." },
  ],
  florist: [
    { title: "Šopki", blurb: "Sezonski aranžmaji za vsako priložnost." },
    { title: "Dogodki in poroke", blurb: "Cvetlični aranžmaji, oblikovani za vaš dan." },
    { title: "Dostava še isti dan", blurb: "Sveže cvetje, dostavljeno po vsej okolici." },
  ],
  fitness: [
    { title: "Skupinske vadbe", blurb: "Energične vadbe za vse ravni." },
    { title: "Osebno vadenje", blurb: "Vadba ena na ena, prilagojena vašim ciljem." },
    { title: "Prosta vadba", blurb: "Vrhunska oprema, dovolj prostora, brez čakanja." },
  ],
  automotive: [
    { title: "Servisi", blurb: "Celoviti pregledi, ki vas ohranjajo na cesti." },
    { title: "Popravila", blurb: "Poštena diagnostika in trajne rešitve." },
    { title: "Gume in tehnični", blurb: "Hitro opravljeno, brez dodatne prodaje, poštene cene." },
  ],
  professional: [
    { title: "Svetovanje", blurb: "Jasen nasvet, brez žargona, že od prvega klica." },
    { title: "Zastopanje", blurb: "Izkušene roke, ki delujejo v vašo korist." },
    { title: "Stalna podpora", blurb: "Ob vas ostanemo še dolgo po opravljenem delu." },
  ],
  default: [
    { title: "Naše delo", blurb: "Kakovostna storitev, po katero se stranke vračajo." },
    { title: "Lokalno in zaupanja vredno", blurb: "S ponosom strežemo soseski." },
    { title: "Stopite v stik", blurb: "Z veseljem prisluhnemo vašim željam." },
  ],
};

const EN: LocaleStrings = {
  navServices: "Services",
  navAbout: "About",
  navReviews: "Reviews",
  navBook: "Book",
  bookNow: "Book now",
  makeBooking: "Make a booking",
  reserveTable: "Reserve a table",
  bookOnline: "Book online",
  seeServices: "See services →",
  ourServices: "Our services",
  requestAppointment: "Request appointment",
  getInTouch: "Get in touch",
  call: (name) => `Call ${name}`,
  reviewsWord: "reviews",
  ratingLine: (rating, count) => `${rating} ★ · ${count} reviews`,
  local: "Local",
  independent: "Independent",
  sameDay: "Same-day",
  fastResponse: "Fast response",
  rated: "Rated",
  reviews: "Reviews",
  foundIn: "Found in",
  booking: "Booking",
  open: "Open",
  visitUs: "Visit us",
  area: "Area",
  phone: "Phone",
  rating: "Rating",
  hours: "Hours",
  byAppointment: "By appointment",
  ratedChip: (rating) => `★ ${rating} rated`,
  onlineBooking: "Online booking",
  newPatients: "New patients welcome",
  whatWeDo: "What we do",
  everythingDoneWithCare: "Everything, done with care",
  galleryOverline: "Gallery",
  aLookInside: "A look inside",
  aboutOverline: "About",
  reviewsOverline: "Reviews",
  inTheirWords: "In their words",
  comeSayHello: "Come say hello",
  footer: (name, year) => `© ${year} ${name}. Preview generated by Outreach Console.`,
  aboutCopy: (area, label, reviewCount) =>
    `${area ? `We're proud to serve ${area} and the surrounding area` : "We're proud to serve our local community"} as a trusted ${label}. ${
      reviewCount
        ? `With ${reviewCount}+ reviews, our customers keep coming back — and we'd love to welcome you too.`
        : "Friendly service, fair prices, and work we stand behind."
    }`,
  eyebrows: ["Local & Trusted", "Established Locally", "Independent & Proud", "Since Day One"],
  taglines: [
    (label, area) =>
      area ? `Your neighbourhood ${label} in ${area}.` : `A ${label} the neighbourhood trusts.`,
    (label, area) =>
      area ? `${label} done properly — right here in ${area}.` : `The ${label} locals recommend.`,
    (label, area) =>
      area ? `Quietly the best ${label} in ${area}.` : `Crafted care, every single visit.`,
  ],
  label: {
    salon: "salon",
    cafe: "café",
    trades: "service",
    medical: "practice",
    florist: "studio",
    fitness: "studio",
    automotive: "garage",
    professional: "practice",
    default: "business",
  },
  services: EN_SERVICES,
};

const SL: LocaleStrings = {
  navServices: "Storitve",
  navAbout: "O nas",
  navReviews: "Mnenja",
  navBook: "Naročite se",
  bookNow: "Naročite se",
  makeBooking: "Rezervirajte termin",
  reserveTable: "Rezervirajte mizo",
  bookOnline: "Naročanje na spletu",
  seeServices: "Oglejte si storitve →",
  ourServices: "Naše storitve",
  requestAppointment: "Naročite se na termin",
  getInTouch: "Stopite v stik",
  call: (name) => `Pokličite ${name}`,
  reviewsWord: "mnenj",
  ratingLine: (rating, count) => `${rating} ★ · ${count} mnenj`,
  local: "Lokalno",
  independent: "Neodvisno",
  sameDay: "Še isti dan",
  fastResponse: "Hiter odziv",
  rated: "Ocena",
  reviews: "Mnenja",
  foundIn: "Lokacija",
  booking: "Naročanje",
  open: "Odprto",
  visitUs: "Obiščite nas",
  area: "Območje",
  phone: "Telefon",
  rating: "Ocena",
  hours: "Odpiralni čas",
  byAppointment: "Po dogovoru",
  ratedChip: (rating) => `★ ocena ${rating}`,
  onlineBooking: "Naročanje na spletu",
  newPatients: "Sprejemamo nove stranke",
  whatWeDo: "Kaj počnemo",
  everythingDoneWithCare: "Vse, opravljeno s skrbjo",
  galleryOverline: "Galerija",
  aLookInside: "Pogled v notranjost",
  aboutOverline: "O nas",
  reviewsOverline: "Mnenja",
  inTheirWords: "Z njihovimi besedami",
  comeSayHello: "Oglasite se",
  footer: (name, year) => `© ${year} ${name}. Predogled je pripravil Outreach Console.`,
  aboutCopy: (area, label, reviewCount) =>
    `${area ? `S ponosom strežemo ${area} in okolico` : "S ponosom strežemo naši lokalni skupnosti"} kot zaupanja vreden ${label}. ${
      reviewCount
        ? `Z več kot ${reviewCount} mnenji se naše stranke vračajo — z veseljem pozdravimo tudi vas.`
        : "Prijazna postrežba, poštene cene in delo, za katerim stojimo."
    }`,
  eyebrows: ["Lokalno in zaupanja vredno", "Uveljavljeni lokalno", "Neodvisni in ponosni", "Od prvega dne"],
  taglines: [
    (label, area) =>
      area ? `Vaš lokalni ${label} – ${area}.` : `${label}, ki mu soseska zaupa.`,
    (label, area) =>
      area ? `${label} po pravilih stroke – tukaj, ${area}.` : `${label}, ki ga domačini priporočajo.`,
    (label, area) =>
      area ? `Tiho najboljši ${label} – ${area}.` : `Skrbna nega ob vsakem obisku.`,
  ],
  label: {
    salon: "salon",
    cafe: "kavarna",
    trades: "mojster",
    medical: "ordinacija",
    florist: "studio",
    fitness: "studio",
    automotive: "servis",
    professional: "ponudnik storitev",
    default: "podjetje",
  },
  services: SL_SERVICES,
};

const LOCALES: Record<Locale, LocaleStrings> = { en: EN, sl: SL };

export function getStrings(locale: Locale): LocaleStrings {
  return LOCALES[locale] ?? EN;
}

/**
 * Best-effort locale detection from the place's country. The Places address ends
 * with the country name; Slovenian businesses → Slovene. Everything else → English
 * (a safe default — English reads fine internationally). Extend as more markets are
 * added rather than guessing per-language from review text.
 */
export function detectLocale(details: Pick<NormalizedPlaceDetails, "address">): Locale {
  const addr = (details.address ?? "").toLowerCase();
  if (/\bslovenia\b|\bslovenija\b/.test(addr)) return "sl";
  return "en";
}
