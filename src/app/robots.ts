import type { MetadataRoute } from "next";

// The console is password-gated, but there is no reason for it to appear in
// search results at all — and /p/<leadId> previews are personal to one business,
// not pages we want indexed against their name.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/app", "/app/", "/login", "/p/", "/pay/"],
    },
  };
}
