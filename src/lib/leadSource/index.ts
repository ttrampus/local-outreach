// Factory: pick the active LeadSource from config. Swap data sources here
// (add an OSM/Overpass or Foursquare impl, set LEAD_SOURCE) without touching
// the qualifier, discovery orchestrator, or UI.
import { env } from "@/lib/env";
import type { LeadSource } from "./types";
import { googleSource } from "./google";
import { mockSource } from "./mock";

export function getLeadSource(): LeadSource {
  switch (env.leadSource) {
    case "google":
      return googleSource;
    case "mock":
      return mockSource;
    default:
      throw new Error(
        `Unknown LEAD_SOURCE "${env.leadSource}". Use "google" or "mock".`,
      );
  }
}

export type { LeadSource } from "./types";
export type {
  NormalizedPlaceDetails,
  NormalizedSearchResult,
  ApiSku,
} from "./types";
