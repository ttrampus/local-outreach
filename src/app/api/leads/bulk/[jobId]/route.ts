// GET    /api/leads/bulk/:jobId — progress for one bulk run (the UI polls this)
// DELETE /api/leads/bulk/:jobId — ask the run to stop after the current lead
//
// Polling rather than streaming, matching /api/search-runs: the client already
// has a self-terminating setTimeout loop for sweeps, and a bulk run has the same
// shape — slow, sequential, and interesting only every few seconds.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const denied = await requireSession();
  if (denied) return denied;

  const { jobId } = await params;
  const job = await prisma.bulkJob.findUnique({ where: { id: jobId } });
  if (!job) return NextResponse.json({ error: "No such run." }, { status: 404 });

  return NextResponse.json({ job });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const denied = await requireSession();
  if (denied) return denied;

  const { jobId } = await params;
  const job = await prisma.bulkJob.findUnique({
    where: { id: jobId },
    select: { id: true, status: true },
  });
  if (!job) return NextResponse.json({ error: "No such run." }, { status: 404 });

  // A request, not a kill — the worker notices between leads. Said plainly in the
  // response because for a send run the difference matters: messages already
  // delivered are gone, and only the next one is being stopped.
  if (job.status === "running") {
    await prisma.bulkJob.update({ where: { id: jobId }, data: { cancelRequested: true } });
  }

  return NextResponse.json({ ok: true, stopping: job.status === "running" });
}
