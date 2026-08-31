// Outbound fetches of URLs we did not choose.
//
// Two paths pull pages from the open internet: qualify.ts analyses a lead's
// existing website, and email/discover.ts crawls a few of that site's own links
// looking for a contact address. Neither URL is ours — the first comes from a
// business's Google listing, the second from the HTML of whatever that listing
// pointed at. Anyone who can edit a Google Business profile can therefore choose
// a hostname this server will connect to, which is the definition of SSRF.
//
// What that buys an attacker here is not a stolen database — the response body
// only ever becomes weakness signals and a scraped email — but it is enough to
// reach things the internet cannot: the cloud metadata endpoint on 169.254.169.254,
// anything bound to loopback, and the rest of the private range. The scraped-email
// path also means a little of what comes back can surface in an outreach draft.
//
// So: resolve the host first, refuse anything that is not a public unicast
// address, and re-check on every redirect hop rather than trusting the first one.
// `redirect: "follow"` is the usual way this control gets bypassed — a perfectly
// respectable domain answers 302 and points at 127.0.0.1 — so redirects are
// followed by hand here.
//
// Residual risk, stated rather than hidden: a name that passes the check and then
// resolves differently when the socket is opened (DNS rebinding) would slip
// through, because Node's fetch gives no supported way to pin the connection to
// the address we validated. Closing that needs a custom undici dispatcher; it is
// not worth the moving parts against this threat model, where the attacker must
// first own a business listing we happen to discover.
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/** Redirect hops we will follow before giving up. Generous enough for the
 *  http→https→www chains real sites use, short enough to bound the work. */
const MAX_REDIRECTS = 5;

/**
 * Whether an address is one the public internet could have routed us to anyway.
 * Everything else — loopback, link-local (which is where cloud metadata lives),
 * the RFC1918 ranges, CGNAT, multicast, reserved space — is refused.
 */
export function isPublicAddress(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const p = ip.split(".").map(Number);
    if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
    const [a, b] = p as [number, number, number, number];
    if (a === 0 || a === 10 || a === 127) return false; // this-network, private, loopback
    if (a === 169 && b === 254) return false; // link-local — cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return false; // private
    if (a === 192 && b === 168) return false; // private
    if (a === 100 && b >= 64 && b <= 127) return false; // CGNAT
    if (a === 192 && b === 0) return false; // IETF protocol assignments / test
    if (a === 198 && (b === 18 || b === 19)) return false; // benchmarking
    if (a >= 224) return false; // multicast and reserved
    return true;
  }
  if (v === 6) {
    const ip6 = ip.toLowerCase().split("%")[0]!;
    if (ip6 === "::" || ip6 === "::1") return false; // unspecified, loopback
    // ::ffff:x.x.x.x — an IPv4 address wearing a v6 coat. Judge the v4 inside it,
    // or a mapped 127.0.0.1 would sail straight past the checks above.
    const mapped = ip6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPublicAddress(mapped[1]!);
    if (/^f[cd]/.test(ip6)) return false; // unique-local
    if (/^fe[89ab]/.test(ip6)) return false; // link-local
    if (/^ff/.test(ip6)) return false; // multicast
    return true;
  }
  return false;
}

/** Reject anything that isn't a plain http(s) URL pointing at a public host. */
async function assertPublicUrl(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`refusing ${url.protocol} URL`);
  }

  // A literal address skips DNS entirely — check it directly, brackets stripped.
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) {
    if (!isPublicAddress(host)) throw new Error(`refusing non-public address ${host}`);
    return;
  }

  // `all: true` matters: a name that answers with both a public and a private
  // address must be refused, not accepted because the first record looked fine.
  const addrs = await lookup(host, { all: true, verbatim: true });
  if (addrs.length === 0) throw new Error(`no address for ${host}`);
  for (const { address } of addrs) {
    if (!isPublicAddress(address)) throw new Error(`refusing non-public address ${address}`);
  }
}

/**
 * fetch(), restricted to public hosts, with redirects followed by hand so every
 * hop is checked. Drop-in for the two crawl paths: same signature, same thrown
 * errors on network failure, and `res.url` is the address we actually landed on
 * (callers judge https-ness from it).
 */
export async function safeFetch(input: string, init: RequestInit = {}): Promise<Response> {
  let url = new URL(input);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicUrl(url);

    const res = await fetch(url, { ...init, redirect: "manual" });

    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      url = new URL(location, url); // relative Location headers are legal
      continue;
    }

    // fetch() sets res.url to the request URL when redirects aren't followed for
    // it; make it the URL we actually ended on, which is what callers read.
    return Object.defineProperty(res, "url", { value: url.toString(), configurable: true });
  }

  throw new Error("too many redirects");
}
