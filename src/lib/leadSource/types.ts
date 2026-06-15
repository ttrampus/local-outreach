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
