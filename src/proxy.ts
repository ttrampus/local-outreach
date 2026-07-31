// Gate for the whole app. Everything is private unless it appears below —
// prospects and search engines see the marketing site and their own preview,
// the operator sees the rest after logging in.
//
// Next 16 renamed the `middleware` convention to `proxy`. It runs on the Node.js
// runtime by default, so node:crypto works here directly; setting
// `export const runtime` in this file would throw.
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";

/** Public in full, matched exactly. */
const PUBLIC_PATHS = new Set([
  "/",
  "/examples",
  "/login",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
  // Stripe signs its own requests and cannot carry our cookie. The route verifies
  // the signature itself, which is the real authentication here.
  "/api/stripe/webhook",
]);

/** Public including everything beneath them. */
const PUBLIC_PREFIXES = [
  "/p/", // a prospect's shareable preview — the whole point of outreach
  "/api/p/", // its "I'm interested" button
  "/api/site/", // contact forms embedded in generated sites
  "/pay/", // Stripe Checkout return pages
  "/previews/", // preview screenshots under public/
  "/api/auth/", // login and logout themselves
  "/_next/", // build assets
];

/**
 * Static files in public/ that a public page may reference. The matcher below
 * only excludes _next/static and _next/image, so without this a logged-out
 * visitor would get a redirect instead of an SVG.
 */
const STATIC_FILE = /\.(svg|png|jpg|jpeg|gif|webp|ico|txt|xml|woff2?)$/i;

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (STATIC_FILE.test(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  // Fail closed. A missing secret means sessions cannot be verified, so serving
  // the console would mean serving it to everyone — better a loud 503.
  if (!process.env.AUTH_SECRET) {
    return new NextResponse("Auth is not configured on this server.", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  if (verifySession(req.cookies.get(SESSION_COOKIE)?.value)) {
    return NextResponse.next();
  }

  // API callers get JSON. The console's fetch() calls would otherwise receive an
  // HTML login page and die inside res.json() with a parse error that says
  // nothing about the real problem.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const login = new URL("/login", req.url);
  login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  // Only build assets are skipped here; everything else is decided in isPublic()
  // above, so there is one allowlist to read rather than two that must agree.
  matcher: ["/((?!_next/static|_next/image).*)"],
};
