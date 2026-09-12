// GET /api/leads — filterable/sortable lead list for the dashboard table.
// Query params: tier=HOT|WARM|COLD, status=..., reach=email|phone|social|none,
// q=text, sort=score|name|reviews|created.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

import { requireSession } from "@/lib/auth/guard";
// The filter clauses live in lib/ because the bulk endpoints resolve the very
// same filter server-side; two copies would eventually disagree about what
// "all the HOT ones with an email" means, and one of those copies sends mail.
import { REACH_FILTERS, leadWhere } from "@/lib/leads/selection";

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
  const reach = searchParams.get("reach") ?? undefined;
  const q = searchParams.get("q")?.trim();
  const sort = searchParams.get("sort") ?? "score";

  const filter = {
    tier: tier && ["HOT", "WARM", "COLD"].includes(tier) ? (tier as "HOT" | "WARM" | "COLD") : undefined,
    status,
    reach: reach && reach in REACH_FILTERS ? (reach as "email" | "phone" | "social" | "none") : undefined,
    q: q || undefined,
  };
  const where = leadWhere(filter);

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

  // Counts for the filter chips. Each dimension's own filter is dropped from its
  // counts, so the numbers say "how many would I get if I clicked this" rather
  // than collapsing to the current selection.
  const grouped = await prisma.lead.groupBy({
    by: ["tier"],
    where: leadWhere({ ...filter, tier: undefined }),
    _count: { _all: true },
  });
  const counts: Record<string, number> = { HOT: 0, WARM: 0, COLD: 0 };
  for (const g of grouped) counts[g.tier] = g._count._all;

  const withoutReach = leadWhere({ ...filter, reach: undefined });
  const reachCounts: Record<string, number> = {};
  await Promise.all(
    Object.entries(REACH_FILTERS).map(async ([key, clause]) => {
      reachCounts[key] = await prisma.lead.count({ where: { AND: [withoutReach, clause] } });
    }),
  );
  reachCounts.all = await prisma.lead.count({ where: withoutReach });

  // How many match the filter as a whole. The chip counts each drop their own
  // dimension, so neither of them answers "how many am I looking at" — and the
  // returned rows are capped at 500, so the array length does not either. A
  // "select all matching" control has to state the real number.
  const matching = await prisma.lead.count({ where });

  return NextResponse.json({ leads, counts, reachCounts, matching });
}
