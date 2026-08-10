// GET /api/leads — filterable/sortable lead list for the dashboard table.
// Query params: tier=HOT|WARM|COLD, status=..., q=text, sort=score|name|reviews|created.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

import { requireSession } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SORTS: Record<string, Prisma.LeadOrderByWithRelationInput> = {
  score: { score: "desc" },
  name: { name: "asc" },
  reviews: { reviewCount: "desc" },
  created: { createdAt: "desc" },
};

export async function GET(req: Request) {
  const denied = await requireSession();
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const tier = searchParams.get("tier")?.toUpperCase();
  const status = searchParams.get("status") ?? undefined;
  const q = searchParams.get("q")?.trim();
  const sort = searchParams.get("sort") ?? "score";

  const where: Prisma.LeadWhereInput = {};
  if (tier && ["HOT", "WARM", "COLD"].includes(tier)) where.tier = tier;
  if (status) where.status = status;
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { address: { contains: q } },
      { website: { contains: q } },
    ];
  }

  const leads = await prisma.lead.findMany({
    where,
    orderBy: SORTS[sort] ?? SORTS.score,
    take: 500,
    include: { outreach: { select: { id: true, status: true } } },
  });

  // For the default score view, tier is the primary signal — a strong WARM should
  // never out-rank a HOT just because its raw score is higher (the scores live on
  // different scales). So group HOT → WARM → COLD, keeping score order within each.
  // Explicit sorts (reviews/name/created) are left exactly as the user asked.
  if (sort === "score") {
    const rank: Record<string, number> = { HOT: 0, WARM: 1, COLD: 2 };
    leads.sort((a, b) => (rank[a.tier] ?? 9) - (rank[b.tier] ?? 9) || b.score - a.score);
  }

  // Tier counts for the grouped view / filter chips (respecting text+status filter).
  const grouped = await prisma.lead.groupBy({
    by: ["tier"],
    where: { ...where, tier: undefined },
    _count: { _all: true },
  });
  const counts: Record<string, number> = { HOT: 0, WARM: 0, COLD: 0 };
  for (const g of grouped) counts[g.tier] = g._count._all;

  return NextResponse.json({ leads, counts });
}
