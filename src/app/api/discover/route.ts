// POST /api/discover — kick off discovery for one or more (query, location) pairs.
// Returns immediately with the created SearchRun ids; the actual work runs in the
// background and writes progress to the DB. The UI polls /api/search-runs.
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSearchRun, runDiscovery } from "@/lib/discovery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PairSchema = z.object({
  query: z.string().trim().min(1, "query is required"),
  location: z.string().trim().min(1, "location is required"),
});

const BodySchema = z.union([
  PairSchema,
  z.object({ pairs: z.array(PairSchema).min(1).max(10) }),
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

  const pairs = "pairs" in parsed.data ? parsed.data.pairs : [parsed.data];

  const runs = [];
  for (const { query, location } of pairs) {
    const run = await createSearchRun(query, location);
    runs.push({ id: run.id, query, location });
    // Fire-and-forget: do not block the response on the long-running batch.
    void runDiscovery(run.id, query, location).catch((err) => {
      // runDiscovery already records errors to the DB; log as a backstop.
      console.error(`[discover] run ${run.id} crashed:`, err);
    });
  }

  return NextResponse.json({ runs }, { status: 202 });
}
