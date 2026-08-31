// Lead qualification — the most important step: finding businesses that BOTH need
// a website AND are worth contacting. We score across five dimensions and combine
// them into a tier + score + human-readable reason + a full signal map.
//
//   1. Web-presence opportunity — do they need a site? (none / social-only /
//      booking-platform-only / marketplace-only / free-host builder / weak own site
//      / modern own site). This is the core of the pitch.
//   2. Worth / activity — is this a real, active, established business?
//      (reviews, rating, recency, photos, opening hours).
//   3. Reachability — can we actually contact them? (phone).
//   4. Ability to pay — will they spend? (price level, review volume).
//   5. Category fit — does a website even matter for this business type?
//
// Only signals we can trust are scored. A failed site fetch is NOT treated as
// weakness (it's often a network/DNS/IPv6/bot-block issue on our side).
import { env } from "@/lib/env";
import type { NormalizedPlaceDetails } from "@/lib/leadSource/types";
import { discoverEmail } from "@/lib/email/discover";
import { safeFetch } from "@/lib/http/safeFetch";

export type Tier = "HOT" | "WARM" | "COLD";

/** What kind of web presence a business has — drives the opportunity score. */
export type WebPresence =
  | "none" // no website listed at all
  | "social" // a social-media page only (Facebook/Instagram/…)
  | "linkinbio" // a link-in-bio page only (Linktree/…)
  | "booking" // a booking-platform profile only (Booksy/Fresha/mero.ro/OpenTable/…)
  | "marketplace" // a marketplace/aggregator listing only (Yelp/TripAdvisor/delivery/…)
  | "builder" // a free DIY builder subdomain (Wix/Weebly/…) — a weak "own-ish" site
  | "own"; // a real custom domain (or app host) — analyze the actual site

export interface SiteSignals {
  fetched: boolean;
  fetchFailed: boolean; // site exists in data but didn't load / errored
  /** Why the fetch failed, for human review: HTTP status or a network-error label.
   *  Lets a reviewer tell a genuinely-dead site from a bot-block/timeout false positive. */
  fetchFailReason: string | null;
  httpsOk: boolean;
  hasViewportMeta: boolean;
  copyrightYear: number | null;
  oldCopyright: boolean; // copyright year >= 3 years stale
  tableLayout: boolean; // table-based layout markers
  tinyPage: boolean; // suspiciously small HTML payload
  freeHost: boolean; // wix/wordpress.com/etc subdomain
  flash: boolean; // Flash / <embed swf> references
  /** A plausible contact email scraped from the page (mailto: or inline), if any —
   *  unlocks a safe, scalable outreach channel without buying anything. */
  email: string | null;
}

export interface Qualification {
  tier: Tier;
  score: number;
  reason: string;
  signals: Record<string, unknown>;
}

// ── Host classification ────────────────────────────────────────────────────
// Domains where a "website" is really a third-party profile, not the business's
// own site. A business whose only web link is one of these effectively has NO
// website of its own — often the strongest, most overlooked lead.

const SOCIAL_HOSTS: Record<string, string> = {
  "facebook.com": "Facebook",
  "fb.com": "Facebook",
  "fb.me": "Facebook",
  "m.facebook.com": "Facebook",
  "instagram.com": "Instagram",
  "instagr.am": "Instagram",
  "tiktok.com": "TikTok",
  "twitter.com": "X/Twitter",
  "x.com": "X/Twitter",
  "youtube.com": "YouTube",
  "youtu.be": "YouTube",
  "linkedin.com": "LinkedIn",
  "pinterest.com": "Pinterest",
  "threads.net": "Threads",
  "t.me": "Telegram",
  "wa.me": "WhatsApp",
  "snapchat.com": "Snapchat",
  "vk.com": "VK",
};

const LINKINBIO_HOSTS: Record<string, string> = {
  "linktr.ee": "Linktree",
  "lnk.bio": "lnk.bio",
  "beacons.ai": "Beacons",
  "bio.link": "bio.link",
  "msha.ke": "Milkshake",
  "tap.bio": "tap.bio",
  "campsite.bio": "Campsite",
};

