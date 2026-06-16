// Offline LeadSource: deterministic sample data, no API key, no spend.
// Lets you validate the qualifier + dashboard before paying Google. The data
// is intentionally varied so every tier (HOT/WARM/COLD) is exercised.
import type {
  LeadSource,
  NormalizedPlaceDetails,
  NormalizedSearchResult,
} from "./types";

type MockPlace = NormalizedPlaceDetails;

// A small fixed catalogue. `website` URLs point at deliberately "weak" or
// missing sites so the qualifier's site-analysis path is exercised too.
const CATALOGUE: MockPlace[] = [
  {
    placeId: "mock_old_salon",
    name: "Coafor Elegance",
    address: "Str. Lipscani 12, Bucharest",
    phone: "+40 21 555 0100",
    website: "http://coafor-elegance.ro", // old, non-https -> HOT signal
    rating: 4.6,
    reviewCount: 214,
    photoCount: 8,
    businessStatus: "OPERATIONAL",
    reviewSnippets: [
      "Best haircut in the old town, been coming for years!",
      "Lovely staff, but their website is ancient.",
    ],
    categories: ["hair_salon", "beauty_salon"],
  },
  {
    placeId: "mock_wix_cafe",
    name: "Cafeneaua Verde",
    address: "Calea Victoriei 88, Bucharest",
    phone: "+40 21 555 0142",
    website: "https://cafeneauaverde.wixsite.com/home", // free-host -> HOT signal
    rating: 4.8,
    reviewCount: 530,
    photoCount: 25,
    businessStatus: "OPERATIONAL",
    reviewSnippets: [
      "Best flat white in the neighborhood.",
      "Cozy spot, great pastries and friendly baristas.",
    ],
    categories: ["cafe", "coffee_shop"],
  },
  {
    placeId: "mock_busy_plumber",
    name: "InstalPro Instalatii",
    address: "Bd. Unirii 4, Bucharest",
    phone: "+40 21 555 0188",
    website: undefined, // no site + strong reviews -> HOT (active, clear need)
    rating: 4.9,
    reviewCount: 312,
    photoCount: 3,
    businessStatus: "OPERATIONAL",
    reviewSnippets: [
      "Came same day and fixed a burst pipe, lifesavers.",
      "Honest pricing, highly recommend.",
    ],
    categories: ["plumber"],
    primaryType: "plumber",
    priceLevel: "PRICE_LEVEL_MODERATE",
    hasHours: true,
    lastReviewAt: new Date(Date.now() - 20 * 86_400_000).toISOString(),
  },
  {
    placeId: "mock_facebook_barber",
    name: "King's Barbershop",
    address: "Str. Victoriei 5, Bucharest",
    phone: "+40 21 555 0150",
    website: "https://www.facebook.com/kingsbarbershopbuc", // social-only -> no real site
    rating: 4.8,
    reviewCount: 276,
    photoCount: 18,
    businessStatus: "OPERATIONAL",
    reviewSnippets: ["Best fade in town.", "Always book ahead, they're busy."],
    categories: ["barber_shop", "hair_care"],
    primaryType: "barber_shop",
    priceLevel: "PRICE_LEVEL_MODERATE",
    hasHours: true,
    lastReviewAt: new Date(Date.now() - 10 * 86_400_000).toISOString(),
  },
  {
    placeId: "mock_booksy_nails",
    name: "Lux Nails Studio",
    address: "Calea Dorobanti 50, Bucharest",
    phone: "+40 21 555 0166",
    website: "https://booksy.com/en-us/lux-nails-studio", // booking-platform-only
    rating: 4.7,
    reviewCount: 142,
    photoCount: 30,
    businessStatus: "OPERATIONAL",
    reviewSnippets: ["Gorgeous gel manicure.", "Easy to book online."],
    categories: ["nail_salon", "beauty_salon"],
    primaryType: "nail_salon",
    priceLevel: "PRICE_LEVEL_EXPENSIVE",
    hasHours: true,
    lastReviewAt: new Date(Date.now() - 35 * 86_400_000).toISOString(),
  },
  {
    placeId: "mock_quiet_florist",
    name: "Flori de Cartier",
    address: "Str. Mihai Bravu 200, Bucharest",
    phone: undefined,
    website: undefined, // no site, few reviews -> COLD
    rating: 4.2,
    reviewCount: 6,
    photoCount: 1,
    businessStatus: "OPERATIONAL",
    reviewSnippets: ["Nice little flower shop."],
    categories: ["florist"],
  },
  {
    placeId: "mock_closed_bakery",
    name: "Brutaria Veche",
    address: "Str. Dorobanti 15, Bucharest",
    phone: "+40 21 555 0199",
    website: undefined,
    rating: 4.0,
    reviewCount: 40,
    photoCount: 2,
    businessStatus: "CLOSED_PERMANENTLY", // -> COLD (defunct)
    reviewSnippets: ["Used to be great, sadly closed."],
    categories: ["bakery"],
  },
  {
    placeId: "mock_modern_dentist",
    name: "BrightSmile Dental",
    address: "Bd. Magheru 30, Bucharest",
    phone: "+40 21 555 0211",
    website: "https://brightsmile-dental.example.com", // modern https site -> likely WARM/low score
    rating: 4.7,
    reviewCount: 180,
    photoCount: 12,
    businessStatus: "OPERATIONAL",
    reviewSnippets: [
      "Painless cleaning and a slick online booking system.",
      "Modern clinic, very professional.",
    ],
    categories: ["dentist"],
  },
];

export const mockSource: LeadSource = {
  name: "mock",

  async search(query, _location, pageToken) {
    // Single page; ignores the query text and just returns the catalogue once.
    if (pageToken) return { results: [] };
    const results: NormalizedSearchResult[] = CATALOGUE.map((p) => ({
      placeId: p.placeId,
      name: p.name,
      address: p.address,
    }));
    return { results };
  },

  async details(placeId) {
    const found = CATALOGUE.find((p) => p.placeId === placeId);
    if (!found) throw new Error(`mock: unknown placeId ${placeId}`);
    // Return a copy so callers can't mutate the catalogue.
    return { ...found, reviewSnippets: [...found.reviewSnippets], categories: [...found.categories] };
  },
};
