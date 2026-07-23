// Google Places API (New) implementation of LeadSource.
// Docs: https://developers.google.com/maps/documentation/places/web-service/op-overview
//
// COST MODEL (read alongside .env.example):
//   - Text Search and Place Details are SEPARATE billing SKUs with separate free
//     allowances. Place Details is the expensive one.
//   - Billing tier is driven by the FIELD MASK. We keep both masks tight and never
//     request fields "just in case". Broadening a mask can bump the call to a more
//     expensive SKU tier.
//   - Caching + daily ceilings live in the discovery orchestrator, not here.
import { env } from "@/lib/env";
import type {
  LeadSource,
  NormalizedPlaceDetails,
  NormalizedSearchResult,
} from "./types";

const BASE = "https://places.googleapis.com/v1";

// Tight masks. Search only needs ids to dedupe + drive Details; Details requests
// exactly what the qualifier and outreach consume — nothing more.
const SEARCH_FIELD_MASK = "places.id,places.displayName,places.formattedAddress,nextPageToken";
// We already bill at the Enterprise tier (because of `reviews`), so the extra
// qualification fields below — priceLevel, regularOpeningHours, primaryType,
// review publishTime — add NO cost: they're all within the tier we already pay.
const DETAILS_FIELD_MASK = [
  "id",
  "displayName",
  "formattedAddress",
  "internationalPhoneNumber",
  "websiteUri",
  "rating",
  "userRatingCount",
  "photos",
  "businessStatus",
  "regularOpeningHours",
  "location",
  "types",
  "primaryType",
  "primaryTypeDisplayName",
  "priceLevel",
  "googleMapsUri",
  "reviews",
].join(",");

class GooglePlacesError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "GooglePlacesError";
  }
}

async function googleFetch(path: string, init: RequestInit, fieldMask: string) {
  if (!env.googlePlacesApiKey) {
    throw new GooglePlacesError(
      "GOOGLE_PLACES_API_KEY is not set. Set it in .env.local or use LEAD_SOURCE=mock.",
    );
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": env.googlePlacesApiKey,
        "X-Goog-FieldMask": fieldMask,
        ...(init.headers ?? {}),
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new GooglePlacesError(
        `Google Places ${res.status}: ${text.slice(0, 300)}`,
        res.status,
      );
    }
    return (await res.json()) as Record<string, unknown>;
  } catch (err) {
    if (err instanceof GooglePlacesError) throw err;
    throw new GooglePlacesError(
      `Google Places request failed: ${(err as Error).message}`,
    );
  } finally {
    clearTimeout(timer);
  }
}

interface GooglePlace {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  photos?: { name?: string }[];
  businessStatus?: string;
  types?: string[];
  primaryType?: string;
  primaryTypeDisplayName?: { text?: string };
  priceLevel?: string;
  googleMapsUri?: string;
  location?: { latitude?: number; longitude?: number };
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  reviews?: {
    text?: { text?: string };
    originalText?: { text?: string };
    publishTime?: string;
  }[];
}

export const googleSource: LeadSource = {
  name: "google",

  async search(query, location, pageToken) {
    const textQuery = location ? `${query} in ${location}` : query;
    const body: Record<string, unknown> = { textQuery };
    if (pageToken) body.pageToken = pageToken;

    const json = await googleFetch(
      "/places:searchText",
      { method: "POST", body: JSON.stringify(body) },
      SEARCH_FIELD_MASK,
    );

    const places = (json.places as GooglePlace[] | undefined) ?? [];
    const results: NormalizedSearchResult[] = places
      .filter((p) => p.id)
      .map((p) => ({
        placeId: p.id as string,
        name: p.displayName?.text ?? "(unnamed)",
        address: p.formattedAddress,
      }));

    return {
      results,
      nextPageToken: (json.nextPageToken as string | undefined) || undefined,
    };
  },

  async details(placeId) {
    const p = (await googleFetch(
      `/places/${encodeURIComponent(placeId)}`,
      { method: "GET" },
      DETAILS_FIELD_MASK,
    )) as GooglePlace;

    const reviews = p.reviews ?? [];
    // Keep all available review text (Google returns up to 5, same SKU tier) —
    // the preview's review-insight pass mines them for specific praise/staff.
    const reviewSnippets = reviews
      .map((r) => r.text?.text ?? r.originalText?.text ?? "")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 5);

    // Most recent review timestamp → recency/activity signal for qualification.
    const reviewTimes = reviews
      .map((r) => r.publishTime)
      .filter((t): t is string => Boolean(t))
      .map((t) => Date.parse(t))
      .filter((n) => !Number.isNaN(n));
    const lastReviewAt = reviewTimes.length
      ? new Date(Math.max(...reviewTimes)).toISOString()
      : undefined;

    const details: NormalizedPlaceDetails = {
      placeId: p.id ?? placeId,
      name: p.displayName?.text ?? "(unnamed)",
      address: p.formattedAddress,
      phone: p.internationalPhoneNumber,
      website: p.websiteUri,
      rating: p.rating,
      reviewCount: p.userRatingCount ?? 0,
      photoCount: Array.isArray(p.photos) ? p.photos.length : 0,
      photoRefs: (p.photos ?? [])
        .map((ph) => ph.name)
        .filter((n): n is string => Boolean(n)),
      businessStatus: p.businessStatus,
      reviewSnippets,
      categories: p.types ?? [],
      primaryType: p.primaryType,
      primaryTypeDisplayName: p.primaryTypeDisplayName?.text,
      priceLevel: p.priceLevel,
      hasHours: Boolean(p.regularOpeningHours?.weekdayDescriptions?.length),
      openingHours: p.regularOpeningHours?.weekdayDescriptions,
      lastReviewAt,
      googleMapsUri: p.googleMapsUri,
      latitude: p.location?.latitude,
      longitude: p.location?.longitude,
    };
    return details;
  },
};
