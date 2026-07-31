// Single-operator auth. There is one person using the console, so there is one
// shared password and no user table — a signed cookie is the whole mechanism.
//
// Deliberately dependency-free and reading process.env directly rather than
// @/lib/env: this module is imported by src/proxy.ts, and @/lib/env carries
// `import "server-only"`.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/** 30 days. Long-lived on purpose — it is one operator on their own machines. */
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export const SESSION_COOKIE = "outreach_session";

/** Cookie attributes shared by the login and logout routes. */
export const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  // `lax` rather than `strict` so returning from Stripe Checkout to /pay/success
  // still arrives with the session attached.
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE_MS / 1000,
} as const;

function secret(): string | null {
  const s = process.env.AUTH_SECRET;
  return s && s.length > 0 ? s : null;
}

function sign(base: string, key: string): string {
  return createHmac("sha256", key).update(base).digest("base64url");
}

/** Constant-time compare of two strings via their digests, so length never leaks. */
function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/**
 * Mint a cookie value: `v1.<expiryMs>.<hmac>`. The expiry is inside the signed
 * payload, so a client cannot extend its own session by editing the cookie —
 * the browser's own maxAge is only a convenience.
 */
export function issueSession(): string | null {
  const key = secret();
  if (!key) return null;
  const base = `v1.${Date.now() + MAX_AGE_MS}`;
  return `${base}.${sign(base, key)}`;
}

export function verifySession(value: string | undefined | null): boolean {
  const key = secret();
  if (!key || !value) return false;

  const parts = value.split(".");
  if (parts.length !== 3) return false;
  const [version, expiry, mac] = parts;
  if (version !== "v1") return false;

  const expiresAt = Number(expiry);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false;

  return safeEqual(mac, sign(`${version}.${expiry}`, key));
}

/** True when the submitted password matches AUTH_PASSWORD. False if unconfigured. */
export function checkPassword(input: string): boolean {
  const expected = process.env.AUTH_PASSWORD;
  if (!expected || expected.length === 0) return false;
  return safeEqual(input, expected);
}

/** Whether auth is configured at all. Callers must fail closed when this is false. */
export function authConfigured(): boolean {
  return secret() !== null && Boolean(process.env.AUTH_PASSWORD);
}
