// Every word the outreach email is made of, per locale.
//
// The message is FIXED. One text, sent to everyone, with exactly one thing that
// varies: what kind of business they are ("your salon" / "your barbershop" /
// "your car dealership"). Nothing else is personalized — no street, no rating, no
// staff names, no "I noticed…". A cold email that recites what you found out
// about someone reads as surveillance, and the preview link is a far better
// argument than any observation could be: it is their own site, already built.
//
// Fixed also means testable. When one word changes between sends, an open or
// reply rate measures the wording lottery; when nothing changes, it measures the
// offer.
//
// Kept here rather than in preview/i18n.ts, which is the vocabulary of the
// generated websites and has no business knowing about email.
import type { Locale } from "@/lib/preview/i18n";

export interface EmailStrings {
  /**
   * Anchor text for the preview link. Written as a call to action rather than a
   * description, because it is the one thing the whole email is asking for — and
   * it is the anchor of a real link, so the reader never sees a raw URL.
   */
  previewLink: string;
  /** Subject line of the initial email. */
  subject: string;
  /**
   * The generic fallback for the "your <kind of business>" phrase, used when the
   * lead's Google categories say nothing useful. Never a guess: a business called
   * the wrong thing is worse than one called a business.
   */
  business: string;
  /**
   * The opt-out. Deliberately NOT "unsubscribe": nobody subscribed to a cold
   * email, and offering to end a subscription they never started reads as either
   * a mistake or a dark pattern. What is actually on offer is "I will stop".
   *
   * It also has to read as a BUTTON rather than an instruction. "Let me know"
   * describes composing a reply, which is a different and much larger ask than
   * the single click this actually is — and a reader who thinks it means writing
   * an email simply does not bother.
   */
  optOut: string;
}

const EN: EmailStrings = {
  previewLink: "SEE HOW IT LOOKS →",
  subject: "I made you a preview of a new website",
  business: "your business",
  optOut: "Not interested? Click here and I won't contact you again.",
};

const SL: EmailStrings = {
  previewLink: "POGLEJTE, KAKO IZGLEDA →",
  subject: "Naredil sem vam predogled nove spletne strani",
  business: "vaše podjetje",
  optOut: "Vas ne zanima? Kliknite tukaj in vas ne bom več kontaktiral.",
};

const STRINGS: Record<Locale, EmailStrings> = { en: EN, sl: SL };

export function getEmailStrings(locale: Locale): EmailStrings {
  return STRINGS[locale] ?? EN;
}

/**
 * What to call the business in the one sentence that names it, keyed by the place
 * types Google gives us.
 *
 * Whole phrases, not nouns, because Slovene declines them and the sentence needs
 * the accusative: "naletel sem na vaš salon" but "…na vašo kavarno". A lookup of
 * bare nouns would produce "na vaš kavarna", which is the kind of mistake no
 * native speaker makes and every template does.
 *
 * Ordered most specific first and matched in THAT order, not in the order Google
 * happens to list a place's types: a barbershop comes back as both barber_shop
 * and hair_salon, and "barbershop" is the one its owner would use.
 */
const BUSINESS_KINDS: { types: string[]; sl: string; en: string }[] = [
  { types: ["barber_shop"], sl: "vaš brivski salon", en: "your barbershop" },
  { types: ["hair_salon", "hair_care"], sl: "vaš frizerski salon", en: "your hair salon" },
  { types: ["nail_salon"], sl: "vaš salon za nohte", en: "your nail salon" },
  { types: ["tattoo_parlor"], sl: "vaš tattoo studio", en: "your tattoo studio" },
  { types: ["massage", "massage_spa"], sl: "vaš masažni salon", en: "your massage studio" },
  { types: ["spa", "wellness_center"], sl: "vaš wellness", en: "your spa" },
  {
    types: ["skin_care_clinic", "beauty_salon", "cosmetics_store", "makeup_artist"],
    sl: "vaš kozmetični salon",
    en: "your beauty salon",
  },
  { types: ["car_dealer"], sl: "vaš avtosalon", en: "your car dealership" },
  { types: ["car_repair", "car_wash", "auto_parts_store"], sl: "vaš avtoservis", en: "your garage" },
  { types: ["driving_school"], sl: "vašo avtošolo", en: "your driving school" },
  { types: ["bakery"], sl: "vašo pekarno", en: "your bakery" },
  { types: ["cafe", "coffee_shop"], sl: "vašo kavarno", en: "your café" },
  { types: ["bar", "pub", "night_club"], sl: "vaš lokal", en: "your bar" },
  { types: ["restaurant", "meal_takeaway", "pizza_restaurant"], sl: "vašo restavracijo", en: "your restaurant" },
  { types: ["dentist", "dental_clinic"], sl: "vašo zobozdravstveno ordinacijo", en: "your dental practice" },
  { types: ["veterinary_care"], sl: "vašo veterinarsko ambulanto", en: "your veterinary practice" },
  {
    types: ["doctor", "medical_clinic", "medical_center", "physiotherapist", "hospital"],
    sl: "vašo ordinacijo",
    en: "your practice",
  },
  { types: ["optician", "pharmacy"], sl: "vašo poslovalnico", en: "your store" },
  {
    types: ["gym", "fitness_center", "sports_complex", "yoga_studio", "sports_school"],
    sl: "vaš fitnes",
    en: "your gym",
  },
  { types: ["florist"], sl: "vašo cvetličarno", en: "your flower shop" },
  { types: ["photographer", "photography_studio"], sl: "vaš fotografski studio", en: "your photography studio" },
  { types: ["real_estate_agency"], sl: "vašo nepremičninsko agencijo", en: "your agency" },
  { types: ["travel_agency", "tour_agency"], sl: "vašo turistično agencijo", en: "your travel agency" },
  { types: ["insurance_agency"], sl: "vašo agencijo", en: "your agency" },
  { types: ["lawyer", "accounting", "notary_public", "consultant"], sl: "vašo pisarno", en: "your practice" },
  { types: ["hotel", "lodging", "guest_house", "campground"], sl: "vaš hotel", en: "your hotel" },
  {
    types: ["plumber", "electrician", "roofing_contractor", "general_contractor", "painter", "moving_company", "locksmith"],
    sl: "vašo dejavnost",
    en: "your business",
  },
  {
    types: ["store", "grocery_store", "food_store", "clothing_store", "furniture_store", "pet_store", "electronics_store"],
    sl: "vašo trgovino",
    en: "your shop",
  },
];

/**
 * The "your <kind of business>" phrase for a lead's Google categories, falling
 * back to the neutral word for "business" when they say nothing specific. The
 * generic types every place carries (establishment, point_of_interest, service)
 * simply never appear in the table, so they fall through on their own.
 */
export function businessPhrase(locale: Locale, categories: string[]): string {
  const types = new Set(categories.map((c) => c.toLowerCase()));
  const match = BUSINESS_KINDS.find((kind) => kind.types.some((t) => types.has(t)));
  if (!match) return getEmailStrings(locale).business;
  return locale === "sl" ? match.sl : match.en;
}
