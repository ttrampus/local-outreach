// Discovery orchestrator. Owns caching, usage accounting, idempotency and the
// cost safety stops — the LeadSource implementations stay dumb about all of it.
//
// Guarantees:
//  - Idempotent: a placeId already in the DB is skipped (no Details call, no spend).
//  - Cache-first: a placeId in PlaceCache is never re-fetched.
//  - Safety stops: enforces per-SKU daily ceilings independently of GCP caps.
//  - Resilient: a single dead site or API hiccup is caught per-lead; the batch
//    continues. The whole run is wrapped so a fatal error is recorded, not thrown.
import { prisma } from "@/lib/prisma";
import { getLeadSource } from "@/lib/leadSource";
import type { NormalizedPlaceDetails } from "@/lib/leadSource/types";
import { recordCall, dailyLimitReached, monthlyLimitReached } from "@/lib/usage";
import { analyzeSite, qualify, classifyWebPresence, presenceNeedsFetch } from "@/lib/qualify";

const MAX_PAGES = 3; // Text Search returns up to ~20/page; 3 pages ≈ 60 places.

/** Create a SearchRun row in "running" state and return it. */
export async function createSearchRun(query: string, location: string) {
  return prisma.searchRun.create({
    data: { query, location, status: "running" },
  });
}

/**
 * Run discovery for one (query, location) pair against the active LeadSource.
 * Never throws — failures are written to the SearchRun row.
 */
export async function runDiscovery(
  runId: string,
  query: string,
  location: string,
): Promise<void> {
  const source = getLeadSource();
  const billable = source.name !== "mock"; // mock data is free; don't count it

  let totalFound = 0;
  let newLeads = 0;
  let cachedHits = 0;
  let detailCalls = 0;
  let note = "";

  try {
    let pageToken: string | undefined;
    let pages = 0;

    pageLoop: do {
      if (billable && (await monthlyLimitReached("TEXT_SEARCH"))) {
        note = "Stopped: monthly Text Search free-tier guard reached.";
        break;
      }
      if (billable && (await dailyLimitReached("TEXT_SEARCH"))) {
        note = "Stopped: daily Text Search limit reached.";
        break;
      }

      const { results, nextPageToken } = await source.search(query, location, pageToken);
      if (billable) await recordCall("TEXT_SEARCH");
      pageToken = nextPageToken;
      pages += 1;
      totalFound += results.length;

      for (const r of results) {
        // Idempotent: already have this lead → skip entirely (no spend).
        const existing = await prisma.lead.findUnique({
          where: { placeId: r.placeId },
          select: { id: true },
        });
        if (existing) continue;

        // Fetch details (cache-first). Cache miss respects the daily ceiling.
        let details: NormalizedPlaceDetails;
        const cached = await prisma.placeCache.findUnique({
          where: { placeId: r.placeId },
        });

        if (cached) {
          try {
            details = JSON.parse(cached.raw) as NormalizedPlaceDetails;
            cachedHits += 1;
          } catch {
            continue; // corrupt cache row — skip rather than crash the batch
          }
        } else {
          if (billable && (await monthlyLimitReached("PLACE_DETAILS"))) {
            note = "Stopped: monthly Place Details free-tier guard reached (cost safety stop).";
            break pageLoop;
          }
          if (billable && (await dailyLimitReached("PLACE_DETAILS"))) {
            note = "Stopped: daily Place Details limit reached (cost safety stop).";
            break pageLoop;
          }
          try {
            details = await source.details(r.placeId);
          } catch {
            // One bad place must not kill the batch.
            continue;
          }
          if (billable) {
            await recordCall("PLACE_DETAILS");
            detailCalls += 1;
          }
          await prisma.placeCache.create({
            data: {
              placeId: r.placeId,
              source: source.name,
              raw: JSON.stringify(details),
            },
          });
        }

        // Qualify. Only fetch the page when it's the business's OWN site — no point
        // fetching a Facebook/Booksy/etc. profile (those are scored by host alone).
        const presence = classifyWebPresence(details.website).presence;
        const site =
          details.website && presenceNeedsFetch(presence)
            ? await analyzeSite(details.website)
            : undefined;
        const q = qualify(details, site);

        await prisma.lead.create({
          data: {
            placeId: details.placeId,
            source: source.name,
            name: details.name,
            address: details.address,
            phone: details.phone,
            email: site?.email ?? null,
            website: details.website,
            rating: details.rating ?? null,
            reviewCount: details.reviewCount,
            photoCount: details.photoCount,
            tier: q.tier,
            score: q.score,
            qualificationReason: q.reason,
            signals: JSON.stringify(q.signals),
            status: "discovered",
            searchRunId: runId,
          },
        });
        newLeads += 1;
      }
    } while (pageToken && pages < MAX_PAGES);

    await prisma.searchRun.update({
      where: { id: runId },
      data: {
        status: "done",
        totalFound,
        newLeads,
        cachedHits,
        detailCalls,
        error: note || null,
      },
    });
  } catch (err) {
    await prisma.searchRun.update({
      where: { id: runId },
      data: {
        status: "error",
        totalFound,
        newLeads,
        cachedHits,
        detailCalls,
        error: (err as Error).message.slice(0, 500),
      },
    });
  }
}

