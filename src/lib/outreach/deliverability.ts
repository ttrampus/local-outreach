// Whether cold email from this domain will be BELIEVED — which is a different
// question from whether it sends, and the one that decides if a stranger ever
// reads it.
//
// A message that leaves your SMTP server successfully can still be binned before
// a human sees it. Receivers decide that from DNS records published on the
// sending domain, not from anything in the message:
//
//   SPF   — "these servers may send as @mydomain.com". Missing, and mail from an
//           unfamiliar domain is treated as unauthenticated.
//   DKIM  — a signature proving the message wasn't altered and really came from
//           you. Published as a public key under <selector>._domainkey.
//   DMARC — what a receiver should DO when SPF/DKIM fail, and where to report it.
//           Gmail and Yahoo have required it from bulk senders since Feb 2024.
//   MX    — where replies come back to. A sending domain with no MX collects no
//           answers, which for outreach is the whole point.
//
// None of this can be inferred locally; it's a DNS lookup against the public
// record, so this module is only ever called from the self-test preflight.
//
// These checks are advisory and cannot be exhaustive: a passing SPF record can
// still omit your provider, and DKIM is only detectable by guessing the selector
// your provider chose. What they reliably catch is the common case — a domain
// with nothing published at all.
import "server-only";
import { Resolver } from "node:dns/promises";

/** One published-record finding. `ok:false` with `fatal:false` = worth fixing, not broken. */
export interface Finding {
  ok: boolean;
  /** Set when the check couldn't reach a verdict (rather than finding a problem). */
  unknown?: boolean;
  detail: string;
}

export interface DeliverabilityReport {
  domain: string;
  spf: Finding;
  dkim: Finding;
  dmarc: Finding;
  mx: Finding;
  alignment: Finding | null; // null when there's no authenticating user to compare
}

/**
 * DKIM keys live at "<selector>._domainkey.<domain>", and the selector is chosen
 * by the mail provider — there is no way to enumerate it. These are the defaults
 * of the providers a one-person shop is likely to use; a domain using something
 * else needs DKIM_SELECTOR set, which is why "not found" is reported as unknown
 * rather than as a failure.
 */
const KNOWN_SELECTORS = [
  "google", // Google Workspace
  "selector1", "selector2", // Microsoft 365
  "zoho", "zmail", // Zoho Mail
  "fm1", "fm2", "fm3", // Fastmail
  "protonmail", "protonmail2", // Proton
  "s1", "s2", // SendGrid
  "k1", "k2", // Mailchimp / Mandrill
  "resend", // Resend
  "mail", "dkim", "default", // common self-hosted / cPanel defaults
];

/** The domain part of "Name <you@example.com>" or "you@example.com". */
export function domainOf(address: string): string {
  const match = address.match(/<([^>]+)>/);
  const bare = (match ? match[1] : address).trim();
  return bare.split("@").pop()?.toLowerCase() ?? "";
}

/** Short-timeout resolver: a slow or missing record must not stall the preflight. */
function resolver(): Resolver {
  return new Resolver({ timeout: 4000, tries: 2 });
}

/**
 * A resolver pointed at the domain's OWN nameservers, so results are what the zone
 * currently publishes rather than what a cache remembers.
 *
 * This matters specifically because of when people run this check: right after
 * adding a record. The failed lookup a minute earlier is cached as "no such name"
 * for as long as the zone's negative TTL says — often an hour — so a correctly
 * added record keeps reporting as missing, and the obvious conclusion is that the
 * record is wrong. Asking the authoritative servers skips that entirely.
 *
 * Falls back to the system resolver when the nameservers can't be found.
 */
async function authoritative(domain: string): Promise<Resolver> {
  const fallback = resolver();
  try {
    const nameservers = await fallback.resolveNs(domain);
    const addresses = (
      await Promise.all(nameservers.map((ns) => fallback.resolve4(ns).catch(() => [])))
    ).flat();
    if (addresses.length === 0) return fallback;
    const direct = resolver();
    direct.setServers(addresses);
    return direct;
  } catch {
    return fallback; // no NS delegation visible (unregistered domain, or a subdomain)
  }
}

/** TXT records for a name, each joined from the chunks DNS splits them into. */
async function txt(dns: Resolver, name: string): Promise<string[]> {
  try {
    return (await dns.resolveTxt(name)).map((chunks) => chunks.join(""));
  } catch {
    return []; // NXDOMAIN / no records — indistinguishable, and treated the same
  }
}

