// GET /api/outreach — the review queue. All outreach records with their lead,
// newest first. Optional ?status=draft|approved|sent filter.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? undefined;

  // The queue shows the pipeline messages (initial draft → approved → sent). Queued
  // follow-ups are attached to their primary below, never listed on their own.
  const outreach = await prisma.outreach.findMany({
    where: status ? { status } : { status: { in: ["draft", "approved", "sent"] } },
    orderBy: { updatedAt: "desc" },
    include: {
      lead: {
        select: {
          id: true,
          name: true,
          tier: true,
          website: true,
          previewImagePath: true,
          // The phone shot, so "mobile looks right" on the pre-send checklist is
          // something the operator can actually see rather than assume.
          previewMobileImagePath: true,
          deployedUrl: true,
          status: true,
        },
      },
    },
  });

  // Attach each lead's queued follow-ups (step 1+) so they show as reference under
  // the primary message in the review UI.
  const leadIds = [...new Set(outreach.map((o) => o.leadId))];
  const followupRows = leadIds.length
    ? await prisma.outreach.findMany({
        where: { leadId: { in: leadIds }, status: "queued" },
        orderBy: { step: "asc" },
        select: { id: true, leadId: true, step: true, subject: true, body: true },
      })
    : [];
  const byLead = new Map<string, typeof followupRows>();
  for (const f of followupRows) {
    const arr = byLead.get(f.leadId) ?? [];
    arr.push(f);
    byLead.set(f.leadId, arr);
  }
  const withFollowups = outreach.map((o) => ({ ...o, followups: byLead.get(o.leadId) ?? [] }));

  const counts: Record<string, number> = { draft: 0, approved: 0, sent: 0 };
  const grouped = await prisma.outreach.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  for (const g of grouped) counts[g.status] = g._count._all;

  return NextResponse.json({ outreach: withFollowups, counts });
}
