// Centralised, typed access to environment config. Server-side only — importing
// this from a client component would leak nothing (no NEXT_PUBLIC_ prefix), but
// keep it on the server regardless.
import "server-only";

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const env = {
  leadSource: (process.env.LEAD_SOURCE ?? "mock").toLowerCase(),
  googlePlacesApiKey: process.env.GOOGLE_PLACES_API_KEY ?? "",
  // BCP-47 language for Google Places responses (e.g. "sl"). Google defaults to
  // English when this is unset, which comes back as machine-translated review
  // text, English weekday names and English category labels — all of which then
  // land verbatim on a non-English generated site. Set it to the market you
  // actually sell into. Empty = Google's default.
  googlePlacesLanguage: (process.env.GOOGLE_PLACES_LANGUAGE ?? "").trim(),

  // Claude — used to draft outreach in the business's own language. Optional:
  // when the key is absent, outreach falls back to the deterministic template.
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  anthropicModel: process.env.ANTHROPIC_MODEL ?? "claude-opus-5",
  // Preview engine: "ai" (Claude designs a bespoke site per business) | "template"
  // (the free deterministic template). Empty → "ai" when a key is set, else "template".
  previewEngine: (process.env.PREVIEW_ENGINE ?? "").toLowerCase(),

  // Public base URL used to build the shareable preview link dropped into outreach
  // (e.g. https://your-app.example.com/p/<leadId>). Defaults to local dev.
  appBaseUrl: (process.env.APP_BASE_URL ?? "http://localhost:3000").replace(/\/+$/, ""),

  // Owner identity surfaced on the public preview's "owner bar" CTA, so a prospect
  // who likes the demo can reach you directly. All optional — the bar still records
  // interest without them; provide at least one to give the prospect a way to reply.
  ownerName: process.env.OUTREACH_OWNER_NAME ?? "",
  ownerEmail: process.env.OUTREACH_OWNER_EMAIL ?? "",
  ownerPhone: process.env.OUTREACH_OWNER_PHONE ?? "",
  ownerBookingUrl: process.env.OUTREACH_OWNER_BOOKING_URL ?? "",
  // Set OWNER_BAR="off" to serve the public preview without the CTA bar.
  ownerBar: (process.env.OWNER_BAR ?? "on").toLowerCase() !== "off",

  // Follow-up cadence. A queued follow-up becomes "due" this many days after the
  // previous message in the sequence was sent (and only if the prospect hasn't
  // replied / shown interest / converted). Used by the follow-up due queue.
  followupIntervalDays: num(process.env.FOLLOWUP_INTERVAL_DAYS, 3),

  // Hands-off delivery of DUE follow-ups by email (initial sends stay manual).
  // Requires SMTP below; DM/phone follow-ups always stay in the manual queue.
  autoSendFollowups: (process.env.AUTO_SEND_FOLLOWUPS ?? "off").toLowerCase() === "on",
  autoSendIntervalMin: num(process.env.AUTO_SEND_INTERVAL_MIN, 60),

  // SMTP — optional outbound email so a draft can be SENT from the app (with the
  // preview image attached) instead of copy-pasting into Gmail. When SMTP_HOST is
  // empty the send path degrades to "mark sent" + a Gmail compose deep-link. For
  // Gmail: host smtp.gmail.com, port 465, secure, an App Password as SMTP_PASS.
  smtpHost: process.env.SMTP_HOST ?? "",
  smtpPort: num(process.env.SMTP_PORT, 465),
  smtpUser: process.env.SMTP_USER ?? "",
  smtpPass: process.env.SMTP_PASS ?? "",
  // Defaults to SMTP_USER when unset. "Name <addr>" is allowed.
  smtpFrom: process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "",
  smtpSecure: (process.env.SMTP_SECURE ?? "on").toLowerCase() !== "off",

  // What one customer pays per month (the €50 in the pitch) — used by the
  // unit-economics dashboard to turn active subscriptions into MRR/profit.
  monthlyPriceEur: num(process.env.MONTHLY_PRICE_EUR, 50),

  // Cost safety stops (see .env.example for the cost-model rationale).
  maxDetailsPerDay: num(process.env.MAX_DETAILS_PER_DAY, 200),
  maxSearchPerDay: num(process.env.MAX_SEARCH_PER_DAY, 100),
  // Place Photos is a separate billable SKU, fetched lazily at preview time.
  maxPhotosPerDay: num(process.env.MAX_PHOTOS_PER_DAY, 100),
  // How many of a business's photos to pull into one preview (hero + gallery).
  previewPhotoCount: num(process.env.PREVIEW_PHOTO_COUNT, 4),
  // Static Maps is its own billable SKU; like photos it's fetched lazily at preview
  // time, inlined as a data URI (so no API key leaks into deployed HTML), and cached.
  // Set PREVIEW_MAP=off to disable rendering a location map entirely.
  previewMap: (process.env.PREVIEW_MAP ?? "on").toLowerCase() !== "off",
  maxStaticMapsPerDay: num(process.env.MAX_STATIC_MAPS_PER_DAY, 100),

  // Monthly free-tier guards. The Google free allowance is MONTHLY (per SKU), so
  // these — not the daily caps — are what actually keep spend at $0. Defaults sit
  // just under the current free caps (Place Details Enterprise 1,000/mo,
  // Text Search Pro 5,000/mo) with a safety margin. Discovery stops calling a SKU
  // for the rest of the calendar month (UTC) once its guard is reached.
  maxDetailsPerMonth: num(process.env.MAX_DETAILS_PER_MONTH, 950),
  maxSearchPerMonth: num(process.env.MAX_SEARCH_PER_MONTH, 4800),
  maxPhotosPerMonth: num(process.env.MAX_PHOTOS_PER_MONTH, 4800),
  // Static Maps free tier is ~10k/mo; keep a safety margin like the others.
  maxStaticMapsPerMonth: num(process.env.MAX_STATIC_MAPS_PER_MONTH, 9000),

  // Free-tier estimates — display only, NOT authoritative. See:
  // https://mapsplatform.google.com/pricing/
  freeTierTextSearchPerMonth: num(process.env.FREE_TIER_TEXT_SEARCH_PER_MONTH, 5000),
  freeTierPlaceDetailsPerMonth: num(process.env.FREE_TIER_PLACE_DETAILS_PER_MONTH, 1000),
  freeTierPlacePhotosPerMonth: num(process.env.FREE_TIER_PLACE_PHOTOS_PER_MONTH, 5000),
  freeTierStaticMapsPerMonth: num(process.env.FREE_TIER_STATIC_MAPS_PER_MONTH, 10000),

  siteFetchTimeoutMs: num(process.env.SITE_FETCH_TIMEOUT_MS, 6000),

  deployTarget: (process.env.DEPLOY_TARGET ?? "vercel").toLowerCase(),

  // Stripe billing — turns an "interested" lead into a paying customer via a hosted
  // Checkout link. All optional: without a secret key the payment-link action is off
  // and the rest of the app is unaffected. priceId = your recurring €50/mo Price;
  // buyoutPriceId = an optional one-time buyout Price. webhookSecret verifies the
  // billing webhook so we can mark a lead paid hands-off.
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripePriceId: process.env.STRIPE_PRICE_ID ?? "",
  stripeBuyoutPriceId: process.env.STRIPE_BUYOUT_PRICE_ID ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
} as const;

export type Env = typeof env;
