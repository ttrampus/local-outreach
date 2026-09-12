// POST /api/leads/bulk/preview — build a preview for every selected lead.
//
// Body: { ids: [...] } or { filter: { tier, reach, q, status } }. Answers 202
// with a job id; the work runs fire-and-forget and the UI polls
// /api/leads/bulk/[jobId] until it stops saying "running". Same contract as
// POST /api/discover, for the same reason: this takes minutes to hours and no
// HTTP request should be held open across it.
//
// Unconditional rebuild — no "skip the ones that already have a preview". On the
// kit engine a rebuild is free and deterministic, and the previews generated
// before APP_BASE_URL was set have a dead contact-form URL baked into them, so
// "already has one" is not the same as "has a good one".
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/guard";
import { SelectionSchema, resolveSelection } from "@/lib/leads/selection";
import { createBulkJob, describeTarget, runBulkJob } from "@/lib/leads/bulkJob";
import { buildAndStorePreview } from "@/lib/preview/generate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const denied = await requireSession();
  if (denied) return denied;

  const parsed = SelectionSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Send either { ids: [...] } or { filter: {...} }." },
      { status: 400 },
    );
  }

  // Only one bulk preview run at a time. They share a single-slot semaphore
  // inside generate.ts anyway, so a second run would not go faster — it would
  // just interleave two progress rows over one queue and make both unreadable.
  const running = await prisma.bulkJob.findFirst({
    where: { kind: "preview", status: "running" },
    select: { id: true },
  });
  if (running) {
    return NextResponse.json(
      { error: "A preview run is already going. Wait for it or cancel it first.", jobId: running.id },
      { status: 409 },
    );
  }

  const { ids, requested } = await resolveSelection(parsed.data);
  if (ids.length === 0) {
    return NextResponse.json({ error: "Nothing matches that selection." }, { status: 400 });
  }

  const jobId = await createBulkJob("preview", describeTarget(parsed.data), ids.length, 0);

  void runBulkJob(jobId, ids, async (leadId) => {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: { searchRun: true },
    });
    if (!lead) return "skip";
    await buildAndStorePreview(lead);
    return "ok";
  });

  return NextResponse.json({ jobId, total: ids.length, requested }, { status: 202 });
}
