// POST /api/leads/:id/refresh — force a fresh Place Details fetch for one lead,
// overwriting its cached snapshot (backfills photoRefs so a regenerated preview
// can pull real photos) and re-qualifying it. Costs one PLACE_DETAILS call and
// respects the daily/monthly cost stops.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { refreshLeadDetails } from "@/lib/discovery";

import { requireSession } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireSession();
  if (denied) return denied;

  const { id } = await params;
  const result = await refreshLeadDetails(id);

  if (result.status === "capped") {
    return NextResponse.json({ error: result.message }, { status: 429 });
  }
  if (result.status === "error") {
    const status = result.message === "Lead not found." ? 404 : 502;
    return NextResponse.json({ error: result.message }, { status });
  }

  // Return the freshened lead so the detail panel updates in place.
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: { outreach: { orderBy: { updatedAt: "desc" } } },
  });
  return NextResponse.json({ lead, photoRefs: result.photoRefs ?? 0 });
}
