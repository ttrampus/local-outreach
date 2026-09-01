// The follow-up engine. Drafting already produces a 3-message sequence (step 0 +
// two queued follow-ups); this is what actually surfaces those follow-ups for
// sending — and, crucially, GATES them on prospect signals. Most replies to cold
// outreach come from a follow-up, but nudging someone who already replied or raised
// their hand is worse than not following up at all. So a sequence is paused the
// moment the prospect engages, and follow-ups only ever appear when they're both
// due (enough time has passed) and still warranted.
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

/** Lead fields needed to decide whether its sequence should keep running. */
export interface SequenceGate {
  status: string;
  repliedAt: Date | null;
  interestedAt: Date | null;
  unsubscribedAt: Date | null;
}

// Once a prospect engages we stop nudging: a reply means the operator takes over;
// interest/conversion means the conversation has moved past cold follow-ups.
const ENGAGED_STATUSES = new Set(["interested", "customer", "deployed", "lost"]);

/** True when a lead's follow-up sequence must not advance (prospect has engaged). */
export function isSequencePaused(lead: SequenceGate): boolean {
  return (
    lead.unsubscribedAt != null ||
    lead.repliedAt != null ||
    lead.interestedAt != null ||
    ENGAGED_STATUSES.has(lead.status)
  );
}

/** Why a sequence is paused, for display. */
export function pauseReason(lead: SequenceGate): string | null {
  // First, and never overridden: the others describe how a conversation is going,
  // this one says there is not to be a conversation.
  if (lead.unsubscribedAt) return "unsubscribed";
  if (lead.repliedAt) return "replied";
  if (lead.interestedAt) return "interested";
  if (lead.status === "customer" || lead.status === "deployed") return "customer";
  if (lead.status === "lost") return "lost";
  if (lead.status === "interested") return "interested";
  return null;
}

const DAY_MS = 86_400_000;

/**
 * Schedule the next queued follow-up for a lead — called right after a message in
 * the sequence is sent. Sets scheduledAt on the lowest-step queued follow-up that
 * isn't scheduled yet, so steps cascade one at a time (step 1 becomes due N days
 * after step 0 is sent, step 2 N days after step 1, …). No-op if none remain.
 */
export async function scheduleNextFollowup(leadId: string): Promise<void> {
  const next = await prisma.outreach.findFirst({
    where: { leadId, status: "queued", scheduledAt: null },
    orderBy: { step: "asc" },
  });
  if (!next) return;
  await prisma.outreach.update({
    where: { id: next.id },
    data: { scheduledAt: new Date(Date.now() + env.followupIntervalDays * DAY_MS) },
  });
}

export interface FollowupItem {
  id: string;
  leadId: string;
  leadName: string;
  tier: string;
  step: number;
  subject: string | null;
  body: string;
  channel: string;
  contact: string | null;
  scheduledAt: Date | null;
  dueInDays: number; // negative = overdue
}

export interface FollowupBuckets {
  due: FollowupItem[]; // ready to send now, prospect hasn't engaged
  upcoming: FollowupItem[]; // scheduled for the future
  paused: (FollowupItem & { reason: string })[]; // prospect engaged — sequence stopped
}

/**
 * All scheduled follow-ups, bucketed into due / upcoming / paused. "Due" is the
 * operator's work queue; "paused" is shown so it's obvious why a sequence stopped.
 */
export async function listFollowups(): Promise<FollowupBuckets> {
  const rows = await prisma.outreach.findMany({
    where: { status: "queued", scheduledAt: { not: null } },
    orderBy: { scheduledAt: "asc" },
    include: {
      lead: {
        select: {
          id: true,
          name: true,
          tier: true,
          status: true,
          repliedAt: true,
          interestedAt: true,
          unsubscribedAt: true,
        },
      },
    },
  });

  const now = Date.now();
  const due: FollowupItem[] = [];
  const upcoming: FollowupItem[] = [];
  const paused: (FollowupItem & { reason: string })[] = [];

  for (const r of rows) {
    const item: FollowupItem = {
      id: r.id,
      leadId: r.leadId,
      leadName: r.lead.name,
      tier: r.lead.tier,
      step: r.step,
      subject: r.subject,
      body: r.body,
      channel: r.channel,
      contact: r.contact,
      scheduledAt: r.scheduledAt,
      dueInDays: r.scheduledAt
        ? Math.round((r.scheduledAt.getTime() - now) / DAY_MS)
        : 0,
    };

    if (isSequencePaused(r.lead)) {
      paused.push({ ...item, reason: pauseReason(r.lead) ?? "engaged" });
    } else if (r.scheduledAt && r.scheduledAt.getTime() <= now) {
      due.push(item);
    } else {
      upcoming.push(item);
    }
  }

  return { due, upcoming, paused };
}
