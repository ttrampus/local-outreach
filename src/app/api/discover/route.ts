// POST /api/discover — kick off discovery for one or more (query, location) pairs.
// Returns immediately with the created SearchRun ids; the actual work runs in the
// background and writes progress to the DB. The UI polls /api/search-runs.
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/guard";
import {
  createSearchRun,
  runDiscovery,
  runDiscoveryBatch,
  getSweepProgress,
  clearSweepProgress,
} from "@/lib/discovery";
import { SWEEP_REGIONS, SWEEP_NAMES } from "@/lib/regions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PairSchema = z.object({
  query: z.string().trim().min(1, "query is required"),
  location: z.string().trim().min(1, "location is required"),
});

// A "sweep" fans one category across a named, server-defined region list (e.g.
// all of Slovenia). The list is trusted code, so it bypasses the manual 10-pair
// cap below.
const SweepSchema = z.object({
  query: z.string().trim().min(1, "query is required"),
  sweep: z.enum(SWEEP_NAMES),
});

const BodySchema = z.union([
  PairSchema,
  z.object({ pairs: z.array(PairSchema).min(1).max(10) }),
  SweepSchema,
]);

// GET /api/discover?sweep=slovenia&query=hair+salon — how much of a sweep is
// already covered, so the UI can show progress before launching.
export async function GET(req: Request) {
  const denied = await requireSession();
  if (denied) return denied;

  const url = new URL(req.url);
  const sweepParam = url.searchParams.get("sweep");
  const query = url.searchParams.get("query")?.trim();
  const parsedSweep = z.enum(SWEEP_NAMES).safeParse(sweepParam);
  if (!parsedSweep.success || !query) {
    return NextResponse.json({ error: "sweep and query query-params are required" }, { status: 400 });
  }

  const done = await getSweepProgress(parsedSweep.data, query);
  const all = SWEEP_REGIONS[parsedSweep.data];
  return NextResponse.json({
    total: all.length,
    done: all.filter((l) => done.has(l)),
    remaining: all.filter((l) => !done.has(l)),
  });
}

export async function POST(req: Request) {
  const denied = await requireSession();
  if (denied) return denied;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Resolve the request into a flat list of (query, location) pairs. A sweep
  // expands its named region list, minus any regions it already covered in a
  // previous sweep launch for this same (sweep, query); everything else is
  // taken verbatim.
  const data = parsed.data;
  const isSweep = "sweep" in data;

  let skipped: string[] = [];
  let pairs: { query: string; location: string }[];
  if ("sweep" in data) {
    const done = await getSweepProgress(data.sweep, data.query);
    const all = SWEEP_REGIONS[data.sweep];
    skipped = all.filter((location) => done.has(location));
    pairs = all
      .filter((location) => !done.has(location))
      .map((location) => ({ query: data.query, location }));
  } else if ("pairs" in data) {
    pairs = data.pairs;
  } else {
    pairs = [data];
  }

  if (isSweep && pairs.length === 0) {
    return NextResponse.json(
      { runs: [], skipped, message: "Every region in this sweep is already covered." },
      { status: 200 },
    );
  }

  const sweepTag = isSweep && "sweep" in data ? { sweep: data.sweep, batchId: crypto.randomUUID() } : undefined;

  const created = [];
  for (const { query, location } of pairs) {
    const run = await createSearchRun(query, location, sweepTag);
    created.push({ runId: run.id, query, location });
  }

  // Fire-and-forget: never block the response on the long-running work. A sweep
  // runs its regions sequentially (tight cost-cap enforcement); ad-hoc pairs keep
  // running in parallel for speed.
  if (isSweep && "sweep" in data) {
    void runDiscoveryBatch(created, data.sweep).catch((err) =>
      console.error(`[discover] sweep crashed:`, err),
    );
  } else {
    for (const c of created) {
      void runDiscovery(c.runId, c.query, c.location).catch((err) =>
        console.error(`[discover] run ${c.runId} crashed:`, err),
      );
    }
  }

  const runs = created.map((c) => ({ id: c.runId, query: c.query, location: c.location }));
  return NextResponse.json({ runs, skipped }, { status: 202 });
}

const ClearSchema = z.object({
  sweep: z.enum(SWEEP_NAMES),
  query: z.string().trim().min(1, "query is required"),
});

// DELETE /api/discover — clear sweep progress for a (sweep, query) so the next
// launch re-covers every region instead of skipping the ones already done.
export async function DELETE(req: Request) {
  const denied = await requireSession();
  if (denied) return denied;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ClearSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const cleared = await clearSweepProgress(parsed.data.sweep, parsed.data.query);
  return NextResponse.json({ cleared });
}