const BOOKING_HOSTS: Record<string, string> = {
  "booksy.com": "Booksy",
  "fresha.com": "Fresha",
  "treatwell.com": "Treatwell",
  "treatwell.co.uk": "Treatwell",
  "mero.ro": "Mero",
  "planfy.com": "Planfy",
  "planity.com": "Planity",
  "setmore.com": "Setmore",
  "simplybook.me": "SimplyBook",
  "calendly.com": "Calendly",
  "schedulicity.com": "Schedulicity",
  "vagaro.com": "Vagaro",
  "styleseat.com": "StyleSeat",
  "mindbodyonline.com": "Mindbody",
  "gettimely.com": "Timely",
  "phorest.com": "Phorest",
  "salonized.com": "Salonized",
  "resy.com": "Resy",
  "opentable.com": "OpenTable",
  "thefork.com": "TheFork",
  "quandoo.com": "Quandoo",
  "bookatable.com": "Bookatable",
};

const MARKETPLACE_HOSTS: Record<string, string> = {
  "yelp.com": "Yelp",
  "tripadvisor.com": "TripAdvisor",
  "foursquare.com": "Foursquare",
  "yellowpages.com": "Yellow Pages",
  "zomato.com": "Zomato",
  "glovoapp.com": "Glovo",
  "ubereats.com": "Uber Eats",
  "wolt.com": "Wolt",
  "takeaway.com": "Takeaway",
  "deliveroo.com": "Deliveroo",
  "doordash.com": "DoorDash",
  "grubhub.com": "Grubhub",
  "etsy.com": "Etsy",
  "business.site": "Google Business site",
  "sites.google.com": "Google Sites",
  "g.page": "Google profile",
  "maps.app.goo.gl": "Google Maps link",
  "goo.gl": "Google link",
};

// Free DIY builder subdomains → a weak "own-ish" site (no custom domain, template).
const BUILDER_HOSTS: Record<string, string> = {
  "wixsite.com": "Wix",
  "wix.com": "Wix",
  "wordpress.com": "WordPress.com",
  "weebly.com": "Weebly",
  "blogspot.com": "Blogger",
  "jimdosite.com": "Jimdo",
  "jimdofree.com": "Jimdo",
  "webnode.com": "Webnode",
  "godaddysites.com": "GoDaddy Sites",
  "yolasite.com": "Yola",
  "site123.me": "Site123",
  "strikingly.com": "Strikingly",
  "mystrikingly.com": "Strikingly",
  "webflow.io": "Webflow (subdomain)",
  "tilda.ws": "Tilda",
  "tilda.cc": "Tilda",
  "ucraft.net": "Ucraft",
  "carrd.co": "Carrd",
};

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Exact or subdomain match against a host map; returns the platform label or null. */
function matchHost(host: string, map: Record<string, string>): string | null {
  for (const domain of Object.keys(map)) {
    if (host === domain || host.endsWith(`.${domain}`)) return map[domain];
  }
  return null;
}

export interface WebPresenceInfo {
  presence: WebPresence;
  platform: string | null; // friendly name when it's a known third-party host
  host: string | null;
}

/** Classify a website URL into a web-presence category (no network call). */
export function classifyWebPresence(website?: string | null): WebPresenceInfo {
  if (!website) return { presence: "none", platform: null, host: null };
  const host = hostnameOf(website);
  if (!host) return { presence: "own", platform: null, host: null };

  let platform: string | null;
  if ((platform = matchHost(host, SOCIAL_HOSTS))) return { presence: "social", platform, host };
  if ((platform = matchHost(host, LINKINBIO_HOSTS)))
    return { presence: "linkinbio", platform, host };
  if ((platform = matchHost(host, BOOKING_HOSTS))) return { presence: "booking", platform, host };
  if ((platform = matchHost(host, MARKETPLACE_HOSTS)))
    return { presence: "marketplace", platform, host };
  if ((platform = matchHost(host, BUILDER_HOSTS))) return { presence: "builder", platform, host };
  return { presence: "own", platform: null, host };
}

