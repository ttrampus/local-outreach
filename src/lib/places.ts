// Read the normalized place details we cached during discovery. Preview and
// outreach generation need fields (review snippets, categories) that aren't
// stored flat on the Lead row — they live in PlaceCache.raw as the normalized
// snapshot written by the discovery orchestrator.
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import type { NormalizedPlaceDetails } from "@/lib/leadSource/types";

export async function getCachedDetails(
  placeId: string,
): Promise<NormalizedPlaceDetails | null> {
  const cached = await prisma.placeCache.findUnique({ where: { placeId } });
  if (!cached) return null;
  try {
    return JSON.parse(cached.raw) as NormalizedPlaceDetails;
  } catch {
    return null;
  }
}

/**
 * True when a cached snapshot was fetched under a different Places language than
 * we're configured for now. Google localizes review text, weekday descriptions
 * and category labels, and those strings are used verbatim on the generated
 * site — so a mismatched row would silently produce an English page for a
 * non-English business.
 */
export async function isCachedLanguageStale(placeId: string): Promise<boolean> {
  const cached = await prisma.placeCache.findUnique({
    where: { placeId },
    select: { language: true },
  });
  if (!cached) return false; // nothing cached — the caller fetches fresh anyway
  return cached.language !== (env.googlePlacesLanguage || null);
}
