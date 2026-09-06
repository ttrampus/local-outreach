// GET /api/leads — filterable/sortable lead list for the dashboard table.
// Query params: tier=HOT|WARM|COLD, status=..., reach=email|phone|social|none,
// q=text, sort=score|name|reviews|created.
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

// "Reachable by" filters. These describe what contact details a lead HAS, not
// which channel drafting would pick — the picker takes the single best one, but
// the operator wants to see, say, every lead with a phone number regardless of
// whether it also has an email.
const HAS_EMAIL: Prisma.LeadWhereInput = { email: { not: null }, NOT: { email: "" } };
const HAS_PHONE: Prisma.LeadWhereInput = { phone: { not: null }, NOT: { phone: "" } };
// Mirrors socialDmLink() in draft.ts: a "website" that is really a Facebook or
// Instagram page is a DM channel, not a site.
const HAS_SOCIAL: Prisma.LeadWhereInput = {
  OR: [{ website: { contains: "facebook." } }, { website: { contains: "instagram." } }],
};

export const REACH_FILTERS: Record<string, Prisma.LeadWhereInput> = {
  email: HAS_EMAIL,
  phone: HAS_PHONE,
  social: HAS_SOCIAL,
  // Nothing to reach them by at all — these need a channel found by hand.
  none: { NOT: { OR: [HAS_EMAIL, HAS_PHONE, HAS_SOCIAL] } },
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

  // Every filter goes into AND so they compose — the text search already owns
  // the top-level OR, and a second bare OR would silently widen the result.
  const and: Prisma.LeadWhereInput[] = [];
  if (tier && ["HOT", "WARM", "COLD"].includes(tier)) and.push({ tier });
  if (status) and.push({ status });
  if (q) {
    and.push({
      OR: [
        { name: { contains: q } },
        { address: { contains: q } },
        { website: { contains: q } },
      ],
    });
  }
  const reachWhere = reach ? REACH_FILTERS[reach] : undefined;

  const where: Prisma.LeadWhereInput = {
    AND: reachWhere ? [...and, reachWhere] : and,
  };

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
  const withoutTier = and.filter((c) => !("tier" in c));
  const grouped = await prisma.lead.groupBy({
    by: ["tier"],
    where: { AND: reachWhere ? [...withoutTier, reachWhere] : withoutTier },
    _count: { _all: true },
  });
  const counts: Record<string, number> = { HOT: 0, WARM: 0, COLD: 0 };
  for (const g of grouped) counts[g.tier] = g._count._all;

  const reachCounts: Record<string, number> = {};
  await Promise.all(
    Object.entries(REACH_FILTERS).map(async ([key, clause]) => {
      reachCounts[key] = await prisma.lead.count({ where: { AND: [...and, clause] } });
    }),
  );
  reachCounts.all = await prisma.lead.count({ where: { AND: and } });

  return NextResponse.json({ leads, counts, reachCounts });
}