/** True when a presence category warrants actually fetching the page to assess it. */
export function presenceNeedsFetch(presence: WebPresence): boolean {
  return presence === "own" || presence === "builder";
}

// ── Category fit ───────────────────────────────────────────────────────────
// Google place types where a website materially helps the business (and the owner
// is plausibly a buyer), vs. types that aren't real SMB website targets.

const HIGH_VALUE_TYPES = new Set([
  "restaurant", "cafe", "bar", "bakery", "meal_takeaway", "meal_delivery",
  "food", "coffee_shop", "pizza_restaurant", "fine_dining_restaurant",
  "hair_salon", "hair_care", "beauty_salon", "barber_shop", "nail_salon",
  "spa", "wellness_center", "massage", "tanning_studio", "makeup_artist",
  "dentist", "doctor", "physiotherapist", "veterinary_care", "chiropractor",
  "dental_clinic", "medical_clinic", "optometrist", "psychologist",
  "gym", "fitness_center", "yoga_studio", "personal_trainer",
  "lawyer", "accounting", "real_estate_agency", "insurance_agency",
  "consultant", "marketing_agency", "architect", "interior_designer",
  "lodging", "hotel", "bed_and_breakfast", "guest_house", "resort_hotel",
  "plumber", "electrician", "painter", "roofing_contractor", "locksmith",
  "general_contractor", "moving_company", "hvac_contractor", "handyman",
  "car_repair", "car_dealer", "car_wash", "auto_parts_store", "tire_shop",
  "florist", "photographer", "jewelry_store", "clothing_store", "shoe_store",
  "furniture_store", "pet_store", "book_store", "store", "boutique",
  "travel_agency", "event_planner", "catering_service", "wedding_venue",
  "tutoring_service", "driving_school", "language_school", "art_studio",
]);

const EXCLUDED_TYPES = new Set([
  "atm", "bank", "bus_station", "train_station", "transit_station",
  "subway_station", "light_rail_station", "taxi_stand", "parking",
  "gas_station", "government_office", "city_hall", "courthouse", "embassy",
  "fire_station", "police", "post_office", "local_government_office",
  "primary_school", "secondary_school", "university", "library", "hospital",
  "airport", "cemetery", "place_of_worship", "church", "mosque", "synagogue",
  "hindu_temple", "tourist_attraction", "park", "national_park", "rest_stop",
]);

type CategoryFit = "high" | "neutral" | "excluded";

function categoryFit(place: NormalizedPlaceDetails): CategoryFit {
  const types = [place.primaryType, ...(place.categories ?? [])].filter(Boolean) as string[];
  if (types.some((t) => EXCLUDED_TYPES.has(t)) && !types.some((t) => HIGH_VALUE_TYPES.has(t))) {
    return "excluded";
  }
  if (types.some((t) => HIGH_VALUE_TYPES.has(t))) return "high";
  return "neutral";
}

// ── Site fetch + weakness extraction ───────────────────────────────────────

const STALE_YEARS = 3;

