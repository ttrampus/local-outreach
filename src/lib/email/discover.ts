// Email discovery — find a real contact email for a business from its own website.
// Email is the only outreach channel that scales for a solo operator, so every lead
// we can attach an address to is worth far more than one that falls to phone/manual.
//
// A naive homepage regex misses most of them: Slovenian SMBs put their address on a
// /kontakt page, hide it behind Cloudflare's data-cfemail obfuscation, or write it as
// "info [at] domain (dot) si" to dodge scrapers. This module:
//   1. extracts emails from HTML, decoding mailto:, Cloudflare cfemail, HTML entities
//      and [at]/(dot)-style obfuscation;
//   2. when the homepage yields nothing, crawls a few likely contact pages.
import { env } from "@/lib/env";
import { safeFetch } from "@/lib/http/safeFetch";

// Reject asset filenames, tracking/builder noise, and placeholder addresses that a
// naive email regex would otherwise pick up.
export function isPlausibleEmail(e: string): boolean {
  if (e.length > 100) return false;
  if (/\.(png|jpe?g|gif|webp|svg|css|js|woff2?|ttf)$/i.test(e)) return false;
  if (
    /(example\.|sentry|wixpress|cloudflare|@2x|@3x|your-?email|youremail|name@|email@example|domain\.com|u002|@sentry|godaddy|wordpress\.|squarespace)/i.test(
      e,
    )
  )
    return false;
  return /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(e);
}

/** Decode a Cloudflare-obfuscated email (the `data-cfemail` hex string). */
function decodeCfEmail(hex: string): string | null {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length < 4 || hex.length % 2 !== 0) return null;
  try {
    const key = parseInt(hex.slice(0, 2), 16);
    let out = "";
    for (let i = 2; i < hex.length; i += 2) {
      out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key);
    }
    return out;
  } catch {
    return null;
  }
}

/** Decode numeric/hex HTML entities so `&#64;`/`&#x40;` become real characters. */
function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&amp;/gi, "&");
}

/** Turn "info [at] salon (dot) si" style obfuscation back into "info@salon.si". */
function deobfuscate(s: string): string {
  return s
    .replace(/\s*[\[(]\s*(?:at|@|aaa?t|ad)\s*[\])]\s*/gi, "@")
    .replace(/\s+(?:at|@)\s+/gi, "@")
    .replace(/\s*[\[(]\s*(?:dot|punkt|pika|d0t)\s*[\])]\s*/gi, ".")
    .replace(/\s+(?:dot|punkt|pika)\s+/gi, ".");
}

const normalize = (raw: string): string =>
  raw.trim().toLowerCase().replace(/^mailto:/i, "").split("?")[0].replace(/[.,;:]+$/, "");

/**
 * Extract every plausible contact email from a page's HTML, most trustworthy first:
 * explicit mailto: links, then Cloudflare-obfuscated, then entity/[at]-obfuscated,
 * then any plain inline address. Returns a de-duplicated, ranked list.
 */
export function extractEmails(html: string): string[] {
  const found: string[] = [];
  const push = (raw: string) => {
    const e = normalize(raw);
    if (isPlausibleEmail(e) && !found.includes(e)) found.push(e);
  };

  // 1. mailto: links (decode entities first, e.g. mailto:info&#64;x.si).
  for (const m of decodeEntities(html).matchAll(/mailto:([^"'?>\s]+@[^"'?>\s]+)/gi)) push(m[1]);

  // 2. Cloudflare email protection: <a class="__cf_email__" data-cfemail="HEX"> and
  //    the inline #cf-email-data form data-cfemail="HEX".
  for (const m of html.matchAll(/data-cfemail=["']([0-9a-f]+)["']/gi)) {
    const decoded = decodeCfEmail(m[1]);
    if (decoded) push(decoded);
  }

  // 3. Entity-encoded and [at]/(dot)-obfuscated text.
  const cleaned = deobfuscate(decodeEntities(html));
  for (const m of cleaned.matchAll(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi)) push(m[0]);

  // Prefer a human/business inbox over no-reply/automated senders.
  return found.sort((a, b) => Number(isNoise(a)) - Number(isNoise(b)));
}

function isNoise(e: string): boolean {
  return /^(no-?reply|donotreply|postmaster|mailer-daemon|abuse|webmaster)@/i.test(e);
}

/** First, best plausible email from a page's HTML — or null. */
export function bestEmailFromHtml(html: string): string | null {
  return extractEmails(html)[0] ?? null;
}

// ── Contact-page crawl ──────────────────────────────────────────────────────
// Common contact-ish paths across Slovene / English / German SMB sites.
const CONTACT_PATHS = [
  "/kontakt",
  "/contact",
  "/kontakti",
  "/contact-us",
  "/o-nas",
  "/about",
  "/impressum",
  "/kontakt.html",
  "/contact.html",
];

const CONTACT_LINK_RE = /\b(kontakt|contact|impressum|o-nas|about|piši|pisi)\b/i;

async function fetchText(url: string, timeoutMs: number): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // safeFetch, not fetch. This is the more exposed of the two crawl paths: it
    // follows links found INSIDE a page we did not write, so the hostnames reach
    // it at two removes from anything we chose.
    const res = await safeFetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LeadQualifier/1.0)" },
    });
    if (!res.ok) return null;
    return (await res.text()).slice(0, 500_000);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Absolute contact-page URLs to try: links found on the homepage + common guesses. */
function contactCandidates(website: string, homepageHtml: string): string[] {
  let origin: string;
  try {
    origin = new URL(website).origin;
  } catch {
    return [];
  }
  const urls = new Set<string>();

  // Links on the homepage whose href or label looks like a contact page.
  for (const m of homepageHtml.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = m[1];
    const label = m[2].replace(/<[^>]+>/g, " ");
    if (CONTACT_LINK_RE.test(href) || CONTACT_LINK_RE.test(label)) {
      try {
        urls.add(new URL(href, origin).toString());
      } catch {
        /* skip unparseable href */
      }
    }
  }
  // Common guessed paths as a fallback.
  for (const p of CONTACT_PATHS) urls.add(origin + p);

  return [...urls].filter((u) => u.startsWith(origin)).slice(0, 4);
}

/**
 * Best-effort email discovery for a business's own site. Pass the already-fetched
 * homepage HTML (qualification fetches it anyway) to avoid a redundant request;
 * only when it yields nothing do we crawl a couple of likely contact pages.
 */
export async function discoverEmail(
  website: string,
  homepageHtml: string | null,
): Promise<string | null> {
  if (homepageHtml) {
    const onHome = bestEmailFromHtml(homepageHtml);
    if (onHome) return onHome;
  }

  const candidates = homepageHtml ? contactCandidates(website, homepageHtml) : [];
  for (const url of candidates) {
    const html = await fetchText(url, env.siteFetchTimeoutMs);
    if (!html) continue;
    const email = bestEmailFromHtml(html);
    if (email) return email;
  }
  return null;
}