async function checkSpf(dns: Resolver, domain: string): Promise<Finding> {
  const records = (await txt(dns, domain)).filter((r) => r.toLowerCase().startsWith("v=spf1"));
  if (records.length === 0) {
    return { ok: false, detail: "no SPF record — receivers can't tell who may send as you" };
  }
  // More than one is a hard error in the spec: receivers must treat it as permerror
  // and stop evaluating, so the domain ends up worse off than with no record.
  if (records.length > 1) {
    return { ok: false, detail: `${records.length} SPF records published — a domain may have exactly one` };
  }
  const record = records[0];
  if (/[+]all\b/.test(record)) {
    return { ok: false, detail: `SPF ends in "+all", which authorises the entire internet: ${record}` };
  }
  const qualifier = /-all\b/.test(record) ? "-all (strict)" : /~all\b/.test(record) ? "~all (softfail)" : "no all-qualifier";
  return { ok: true, detail: `${qualifier} — ${record.slice(0, 90)}` };
}

async function checkDkim(dns: Resolver, domain: string, explicitSelector?: string): Promise<Finding> {
  const selectors = explicitSelector ? [explicitSelector] : KNOWN_SELECTORS;
  for (const selector of selectors) {
    const records = await txt(dns, `${selector}._domainkey.${domain}`);
    if (records.some((r) => r.toLowerCase().includes("p="))) {
      return { ok: true, detail: `key published at "${selector}._domainkey"` };
    }
  }
  if (explicitSelector) {
    return { ok: false, detail: `nothing published at "${explicitSelector}._domainkey.${domain}"` };
  }
  return {
    ok: false,
    unknown: true,
    detail: `no key at ${selectors.length} common selectors — if your provider uses its own, set DKIM_SELECTOR to check it`,
  };
}

async function checkDmarc(dns: Resolver, domain: string): Promise<Finding> {
  const record = (await txt(dns, `_dmarc.${domain}`)).find((r) => r.toLowerCase().startsWith("v=dmarc1"));
  if (!record) {
    return { ok: false, detail: "no DMARC record — required by Gmail and Yahoo for bulk senders" };
  }
  const policy = record.match(/\bp\s*=\s*(none|quarantine|reject)/i)?.[1]?.toLowerCase() ?? "unset";
  if (policy === "unset") return { ok: false, detail: `DMARC record has no p= policy: ${record.slice(0, 80)}` };
  const note = policy === "none" ? "monitor only — fine to start with" : `enforcing (p=${policy})`;
  return { ok: true, detail: `p=${policy}, ${note}` };
}

async function checkMx(dns: Resolver, domain: string): Promise<Finding> {
  try {
    const records = await dns.resolveMx(domain);
    if (records.length === 0) return { ok: false, detail: "no MX record — replies to this domain would bounce" };
    // A "null MX" (a single record pointing at ".") is the domain stating outright
    // that it accepts no mail. Published, but worse than absent for a reply-to.
    if (records.length === 1 && (records[0].exchange === "." || records[0].exchange === "")) {
      return { ok: false, detail: "null MX — this domain declares that it accepts no mail at all" };
    }
    const best = records.sort((a, b) => a.priority - b.priority)[0];
    return { ok: true, detail: `mail accepted by ${best.exchange}` };
  } catch {
    return { ok: false, detail: "no MX record — replies to this domain would bounce" };
  }
}

/**
 * SPF and DKIM only help if they cover the address in the From header. Sending as
 * one domain while authenticating as another is the classic setup that passes
 * every credential check and still fails DMARC at the receiver.
 */
function checkAlignment(fromDomain: string, authAddress: string): Finding {
  const authDomain = domainOf(authAddress);
  if (!authDomain) return { ok: true, unknown: true, detail: "no authenticating address to compare" };
  if (authDomain === fromDomain) return { ok: true, detail: `From and SMTP login are both @${fromDomain}` };
  return {
    ok: false,
    detail: `sending as @${fromDomain} but logging in as @${authDomain} — the From domain is the one that must be authorised`,
  };
}

/**
 * Look up everything a receiver would check about `fromAddress`'s domain.
 * `authAddress` is the SMTP login, compared for alignment when given.
 */
export async function checkDeliverability(
  fromAddress: string,
  authAddress?: string,
  dkimSelector?: string,
): Promise<DeliverabilityReport> {
  const domain = domainOf(fromAddress);
  const dns = await authoritative(domain);
  const [spf, dkim, dmarc, mx] = await Promise.all([
    checkSpf(dns, domain),
    checkDkim(dns, domain, dkimSelector),
    checkDmarc(dns, domain),
    checkMx(dns, domain),
  ]);
  return {
    domain,
    spf,
    dkim,
    dmarc,
    mx,
    alignment: authAddress ? checkAlignment(domain, authAddress) : null,
  };
}
