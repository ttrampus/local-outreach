// Lead qualification: turn a NormalizedPlaceDetails into a tier + score + reason.
//
// Key insight: a business with an OUTDATED site is a warmer lead than one with no
// site at all — they already believe a website has value. So a weak existing site
// scores HOT, an active business with no site scores WARM, and everything else
// (no site + thin reviews, or closed) is COLD.
import { env } from "@/lib/env";
import type { NormalizedPlaceDetails } from "@/lib/leadSource/types";

export type Tier = "HOT" | "WARM" | "COLD";

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
}

export interface Qualification {
  tier: Tier;
  score: number;
  reason: string;
  signals: Record<string, unknown>;
}

const FREE_HOSTS = [
  "wixsite.com",
  "wix.com",
  "wordpress.com",
  "weebly.com",
  "blogspot.com",
  "jimdosite.com",
  "webnode.",
  "business.site", // Google Business "instant" sites — very weak
  "godaddysites.com",
  "yolasite.com",
];

const STALE_YEARS = 3;

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

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
  };

  const host = hostnameOf(website);
  if (host) base.freeHost = FREE_HOSTS.some((h) => host.includes(h));

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
      res = await fetch(url, {
        signal: controller.signal,
        redirect: "follow",
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

function isClosed(status?: string): boolean {
  return status === "CLOSED_PERMANENTLY" || status === "CLOSED_TEMPORARILY";
}

// Reward active businesses (more reviews + decent rating = warmer), capped.
function reviewBonus(reviewCount: number, rating?: number): number {
  const volume = Math.min(Math.floor(reviewCount / 10), 25);
  const quality = rating && rating >= 4.0 ? 5 : 0;
  return volume + quality;
}

/**
 * Score a lead into a tier. When the business has a website, pass its analyzed
 * signals (run analyzeSite first); otherwise omit them.
 */
export function qualify(
  place: NormalizedPlaceDetails,
  site?: SiteSignals,
): Qualification {
  const reasons: string[] = [];
  const signals: Record<string, unknown> = {
    businessStatus: place.businessStatus,
    reviewCount: place.reviewCount,
    rating: place.rating,
    hasWebsite: Boolean(place.website),
    site: site ?? null,
  };

  // 1) Closed / defunct → COLD, deprioritize regardless of anything else.
  if (isClosed(place.businessStatus)) {
    return {
      tier: "COLD",
      score: 0,
      reason: `Business is ${place.businessStatus?.toLowerCase().replace("_", " ")} — deprioritized.`,
      signals,
    };
  }

  // 2) Has a website → inspect it. Only signals from actually READING the page (or
  //    from the URL itself, like a free-host subdomain) are reliable enough to call
  //    a site "weak" and mark it HOT. A fetch FAILURE is deliberately NOT scored as
  //    weakness: it just as often means the site is slow, bot-blocked, IPv6-only, or
  //    unreachable from this host as it means the site is actually down. So an
  //    unreadable site gets its own low-priority "verify manually" outcome instead of
  //    a false-positive HOT.
  if (place.website && site) {
    let score = 0;
    if (site.freeHost) {
      score += 30;
      reasons.push("site is on a free host (wix/wordpress.com-style subdomain)");
    }
    if (site.fetched && !site.httpsOk) {
      score += 20;
      reasons.push("no HTTPS"); // judged by the final URL after redirects (see analyzeSite)
    }
    if (site.oldCopyright) {
      score += 20;
      reasons.push(`copyright year ${site.copyrightYear} is ${STALE_YEARS}+ years stale`);
    }
    if (site.fetched && !site.hasViewportMeta) {
      score += 20;
      reasons.push("no responsive viewport meta (not mobile-friendly)");
    }
    if (site.tableLayout) {
      score += 15;
      reasons.push("table-based layout");
    }
    if (site.flash) {
      score += 25;
      reasons.push("references Flash/legacy embeds");
    }
    if (site.tinyPage) {
      score += 10;
      reasons.push("very small / thin page");
    }

    // Confidently weak site → HOT, ranked by how weak it is (+ an active-business bonus).
    if (score > 0) {
      score += reviewBonus(place.reviewCount, place.rating);
      return {
        tier: "HOT",
        score: Math.min(score, 100),
        reason: `Outdated/weak site (${reasons.join("; ")}). Active business — already values a website.`,
        signals,
      };
    }

    // Has a website but we couldn't open it AND saw no other weakness. Genuinely
    // ambiguous (often a network/DNS/IPv6 issue on our side, not a dead site), so we
    // don't claim it's weak — low priority, flagged for a human to check.
    if (site.fetchFailed) {
      return {
        tier: "COLD",
        score: 5,
        reason: `Has a website we couldn't open from here (${site.fetchFailReason ?? "no response"}) — often a slow site or a network/DNS issue on our end, not a dead one. Verify manually.`,
        signals,
      };
    }

    // Website loaded fine and showed no weakness signals → modern → low priority.
    return {
      tier: "COLD",
      score: Math.max(0, reviewBonus(place.reviewCount, place.rating) - 10),
      reason: "Already has a modern, mobile-friendly site — low priority.",
      signals,
    };
  }

  // 3) No website. Active business (good reviews) → WARM; otherwise COLD.
  const active = place.reviewCount >= 20 && (place.rating ?? 0) >= 4.0;
  if (active) {
    return {
      tier: "WARM",
      score: Math.min(40 + reviewBonus(place.reviewCount, place.rating), 100),
      reason: `No website but ${place.reviewCount} reviews at ${place.rating}★ — a real, active business.`,
      signals,
    };
  }

  return {
    tier: "COLD",
    score: reviewBonus(place.reviewCount, place.rating),
    reason: place.reviewCount === 0
      ? "No website and no reviews — unproven."
      : `No website and only ${place.reviewCount} reviews — low signal.`,
    signals,
  };
}