/** Fetch the existing site and extract weakness signals. Fails gracefully. */
export async function analyzeSite(website: string): Promise<SiteSignals> {
  const base: SiteSignals = {
    fetched: false,
    fetchFailed: false,
    fetchFailReason: null,
    httpsOk: website.startsWith("https://"),
    hasViewportMeta: false,
    copyrightYear: null,
    oldCopyright: false,
    tableLayout: false,
    tinyPage: false,
    freeHost: false,
    flash: false,
    email: null,
  };

  const { presence } = classifyWebPresence(website);
  base.freeHost = presence === "builder";

  // Google's websiteUri is frequently http:// even when the site actually serves
  // (and redirects to) https. So if the given http URL won't connect, retry the
  // https variant before giving up — and judge httpsOk from the FINAL url after
  // redirects, never from the original string.
  const candidates = website.startsWith("http://")
    ? [website, `https://${website.slice("http://".length)}`]
    : [website];

  let res: Response | undefined;
  let lastErr: (Error & { cause?: { code?: string } }) | undefined;
  for (const url of candidates) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), env.siteFetchTimeoutMs);
    try {
      // safeFetch, not fetch: this URL comes from a business's Google listing,
      // so it is chosen by someone else. It follows redirects itself, checking
      // every hop, which is why "redirect" is no longer passed here.
      res = await safeFetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; LeadQualifier/1.0)" },
      });
      break; // got a response (ok or not) — no need to try the next candidate
    } catch (err) {
      lastErr = err as Error & { cause?: { code?: string } };
    } finally {
      clearTimeout(timer);
    }
  }

  // Couldn't load it at all. We can't verify HTTPS, so don't pile a (possibly
  // false) "no HTTPS" signal on top of the load failure — just flag it for review.
  if (!res) {
    base.fetchFailed = true;
    base.httpsOk = true;
    base.fetchFailReason = describeFetchError(lastErr);
    return base;
  }

  // Decide HTTPS from where we actually landed (http→https redirect counts as secure).
  base.httpsOk = res.url.startsWith("https://");

  if (!res.ok) {
    base.fetchFailed = true;
    base.fetchFailReason = `HTTP ${res.status}`;
    return base;
  }

  try {
    const html = (await res.text()).slice(0, 500_000); // cap memory
    base.fetched = true;

    const lower = html.toLowerCase();
    base.hasViewportMeta = /<meta[^>]+name=["']?viewport/i.test(html);
    base.tinyPage = html.length < 1500;
    base.flash =
      lower.includes(".swf") ||
      lower.includes("application/x-shockwave-flash") ||
      lower.includes("<embed");
    // Crude table-layout heuristic: multiple layout tables and no modern grid/flex.
    const tableCount = (lower.match(/<table/g) ?? []).length;
    base.tableLayout =
      tableCount >= 3 && !lower.includes("display:flex") && !lower.includes("display:grid");

    // Most recent 4-digit year mentioned near a copyright marker, else any year.
    const years = [...html.matchAll(/(?:©|&copy;|copyright)[^0-9]{0,20}(19|20)\d{2}/gi)]
      .map((m) => parseInt(m[0].match(/(19|20)\d{2}/)![0], 10))
      .filter((y) => y >= 1995 && y <= new Date().getFullYear());
    if (years.length) {
      base.copyrightYear = Math.max(...years);
      base.oldCopyright = new Date().getFullYear() - base.copyrightYear >= STALE_YEARS;
    }

    // Find a contact email — homepage first, then a short contact-page crawl with
    // obfuscation decoding. This is the only scalable outreach channel, so it's
    // worth a couple of extra requests when the homepage doesn't surface one.
    base.email = await discoverEmail(website, html);

    return base;
  } catch (err) {
    base.fetchFailed = true;
    base.fetchFailReason = describeFetchError(err as Error & { cause?: { code?: string } });
    return base;
  }
}

/** Turn a fetch error into something a human reviewer can act on. */
function describeFetchError(err?: Error & { cause?: { code?: string } }): string {
  if (!err) return "network error";
  // AbortError = our own timeout; Node's fetch throws TypeError for DNS/connection
  // failures (often with a useful .cause.code, e.g. ENOTFOUND / ECONNREFUSED).
  if (err.name === "AbortError") return `timed out (>${env.siteFetchTimeoutMs}ms)`;
  if (err.name === "TypeError") {
    return err.cause?.code ? `could not connect (${err.cause.code})` : "could not connect";
  }
  return err.name || "network error";
}

// ── Scoring ─────────────────────────────────────────────────────────────────

function isClosed(status?: string): boolean {
  return status === "CLOSED_PERMANENTLY" || status === "CLOSED_TEMPORARILY";
}

const PRICE_POINTS: Record<string, number> = {
  PRICE_LEVEL_VERY_EXPENSIVE: 6,
  PRICE_LEVEL_EXPENSIVE: 6,
  PRICE_LEVEL_MODERATE: 3,
  PRICE_LEVEL_INEXPENSIVE: 1,
};

