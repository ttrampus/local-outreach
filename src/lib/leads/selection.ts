// What "the leads I picked" means on the server.
//
// A bulk action can be aimed two ways: at an explicit set of rows the operator
// ticked, or at "everything matching what I am currently looking at". The second
// one is the whole point of the feature — the table shows at most 500 rows and
// the operator thinks in terms of "all the HOT ones with an email", not in terms
// of row ids.
//
// So the filter is sent as a FILTER, not as the id list the client happened to
// have on screen, and re-resolved here against the database. Three reasons:
// a client id list is capped by whatever the table had loaded, it goes stale the
// moment discovery adds a lead, and a bulk send driven by a client-supplied list
// of arbitrary length is exactly the shape you do not want on an endpoint that
// spends the operator's sending reputation.
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

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

export const TIERS = ["HOT", "WARM", "COLD"] as const;

// Whether the lead has had its first email. Same clause the send endpoint uses to
// exclude already-contacted leads, exposed as a filter so the operator can look
// at exactly the set a run would take — which is what "the other 113" means after
// a capped batch.
const EMAILED: Prisma.LeadWhereInput = { outreach: { some: { step: 0, status: "sent" } } };
const NOT_EMAILED: Prisma.LeadWhereInput = { outreach: { none: { step: 0, status: "sent" } } };

// Asked to be left alone. The stamp is set by /api/unsubscribe and is the only
// thing that matters here — there is no separate suppression table, the lead row
// IS the opt-out record, which is why it can never be silently overwritten by a
// re-import of the same business.
const OPTED_OUT: Prisma.LeadWhereInput = { unsubscribedAt: { not: null } };

/** The table's four filter controls, exactly as /api/leads accepts them. */
export const LeadFilterSchema = z.object({
  tier: z.enum(TIERS).optional(),
  status: z.string().trim().max(40).optional(),
  reach: z.enum(["email", "phone", "social", "none"]).optional(),
  emailed: z.enum(["yes", "no"]).optional(),
  optout: z.enum(["yes", "no"]).optional(),
  q: z.string().trim().max(200).optional(),
});
export type LeadFilter = z.infer<typeof LeadFilterSchema>;

/**
 * Build the Prisma `where` for a filter. One implementation, shared by the list
 * endpoint and every bulk action, so "all 47 matching" can never mean a different
 * 47 than the table just showed.
 */
export function leadWhere(filter: LeadFilter): Prisma.LeadWhereInput {
  // Every filter goes into AND so they compose — the text search already owns
  // the top-level OR, and a second bare OR would silently widen the result.
  const and: Prisma.LeadWhereInput[] = [];
  if (filter.tier) and.push({ tier: filter.tier });
  if (filter.status) and.push({ status: filter.status });
  if (filter.q) {
    and.push({
      OR: [
        { name: { contains: filter.q } },
        { address: { contains: filter.q } },
        { website: { contains: filter.q } },
      ],
    });
  }
  if (filter.reach) {
    const clause = REACH_FILTERS[filter.reach];
    if (clause) and.push(clause);
  }
  if (filter.emailed) and.push(filter.emailed === "yes" ? EMAILED : NOT_EMAILED);
  if (filter.optout) and.push(filter.optout === "yes" ? OPTED_OUT : { unsubscribedAt: null });
  return { AND: and };
}

/**
 * Either specific rows, or a filter standing for all of them.
 *
 * `.max(500)` on the id list matches the table's own `take: 500` — a longer list
 * did not come from the UI. The union is strict rather than "ids and/or filter"
 * so there is never a question of which one won.
 */
export const SelectionSchema = z.union([
  z.object({ ids: z.array(z.string().min(1).max(60)).min(1).max(500) }),
  z.object({ filter: LeadFilterSchema }),
]);
export type Selection = z.infer<typeof SelectionSchema>;

/**
 * Resolve a selection to ordered lead ids.
 *
 * `extraWhere` is how each action adds its own non-negotiable requirement — a
 * send needs an email address and no unsubscribe — so those leads are dropped
 * here, before anything is counted or confirmed, rather than failing one at a
 * time mid-run. Returns the ids plus how many the selection lost that way, which
 * is what the confirm dialog has to say out loud.
 */
export async function resolveSelection(
  selection: Selection,
  opts: { extraWhere?: Prisma.LeadWhereInput; orderBy?: Prisma.LeadOrderByWithRelationInput } = {},
): Promise<{ ids: string[]; requested: number; skipped: number }> {
  const base: Prisma.LeadWhereInput =
    "ids" in selection ? { id: { in: selection.ids } } : leadWhere(selection.filter);

  // The count before the action's own requirement is applied. For an id list this
  // is what was ticked; for a filter it is what the table showed.
  const requested =
    "ids" in selection ? selection.ids.length : await prisma.lead.count({ where: base });

  const rows = await prisma.lead.findMany({
    where: opts.extraWhere ? { AND: [base, opts.extraWhere] } : base,
    // Stable order so a capped run takes the best leads first, and so a re-run
    // after a cap resumes predictably rather than reshuffling.
    orderBy: opts.orderBy ?? [{ score: "desc" }, { id: "asc" }],
    select: { id: true },
    take: 500,
  });

  return { ids: rows.map((r) => r.id), requested, skipped: Math.max(0, requested - rows.length) };
}
