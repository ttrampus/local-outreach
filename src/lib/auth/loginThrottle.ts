// Per-IP throttle on failed logins.
//
// The login route already sleeps a second on every failure, but a sleep only
// slows down a caller that waits: nothing stops an attacker opening two hundred
// connections at once, and against a single shared password that is the whole
// game. This caps how many wrong guesses one source can make in a window,
// regardless of how it paces them.
//
// In-memory on purpose. This is one operator on one small box, and a counter in
// the process needs no Redis, no table and no cleanup job. It resets on deploy,
// which is a real (small) weakness and the right trade at this size.
//
// Deliberately per-IP and NOT global: a global counter would let anyone lock the
// operator out of their own console by failing a few logins, turning a brute
// force defence into the attack. An attacker rotating IPs (or forging
// X-Forwarded-For, if whatever fronts this app does not overwrite it) can still
// spread guesses out — this raises the cost, it does not end the problem. The
// password still has to be a strong one.

/** Wrong guesses allowed from one address before it is refused. */
const MAX_FAILURES = 10;

/** How long a failing address stays counted, and how long a blocked one waits. */
const WINDOW_MS = 15 * 60 * 1000;

/** Stop the map growing without bound if someone sprays from many addresses. */
const MAX_TRACKED = 10_000;

type Entry = { failures: number; resetAt: number };

const attempts = new Map<string, Entry>();

function prune(now: number): void {
  for (const [key, entry] of attempts) {
    if (entry.resetAt <= now) attempts.delete(key);
  }
}

/**
 * Best-effort client address. Behind a reverse proxy the socket address is the
 * proxy's, so the forwarded header is all there is — it is trusted only as a
 * bucket key for rate limiting, never for authorisation.
 */
export function clientKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Seconds the caller must wait, or 0 when they may attempt a login now.
 */
export function retryAfter(key: string): number {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt <= now) return 0;
  if (entry.failures < MAX_FAILURES) return 0;
  return Math.ceil((entry.resetAt - now) / 1000);
}

export function recordFailure(key: string): void {
  const now = Date.now();
  prune(now);

  const entry = attempts.get(key);
  if (!entry || entry.resetAt <= now) {
    if (attempts.size >= MAX_TRACKED) return;
    attempts.set(key, { failures: 1, resetAt: now + WINDOW_MS });
    return;
  }

  entry.failures += 1;
  // Each failure re-arms the window, so a slow drip cannot outlast it.
  entry.resetAt = now + WINDOW_MS;
}

/** A correct password clears the record — the operator is not the attacker. */
export function recordSuccess(key: string): void {
  attempts.delete(key);
}
