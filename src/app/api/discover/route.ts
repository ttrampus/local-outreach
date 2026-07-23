// POST /api/discover — kick off discovery for one or more (query, location) pairs.
// Returns immediately with the created SearchRun ids; the actual work runs in the
// background and writes progress to the DB. The UI polls /api/search-runs.
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSearchRun, runDiscovery, runDiscoveryBatch } from "@/lib/discovery";
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

export async function POST(req: Request) {
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
  // expands its named region list; everything else is taken verbatim.
  const data = parsed.data;
  const isSweep = "sweep" in data;
  const pairs = "sweep" in data
    ? SWEEP_REGIONS[data.sweep].map((location) => ({ query: data.query, location }))
    : "pairs" in data
      ? data.pairs
      : [data];

  const created = [];
  for (const { query, location } of pairs) {
    const run = await createSearchRun(query, location);
    created.push({ runId: run.id, query, location });
  }

  // Fire-and-forget: never block the response on the long-running work. A sweep
  // runs its regions sequentially (tight cost-cap enforcement); ad-hoc pairs keep
  // running in parallel for speed.
  if (isSweep) {
    void runDiscoveryBatch(created).catch((err) =>
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
  return NextResponse.json({ runs }, { status: 202 });
}
