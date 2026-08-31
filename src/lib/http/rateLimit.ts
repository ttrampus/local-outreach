// A counter per caller, for the endpoints anyone on the internet can reach.
//
// Three routes are public by design — the contact form on a generated site, the
// "I'm interested" button, and login. Login has had its own throttle since the
// console was first exposed; the other two had none, and the contact form is the
// expensive one: every accepted POST writes a row AND sends mail through the
// operator's own Google Workspace account. Left open, a loop against it fills a
// 40GB disk and pushes that account past Google's sending limits until they
// throttle or suspend it — which would take the entire outreach channel down with
// it. The mailbox is the business; it gets a budget.
//
// In-memory and per-process, exactly like loginThrottle.ts, and for the same
// reasons: one operator, one small box, no Redis to run and no table to prune.
// It resets on deploy, which is a real and accepted weakness at this size.
type Entry = { hits: number; resetAt: number };

/** Stop the map growing without bound when someone sprays from many addresses. */
const MAX_TRACKED = 10_000;

const buckets = new Map<string, Map<string, Entry>>();

export interface RateLimitResult {
  ok: boolean;
  /** Seconds until the caller may try again. 0 when ok. */
  retryAfter: number;
}

/**
 * Count one hit against `key` in `name`, and say whether it is allowed.
 *
 * The window does NOT re-arm on a blocked hit, unlike the login throttle: there,
 * continued guessing is itself evidence of an attack and deserves to extend the
 * lockout; here a caller hammering a contact form is usually a broken retry loop,
 * and a window that never expires would keep a legitimate visitor out for good.
 */
export function rateLimit(
  name: string,
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  let bucket = buckets.get(name);
  if (!bucket) {
    bucket = new Map();
    buckets.set(name, bucket);
  }

  for (const [k, e] of bucket) if (e.resetAt <= now) bucket.delete(k);

  const entry = bucket.get(key);
  if (!entry || entry.resetAt <= now) {
    if (bucket.size >= MAX_TRACKED) return { ok: true, retryAfter: 0 };
    bucket.set(key, { hits: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }

  entry.hits += 1;
  if (entry.hits > limit) {
    return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfter: 0 };
}
