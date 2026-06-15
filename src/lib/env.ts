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

  // Cost safety stops (see .env.example for the cost-model rationale).
  maxDetailsPerDay: num(process.env.MAX_DETAILS_PER_DAY, 200),
  maxSearchPerDay: num(process.env.MAX_SEARCH_PER_DAY, 100),

  // Monthly free-tier guards. The Google free allowance is MONTHLY (per SKU), so
  // these — not the daily caps — are what actually keep spend at $0. Defaults sit
  // just under the current free caps (Place Details Enterprise 1,000/mo,
  // Text Search Pro 5,000/mo) with a safety margin. Discovery stops calling a SKU
  // for the rest of the calendar month (UTC) once its guard is reached.
  maxDetailsPerMonth: num(process.env.MAX_DETAILS_PER_MONTH, 950),
  maxSearchPerMonth: num(process.env.MAX_SEARCH_PER_MONTH, 4800),

  // Free-tier estimates — display only, NOT authoritative. See:
  // https://mapsplatform.google.com/pricing/
  freeTierTextSearchPerMonth: num(process.env.FREE_TIER_TEXT_SEARCH_PER_MONTH, 5000),
  freeTierPlaceDetailsPerMonth: num(process.env.FREE_TIER_PLACE_DETAILS_PER_MONTH, 1000),

  siteFetchTimeoutMs: num(process.env.SITE_FETCH_TIMEOUT_MS, 6000),

  deployTarget: (process.env.DEPLOY_TARGET ?? "vercel").toLowerCase(),
} as const;

export type Env = typeof env;