/** Days since the most recent review, or null if unknown. */
function lastReviewAgeDays(place: NormalizedPlaceDetails): number | null {
  if (!place.lastReviewAt) return null;
  const t = Date.parse(place.lastReviewAt);
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86_400_000);
}

/**
 * Dimension 2–4: how much this business is worth contacting — activity, quality,
 * reachability, and ability to pay. Returns a 0–~60 score plus reason fragments.
 */
function computeWorth(place: NormalizedPlaceDetails): { worth: number; reasons: string[] } {
  const reasons: string[] = [];
  let worth = 0;

  // Review volume → established / busy (the dominant signal).
  const volume = Math.min(Math.floor(place.reviewCount / 10), 22);
  worth += volume;

  // Rating → reputation (a business that cares about reputation invests in image).
  if (place.rating != null) {
    if (place.rating >= 4.5) worth += 10;
    else if (place.rating >= 4.0) worth += 7;
    else if (place.rating >= 3.5) worth += 2;
  }
  if (place.reviewCount > 0) {
    reasons.push(`${place.reviewCount} reviews${place.rating != null ? ` at ${place.rating}★` : ""}`);
  }

  // Recency → still active (not a dormant/declining listing).
  const ageDays = lastReviewAgeDays(place);
  if (ageDays != null) {
    if (ageDays <= 60) {
      worth += 10;
      reasons.push("active recently");
    } else if (ageDays <= 180) {
      worth += 6;
      reasons.push("active in the last 6mo");
    } else if (ageDays <= 365) {
      worth += 2;
    } else {
      reasons.push("no recent reviews");
    }
  }

  // Engagement with their own listing.
  if (place.photoCount >= 10) worth += 5;
  else if (place.photoCount >= 3) worth += 2;

  // Maintains the listing → an owner who's reachable and somewhat online-minded.
  if (place.hasHours) worth += 3;

  // Reachability (dimension 3) — no phone, much harder to pitch.
  if (place.phone) {
    worth += 6;
    reasons.push("reachable by phone");
  } else {
    reasons.push("no phone listed");
  }

  // Ability to pay (dimension 4).
  if (place.priceLevel && PRICE_POINTS[place.priceLevel]) {
    worth += PRICE_POINTS[place.priceLevel];
  }

  return { worth: Math.min(worth, 60), reasons };
}

/**
 * Dimension 1: the web-presence opportunity. Returns an opportunity score plus a
 * reason, and a flag for the special "has a site but we couldn't read it" case.
 */
function computeOpportunity(
  place: NormalizedPlaceDetails,
  info: WebPresenceInfo,
  site?: SiteSignals,
): { opportunity: number; reason: string; modern: boolean; unreachable: boolean } {
  const plat = info.platform ? ` (${info.platform})` : "";
  switch (info.presence) {
    case "none":
      return { opportunity: 45, reason: "no website at all", modern: false, unreachable: false };
    case "social":
      return {
        opportunity: 42,
        reason: `only a social-media page${plat} — no website of their own`,
        modern: false,
        unreachable: false,
      };
    case "linkinbio":
      return {
        opportunity: 40,
        reason: `only a link-in-bio page${plat} — no real website`,
        modern: false,
        unreachable: false,
      };
    case "booking":
      return {
        opportunity: 40,
        reason: `only a booking-platform profile${plat} — no website of their own`,
        modern: false,
        unreachable: false,
      };
    case "marketplace":
      return {
        opportunity: 36,
        reason: `only a marketplace/aggregator listing${plat} — no website of their own`,
        modern: false,
        unreachable: false,
      };
    case "builder":
    case "own": {
      // Needs the analyzed site. If absent, we can't say much.
      if (!site) {
        return { opportunity: 10, reason: "has a website (not analyzed)", modern: false, unreachable: false };
      }
      const weak: string[] = [];
      let score = 0;
      if (info.presence === "builder") {
        score += 30;
        weak.push(`DIY builder site${plat} (no custom domain)`);
      }
      if (site.fetched && !site.httpsOk) {
        score += 20;
        weak.push("no HTTPS");
      }
      if (site.oldCopyright) {
        score += 20;
        weak.push(`copyright ${site.copyrightYear} is ${STALE_YEARS}+ years stale`);
      }
      if (site.fetched && !site.hasViewportMeta) {
        score += 20;
        weak.push("not mobile-friendly (no viewport meta)");
      }
      if (site.tableLayout) {
        score += 15;
        weak.push("table-based layout");
      }
      if (site.flash) {
        score += 25;
        weak.push("Flash/legacy embeds");
      }
      if (site.tinyPage) {
        score += 10;
        weak.push("very thin page");
      }

      if (score > 0) {
        return {
          opportunity: Math.min(score, 50),
          reason: `weak/outdated site (${weak.join("; ")})`,
          modern: false,
          unreachable: false,
        };
      }
      if (site.fetchFailed) {
        return {
          opportunity: 0,
          reason: `has a website we couldn't open from here (${site.fetchFailReason ?? "no response"})`,
          modern: false,
          unreachable: true,
        };
      }
      return { opportunity: 0, reason: "already has a modern, mobile-friendly site", modern: true, unreachable: false };
    }
  }
}