/**
 * Run a list of pre-created SearchRuns one after another (NOT in parallel). A
 * sweep fans one category across ~20 regions; running them sequentially keeps the
 * per-SKU daily/monthly cost ceilings tight (parallel runs race the read-then-act
 * cap check and can overshoot). Each runDiscovery swallows its own errors, so one
 * bad region never aborts the rest of the sweep.
 */
export async function runDiscoveryBatch(
  runs: { runId: string; query: string; location: string }[],
): Promise<void> {
  for (const r of runs) {
    await runDiscovery(r.runId, r.query, r.location);
  }
}

/**
 * Re-score every existing lead from its CACHED details — no Google API calls, no
 * spend. Use after changing the qualifier. The existing site is re-analyzed (a
 * network fetch of the lead's own homepage, not a billable API), so results are as
 * good as the environment's connectivity; run it from a host with normal network
 * access for the most accurate site checks.
 */
export async function requalifyAll(): Promise<{
  total: number;
  rescored: number;
  changedTier: number;
  skippedNoCache: number;
}> {
  const leads = await prisma.lead.findMany({
    select: { id: true, placeId: true, website: true, tier: true },
  });

  let rescored = 0;
  let changedTier = 0;
  let skippedNoCache = 0;

  for (const lead of leads) {
    const cached = await prisma.placeCache.findUnique({ where: { placeId: lead.placeId } });
    if (!cached) {
      skippedNoCache += 1;
      continue;
    }
    let details: NormalizedPlaceDetails;
    try {
      details = JSON.parse(cached.raw) as NormalizedPlaceDetails;
    } catch {
      skippedNoCache += 1;
      continue;
    }

    const presence = classifyWebPresence(details.website).presence;
    const siteSignals =
      details.website && presenceNeedsFetch(presence)
        ? await analyzeSite(details.website)
        : undefined;
    const q = qualify(details, siteSignals);

    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        tier: q.tier,
        score: q.score,
        qualificationReason: q.reason,
        signals: JSON.stringify(q.signals),
        email: siteSignals?.email ?? undefined,
      },
    });
    rescored += 1;
    if (q.tier !== lead.tier) changedTier += 1;
  }

  return { total: leads.length, rescored, changedTier, skippedNoCache };
}

export interface RefreshResult {
  status: "ok" | "capped" | "error";
  message?: string;
  photoRefs?: number;
}

/**
 * Force a fresh Place Details fetch for ONE lead (overwriting its cache), then
 * re-qualify it. Use this to backfill leads cached before a field existed —
 * notably `photoRefs`, so a regenerated preview can pull real photos. Costs one
 * PLACE_DETAILS call and respects the daily/monthly cost stops.
 */
export async function refreshLeadDetails(leadId: string): Promise<RefreshResult> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return { status: "error", message: "Lead not found." };

  const source = getLeadSource();
  const billable = source.name !== "mock";

  if (billable && (await monthlyLimitReached("PLACE_DETAILS"))) {
    return { status: "capped", message: "Monthly Place Details free-tier guard reached." };
  }
  if (billable && (await dailyLimitReached("PLACE_DETAILS"))) {
    return { status: "capped", message: "Daily Place Details limit reached." };
  }

  let details: NormalizedPlaceDetails;
  try {
    details = await source.details(lead.placeId);
  } catch (err) {
    return { status: "error", message: (err as Error).message.slice(0, 200) };
  }
  if (billable) await recordCall("PLACE_DETAILS");

  // Overwrite the cached snapshot — it now carries photoRefs and fresh fields.
  await prisma.placeCache.upsert({
    where: { placeId: lead.placeId },
    update: { raw: JSON.stringify(details), source: source.name },
    create: { placeId: lead.placeId, source: source.name, raw: JSON.stringify(details) },
  });

  // Re-qualify from the fresh details and refresh the flat Lead fields.
  const presence = classifyWebPresence(details.website).presence;
  const site =
    details.website && presenceNeedsFetch(presence) ? await analyzeSite(details.website) : undefined;
  const q = qualify(details, site);

  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      name: details.name,
      address: details.address ?? null,
      phone: details.phone ?? null,
      // Only set when freshly found, so a transient site failure can't wipe a
      // previously-extracted email (undefined = "leave as-is" in Prisma).
      email: site?.email ?? undefined,
      website: details.website ?? null,
      rating: details.rating ?? null,
      reviewCount: details.reviewCount,
      photoCount: details.photoCount,
      tier: q.tier,
      score: q.score,
      qualificationReason: q.reason,
      signals: JSON.stringify(q.signals),
    },
  });

  return { status: "ok", photoRefs: details.photoRefs?.length ?? 0 };
}
