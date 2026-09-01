// Proof that an unsubscribe request came from a link WE put in an email, rather
// than from anyone who knows a lead id.
//
// Same reasoning as interestToken.ts — a lead id is not a secret, /examples
// publishes plenty of them — but the opposite lifetime. An interest token is
// minted per page-serve and expires in twelve hours; an unsubscribe link sits in
// an email forever and must still work the day someone finally gets round to
// clicking it. A link that has quietly expired is worse than no link: the
// prospect asked to be left alone, believes they have been, and the next
// follow-up goes out anyway.
//
// So: no expiry in the payload, and the token is a pure function of the lead id.
// Rotating AUTH_SECRET invalidates every outstanding link, which is a real cost
// of rotating it and is noted in .env.example.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

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

/** Token for this lead's unsubscribe link. Null when AUTH_SECRET is unset. */
export function issueUnsubscribeToken(leadId: string): string | null {
  const key = secret();
  if (!key) return null;
  return sign(`unsub.v1.${leadId}`, key);
}

/**
 * Whether this token authorises unsubscribing `leadId`.
 *
 * Fails CLOSED when AUTH_SECRET is unset, unlike verifyInterestToken which fails
 * open. The asymmetry is deliberate: the worst case there is a button that does
 * nothing in local development, and the worst case here is an unauthenticated
 * endpoint that lets a stranger mark every lead in the funnel unsubscribed and
 * silently end all outreach. A production server always has the secret — the
 * console refuses to serve without one — so this only ever bites in development,
 * where there is no real prospect to protect.
 */
export function verifyUnsubscribeToken(leadId: string, token: string | undefined | null): boolean {
  const key = secret();
  if (!key || !token) return false;
  return safeEqual(token, sign(`unsub.v1.${leadId}`, key));
}

/** The absolute URL that goes in the email and its List-Unsubscribe header. */
export function unsubscribeUrl(leadId: string, baseUrl: string): string | null {
  const token = issueUnsubscribeToken(leadId);
  if (!token) return null;
  const u = new URL("/api/unsubscribe", baseUrl);
  u.searchParams.set("lead", leadId);
  u.searchParams.set("t", token);
  return u.toString();
}