/**
 * Score a lead into a tier. When the business has an OWN/builder site, pass its
 * analyzed signals (run analyzeSite first); for other presences, omit them.
 */
export function qualify(place: NormalizedPlaceDetails, site?: SiteSignals): Qualification {
  const info = classifyWebPresence(place.website);
  const fit = categoryFit(place);
  const { worth, reasons: worthReasons } = computeWorth(place);

  const signals: Record<string, unknown> = {
    businessStatus: place.businessStatus,
    reviewCount: place.reviewCount,
    rating: place.rating,
    photoCount: place.photoCount,
    hasWebsite: Boolean(place.website),
    webPresence: info.presence,
    platform: info.platform,
    categoryFit: fit,
    worth,
    priceLevel: place.priceLevel ?? null,
    lastReviewAgeDays: lastReviewAgeDays(place),
    site: site ?? null,
  };

  // Hard disqualifiers → COLD.
  if (isClosed(place.businessStatus)) {
    return {
      tier: "COLD",
      score: 0,
      reason: `Business is ${place.businessStatus?.toLowerCase().replace(/_/g, " ")} — deprioritized.`,
      signals,
    };
  }
  if (fit === "excluded") {
    return {
      tier: "COLD",
      score: 0,
      reason: "Not a typical website buyer for this category — deprioritized.",
      signals,
    };
  }

  const opp = computeOpportunity(place, info, site);
  signals.opportunity = opp.opportunity;

  // Already has a good site → low priority.
  if (opp.modern) {
    return {
      tier: "COLD",
      score: Math.max(0, worth - 35),
      reason: `Already has a modern, mobile-friendly site — low priority.`,
      signals,
    };
  }

  // Has a site we couldn't read → genuinely ambiguous; flag for a human, don't guess.
  if (opp.unreachable) {
    return {
      tier: "COLD",
      score: 5,
      reason: `${capitalize(opp.reason)} — often a slow site or a network/DNS issue on our end, not a dead one. Verify manually.`,
      signals,
    };
  }

  // Real opportunity present. Combine opportunity + worth, with a small category bump.
  const fitBonus = fit === "high" ? 8 : 0;
  const score = Math.min(opp.opportunity + worth + fitBonus, 100);
  signals.score = score;

  const worthSummary = worthReasons.length ? worthReasons.join(", ") : "little activity yet";
  const reason = `${capitalize(opp.reason)}. ${describeWorthTier(worth)}: ${worthSummary}.`;

  // Tier by how worth-it the business is (opportunity is already established here).
  let tier: Tier;
  if (worth >= 25) tier = "HOT"; // active, established business that needs a site
  else if (worth >= 12) tier = "WARM"; // decent business, fewer signals
  else tier = "COLD"; // real gap, but unproven/inactive business

  return { tier, score, reason, signals };
}

function describeWorthTier(worth: number): string {
  if (worth >= 25) return "Active, established business";
  if (worth >= 12) return "Real business";
  return "Unproven/low-activity";
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
