// Centralised, typed access to environment config. Server-side only — importing
// this from a client component would leak nothing (no NEXT_PUBLIC_ prefix), but
// keep it on the server regardless.
import "server-only";
import { PRICING } from "./pricing";

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

  // Where the manual-design panel's "open Claude" button points. Defaults to a new
  // chat; point it at your own Project (or a standing conversation) so you land
  // somewhere that already holds the system prompt. Personal to each operator —
  // hence config, not a constant.
  manualChatUrl: process.env.MANUAL_CHAT_URL || "https://claude.ai/new",

  // Public base URL used to build the shareable preview link dropped into outreach
  // (e.g. https://your-app.example.com/p/<leadId>). Defaults to local dev.
  appBaseUrl: (process.env.APP_BASE_URL ?? "http://localhost:3000").replace(/\/+$/, ""),

  // Console auth. One operator, one shared password, no user table. Both must be
  // set or the app refuses to serve anything private — see src/proxy.ts. Read
  // directly from process.env in src/lib/auth/session.ts, since that module is
  // imported by the proxy and this file is "server-only"; mirrored here so the
  // console can tell you what is missing.
  authPassword: process.env.AUTH_PASSWORD ?? "",
  authSecret: process.env.AUTH_SECRET ?? "",

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

  // Twilio — optional outbound SMS, the second channel that can be delivered with
  // one click. When configured, a lead with a phone number but no email is drafted
  // as an SMS and sent for real; without it that draft degrades to an `sms:` deep
  // link the operator finishes in their own messaging app. Either TWILIO_FROM (a
  // single sender number) or TWILIO_MESSAGING_SERVICE_SID is required.
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID ?? "",
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN ?? "",
  twilioFrom: process.env.TWILIO_FROM ?? "",
  twilioMessagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID ?? "",
  // Dialing code prepended to national-format numbers (Google Places returns
  // plenty of them) so they can be normalized to E.164. e.g. "+386".
  smsDefaultCountryCode: (process.env.SMS_DEFAULT_COUNTRY_CODE ?? "").trim(),

  // What one customer on a care plan pays per month — used by the unit-economics
  // dashboard to turn active subscriptions into MRR/profit. Defaults to the care
  // plan's published price so the dashboard and the sales page agree; override
  // only if what customers actually pay has drifted from the current list price.
  monthlyPriceEur: num(process.env.MONTHLY_PRICE_EUR, PRICING.careMonthlyEur),

  // Cost safety stops (see .env.example for the cost-model rationale).
  maxDetailsPerDay: num(process.env.MAX_DETAILS_PER_DAY, 200),
  maxSearchPerDay: num(process.env.MAX_SEARCH_PER_DAY, 100),
  // Place Photos is a separate billable SKU, fetched lazily at preview time.
  maxPhotosPerDay: num(process.env.MAX_PHOTOS_PER_DAY, 100),
  // How many of a business's photos to pull into one preview (hero + gallery).
  previewPhotoCount: num(process.env.PREVIEW_PHOTO_COUNT, 4),
  // Long-edge cap, in pixels, for the WebP copy of each photo that gets inlined
  // into the generated page. Originals are archived at Google's full size; this
  // only bounds what ships. 2000 is ~2.2x the old resolution at roughly the old
  // byte cost, because WebP replaces JPEG. Raising it makes pages heavier fast —
  // they are inlined as base64, and a prospect may open the link on mobile data.
  previewPhotoMaxPx: num(process.env.PREVIEW_PHOTO_MAX_PX, 2000),
  // How many previews may be built at once. One is the right answer on a small
  // box: each build holds a Claude stream open for minutes and then launches a
  // headless Chromium, so concurrency buys nothing and costs memory. Raise only
  // if the machine has RAM to spare.
  previewConcurrency: num(process.env.PREVIEW_CONCURRENCY, 1),
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
  // One Price per plan in @/lib/pricing. The legacy STRIPE_PRICE_ID /
  // STRIPE_BUYOUT_PRICE_ID names are still honoured so an existing deployment
  // keeps working: back then "the price" meant the monthly subscription and
  // "buyout" meant paying once instead of subscribing. Under the current model
  // the one-time build is the normal first charge, not an alternative to it.
  stripeBuildPriceId: process.env.STRIPE_BUILD_PRICE_ID || process.env.STRIPE_BUYOUT_PRICE_ID || "",
  stripeCarePriceId: process.env.STRIPE_CARE_PRICE_ID || process.env.STRIPE_PRICE_ID || "",
  stripeGrowthPriceId: process.env.STRIPE_GROWTH_PRICE_ID ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
} as const;

export type Env = typeof env;
