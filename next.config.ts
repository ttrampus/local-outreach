import type { NextConfig } from "next";

/**
 * Baseline headers for every response. Deliberately the boring, universally-safe
 * set: the two documents on this origin that need a real policy (the generated
 * previews served by the /p/ and preview-html routes) set their own CSP sandbox
 * in the route handler, because what they need is far stricter than anything
 * that could be applied app-wide without breaking Next's own inline bootstrap.
 *
 * HSTS is included unconditionally rather than gated on NODE_ENV: it is only ever
 * honoured over HTTPS, so it is inert in local development and cannot lock anyone
 * out of http://localhost.
 */
const SECURITY_HEADERS = [
  // Stop a stored preview or an uploaded asset being re-interpreted as a script
  // because a browser liked the look of its bytes better than our content-type.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Prospect preview URLs contain a lead id. Sending the full path to whatever a
  // generated site links out to would hand third parties our funnel.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The console iframes its own previews, so 'self' rather than DENY.
  //
  // Deliberately X-Frame-Options and NOT a `frame-ancestors` CSP: a header set
  // here REPLACES a same-named header set by a route handler, and the generated
  // previews depend on setting their own far stricter Content-Security-Policy.
  // Putting a permissive CSP in this list silently disarmed their sandbox — the
  // response still carried a CSP, so it looked configured. X-Frame-Options is
  // honoured by every current browser and cannot collide with theirs.
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
