// GET /api/outreach — the review queue. All outreach records with their lead,
// newest first. Optional ?status=draft|approved|sent filter.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? undefined;

  const outreach = await prisma.outreach.findMany({
    where: status ? { status } : undefined,
    orderBy: { updatedAt: "desc" },
    include: {
      lead: {
        select: {
          id: true,
          name: true,
          tier: true,
          website: true,
          previewImagePath: true,
          deployedUrl: true,
          status: true,
        },
      },
    },
  });

  const counts: Record<string, number> = { draft: 0, approved: 0, sent: 0 };
  const grouped = await prisma.outreach.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  for (const g of grouped) counts[g.status] = g._count._all;

  return NextResponse.json({ outreach, counts });
}
