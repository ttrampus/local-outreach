// Funnel analytics — the learning loop. The pipeline tracks plenty per lead but
// nothing aggregates it, so there's no way to answer the questions that actually
// steer the business: what share of leads get viewed, raise their hand, convert —
// and which categories / regions / tiers convert best, so discovery spend can be
// aimed. This computes that from the data already in the DB (no extra tracking).
import { prisma } from "@/lib/prisma";

const CUSTOMER_STATUSES = new Set(["customer", "deployed"]);
const PAYING_SUBSCRIPTION = new Set(["active", "paid", "trialing"]);

export interface FunnelStep {
  stage: string;
  count: number;
  /** Conversion from the previous step, 0–1 (null for the first step). */
  fromPrev: number | null;
  /** Conversion from the very top of the funnel, 0–1. */
  ofTotal: number;
}

export interface Segment {
  label: string;
  leads: number;
  sent: number;
  interested: number;
  customers: number;
  /** interested / sent, 0–1 (null when nothing sent). */
  replyRate: number | null;
  /** customers / leads, 0–1. */
  winRate: number;
}

export interface Analytics {
  totals: {
    leads: number;
    withEmail: number;
    previews: number;
    sent: number;
    viewed: number;
    interested: number;
    replied: number;
    customers: number;
    previewViews: number;
  };
  funnel: FunnelStep[];
  byTier: Segment[];
  byCategory: Segment[];
  byRegion: Segment[];
}

interface LeadLite {
  tier: string;
  status: string;
  previewImagePath: string | null;
  previewViews: number;
  interestedAt: Date | null;
  repliedAt: Date | null;
  email: string | null;
  subscriptionStatus: string | null;
  query: string;
  location: string;
  sent: boolean;
}

function isCustomer(l: { status: string; subscriptionStatus: string | null }): boolean {
  return (
    CUSTOMER_STATUSES.has(l.status) ||
    PAYING_SUBSCRIPTION.has((l.subscriptionStatus ?? "").toLowerCase())
  );
}

// A lead "engaged" if it replied or raised its hand on the preview.
function isInterested(l: { interestedAt: Date | null; repliedAt: Date | null }): boolean {
  return l.interestedAt != null || l.repliedAt != null;
}

const div = (a: number, b: number): number => (b > 0 ? a / b : 0);

/** Roll a set of leads up into one segment row. */
function segment(label: string, leads: LeadLite[]): Segment {
  const sent = leads.filter((l) => l.sent).length;
  const interested = leads.filter(isInterested).length;
  const customers = leads.filter(isCustomer).length;
  return {
    label,
    leads: leads.length,
    sent,
    interested,
    customers,
    replyRate: sent > 0 ? div(interested, sent) : null,
    winRate: div(customers, leads.length),
  };
}

/** Group leads by a key, build a segment per group, drop tiny groups, sort by size. */
function groupSegments(leads: LeadLite[], key: (l: LeadLite) => string, minLeads = 1): Segment[] {
  const groups = new Map<string, LeadLite[]>();
  for (const l of leads) {
    const k = key(l).trim() || "—";
    const arr = groups.get(k) ?? [];
    arr.push(l);
    groups.set(k, arr);
  }
  return [...groups.entries()]
    .map(([label, ls]) => segment(label, ls))
    .filter((s) => s.leads >= minLeads)
    .sort((a, b) => b.leads - a.leads);
}

export async function computeAnalytics(): Promise<Analytics> {
  const [full, sentRows] = await Promise.all([
    prisma.lead.findMany({
      select: {
        id: true,
        tier: true,
        status: true,
        previewImagePath: true,
        previewViews: true,
        interestedAt: true,
        repliedAt: true,
        email: true,
        subscriptionStatus: true,
        searchRun: { select: { query: true, location: true } },
      },
    }),
    prisma.outreach.findMany({
      where: { status: "sent" },
      select: { leadId: true },
      distinct: ["leadId"],
    }),
  ]);

  const sentLeadIds = new Set(sentRows.map((r) => r.leadId));

  const leads: LeadLite[] = full.map((l) => ({
    tier: l.tier,
    status: l.status,
    previewImagePath: l.previewImagePath,
    previewViews: l.previewViews,
    interestedAt: l.interestedAt,
    repliedAt: l.repliedAt,
    email: l.email,
    subscriptionStatus: l.subscriptionStatus,
    query: l.searchRun?.query ?? "—",
    location: l.searchRun?.location ?? "—",
    sent: sentLeadIds.has(l.id),
  }));

  const total = leads.length;
  const previews = leads.filter((l) => l.previewImagePath != null).length;
  const sent = leads.filter((l) => l.sent).length;
  const viewed = leads.filter((l) => l.previewViews > 0).length;
  const interested = leads.filter(isInterested).length;
  const replied = leads.filter((l) => l.repliedAt != null).length;
  const customers = leads.filter(isCustomer).length;

  // The funnel is built from concrete signals, not just status order, so a lead that
  // (say) was viewed but whose status lagged still counts as viewed.
  const stages: { stage: string; count: number }[] = [
    { stage: "Leads", count: total },
    { stage: "Preview built", count: previews },
    { stage: "Sent", count: sent },
    { stage: "Viewed", count: viewed },
    { stage: "Interested", count: interested },
    { stage: "Customer", count: customers },
  ];
  const funnel: FunnelStep[] = stages.map((s, i) => ({
    stage: s.stage,
    count: s.count,
    fromPrev: i === 0 ? null : div(s.count, stages[i - 1].count),
    ofTotal: div(s.count, total),
  }));

  return {
    totals: {
      leads: total,
      withEmail: leads.filter((l) => l.email).length,
      previews,
      sent,
      viewed,
      interested,
      replied,
      customers,
      previewViews: leads.reduce((acc, l) => acc + l.previewViews, 0),
    },
    funnel,
    byTier: ["HOT", "WARM", "COLD"]
      .map((t) => segment(t, leads.filter((l) => l.tier === t)))
      .filter((s) => s.leads > 0),
    byCategory: groupSegments(leads, (l) => l.query),
    byRegion: groupSegments(leads, (l) => l.location),
  };
}
