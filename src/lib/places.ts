// Read the normalized place details we cached during discovery. Preview and
// outreach generation need fields (review snippets, categories) that aren't
// stored flat on the Lead row — they live in PlaceCache.raw as the normalized
// snapshot written by the discovery orchestrator.
import { prisma } from "@/lib/prisma";
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
