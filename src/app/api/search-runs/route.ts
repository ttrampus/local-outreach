// GET /api/search-runs — recent discovery runs with their counts/status.
// Polled by the search page to show live progress. A sweep launch creates one
// SearchRun per region (~20 rows); those are grouped into a single entry here
// so the UI shows one line per launch instead of flooding the list.
//
// DELETE /api/search-runs — remove rows from the run ledger (leads survive;
// the FK is ON DELETE SET NULL, so a deleted run's leads just lose their
// category label). Running rows are refused.
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { deleteSearchRuns } from "@/lib/discovery";

import { requireSession } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RUN_LIMIT = 200; // raw rows fetched before grouping
const GROUP_LIMIT = 25; // grouped entries returned

export async function GET() {
  const denied = await requireSession();
  if (denied) return denied;

  const runs = await prisma.searchRun.findMany({
    orderBy: { createdAt: "desc" },
    take: RUN_LIMIT,
  });

  // Group sweep regions by their batch; everything else stays its own entry.
  const groups = new Map<string, typeof runs>();
  for (const run of runs) {
    const key = run.sweepBatchId ?? run.id;
    const bucket = groups.get(key);
    if (bucket) bucket.push(run);
    else groups.set(key, [run]);
  }

  const entries = [...groups.values()]
    .map((rows) => {
      if (rows.length === 1 && !rows[0].sweepBatchId) {
        const r = rows[0];
        return {
          kind: "single" as const,
          id: r.id,
          query: r.query,
          location: r.location,
          status: r.status,
          error: r.error,
          totalFound: r.totalFound,
          newLeads: r.newLeads,
          cachedHits: r.cachedHits,
          detailCalls: r.detailCalls,
          createdAt: r.createdAt,
        };
      }
      const createdAt = rows.reduce((min, r) => (r.createdAt < min ? r.createdAt : min), rows[0].createdAt);
      const running = rows.filter((r) => r.status === "running").length;
      const errored = rows.filter((r) => r.status === "error").length;
      return {
        kind: "sweep" as const,
        sweep: rows[0].sweep,
        sweepBatchId: rows[0].sweepBatchId,
        query: rows[0].query,
        status: running > 0 ? "running" : errored === rows.length ? "error" : "done",
        regionsTotal: rows.length,
        regionsRunning: running,
        regionsErrored: errored,
        totalFound: rows.reduce((s, r) => s + r.totalFound, 0),
        newLeads: rows.reduce((s, r) => s + r.newLeads, 0),
        cachedHits: rows.reduce((s, r) => s + r.cachedHits, 0),
        detailCalls: rows.reduce((s, r) => s + r.detailCalls, 0),
        createdAt,
        ids: rows.map((r) => r.id),
        regions: rows
          .map((r) => ({
            id: r.id,
            location: r.location,
            status: r.status,
            error: r.error,
            totalFound: r.totalFound,
            newLeads: r.newLeads,
          }))
          .sort((a, b) => a.location.localeCompare(b.location)),
      };
    })
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, GROUP_LIMIT);

  return NextResponse.json({ runs: entries });
}

const DeleteSchema = z.object({ ids: z.array(z.string()).min(1) });

export async function DELETE(req: Request) {
  const denied = await requireSession();
  if (denied) return denied;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = DeleteSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const deleted = await deleteSearchRuns(parsed.data.ids);
  const skipped = parsed.data.ids.filter((id) => !deleted.includes(id));
  return NextResponse.json({ deleted, skipped });
}
