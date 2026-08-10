// Proof that an "I'm interested" POST came from a preview WE served, rather than
// from anyone who knows a lead id.
//
// The id is not a secret: /examples links to /p/<leadId> for every showcased lead,
// so the ids of exactly the previews we are proudest of are published in plaintext.
// Without this, a passing visitor could POST /api/p/<id>/interest for each of them
// and mark real prospects as having raised their hand. Nothing would error — the
// funnel that decides where discovery spend goes would just quietly stop meaning
// anything, which is the failure mode this whole endpoint was added to measure.
//
// A token minted per page-serve rather than baked into the outreach link, so the
// /p/<leadId> URLs already sitting in sent emails keep working unchanged.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/** Long enough to read the page and think about it; short enough to not be a key. */
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

function secret(): string | null {
  const s = process.env.AUTH_SECRET;
  return s && s.length > 0 ? s : null;
}

function sign(base: string, key: string): string {
  return createHmac("sha256", key).update(base).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/**
 * Mint a token for this lead. Null when AUTH_SECRET is unset — see
 * verifyInterestToken for what that means.
 */
export function issueInterestToken(leadId: string): string | null {
  const key = secret();
  if (!key) return null;
  const base = `v1.${leadId}.${Date.now() + MAX_AGE_MS}`;
  return `${base}.${sign(base, key)}`;
}

/**
 * Whether this token authorises recording interest in `leadId`.
 *
 * Deliberately open when AUTH_SECRET is unset, unlike the console guards which
 * fail closed. /p/ is a public page that must work for a prospect regardless of
 * how the server is configured, and the console already refuses to serve at all
 * without a secret (src/proxy.ts) — so an unconfigured server has no console to
 * protect, and the only effect of failing closed here would be silently breaking
 * the button in local development.
 */
export function verifyInterestToken(leadId: string, token: string | undefined | null): boolean {
  const key = secret();
  if (!key) return true;
  if (!token) return false;

  // Split from the right: a cuid contains no dots today, but the token stays
  // valid if that ever changes.
  const parts = token.split(".");
  if (parts.length < 4) return false;
  const mac = parts[parts.length - 1];
  const expiry = parts[parts.length - 2];
  const version = parts[0];
  const id = parts.slice(1, -2).join(".");

  if (version !== "v1") return false;
  if (id !== leadId) return false;

  const expiresAt = Number(expiry);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false;

  return safeEqual(mac, sign(`${version}.${id}.${expiry}`, key));
}
