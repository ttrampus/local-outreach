// The normalized internal lead shape. The qualifier and UI consume ONLY this —
// never raw Google JSON — so the data source can be swapped (Google → OSM →
// Foursquare) without touching anything downstream.

export interface NormalizedSearchResult {
  /** Stable id from the source, used as our placeId (and cache key). */
  placeId: string;
  name: string;
  /** A formatted address if the search step already provides one. */
  address?: string;
}

export interface NormalizedPlaceDetails {
  placeId: string;
  name: string;
  address?: string;
  phone?: string;
  website?: string;
  rating?: number;
  reviewCount: number;
  photoCount: number;
  /** "OPERATIONAL" | "CLOSED_TEMPORARILY" | "CLOSED_PERMANENTLY" | undefined */
  businessStatus?: string;
  /** A few representative review snippets, used to personalize previews/outreach. */
  reviewSnippets: string[];
  /** Free-form category/type hints, used to pick preview styling later. */
  categories: string[];

  // ── Enrichment for qualification (all optional; sources fill what they have) ──
  /** The single most specific Google place type, e.g. "hair_salon". */
  primaryType?: string;
  /** Human-readable primary type, e.g. "Hair Salon". */
  primaryTypeDisplayName?: string;
  /** Price level enum, e.g. "PRICE_LEVEL_MODERATE" — a budget/ability-to-pay proxy. */
  priceLevel?: string;
  /** True if the listing publishes opening hours (a maintained, active listing). */
  hasHours?: boolean;
  /** ISO timestamp of the most recent review, for recency/activity scoring. */
  lastReviewAt?: string;
  /** Canonical Google Maps URL, handy for manual verification. */
  googleMapsUri?: string;
}

/**
 * A pluggable lead source. Implementations must:
 *  - fail gracefully (throw a typed Error, never hang) so one hiccup can't kill a batch
 *  - return the normalized shapes above, never source-specific JSON
 *  - leave caching + usage accounting to the caller (the discovery orchestrator)
 */
export interface LeadSource {
  readonly name: string;

  /** One page of results plus an opaque token to fetch the next page, if any. */
  search(
    query: string,
    location: string,
    pageToken?: string,
  ): Promise<{ results: NormalizedSearchResult[]; nextPageToken?: string }>;

  /** Fetch contact + quality fields for a single place. Tight field mask. */
  details(placeId: string): Promise<NormalizedPlaceDetails>;
}

/** Cost-center SKUs we track per call. */
export type ApiSku = "TEXT_SEARCH" | "PLACE_DETAILS";
