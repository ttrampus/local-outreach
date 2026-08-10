// POST /api/followups/:id — act on a single scheduled follow-up.
//   { action: "send" } — deliver it now (a real SMTP/Twilio send, or a compose
//                        link for the assisted channels), mark it sent, and
//                        schedule the next step. Re-checks the signal gate
//                        server-side so a follow-up can never go to a prospect who
//                        has since replied or shown interest.
//   { action: "mark-sent" } — record a touch made outside the app; no delivery.
//   { action: "skip" } — drop this step but keep the sequence moving (schedule next).
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { deliverOutreach, markSentByHand } from "@/lib/outreach/send";
import { isSequencePaused, pauseReason, scheduleNextFollowup } from "@/lib/outreach/followups";

import { requireSession } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({ action: z.enum(["send", "mark-sent", "skip"]) });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireSession();
  if (denied) return denied;

  const { id } = await params;
  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const followup = await prisma.outreach.findUnique({
    where: { id },
    include: {
      lead: { select: { status: true, repliedAt: true, interestedAt: true } },
    },
  });
  if (!followup) return NextResponse.json({ error: "Follow-up not found" }, { status: 404 });
  if (followup.status !== "queued") {
    return NextResponse.json(
      { error: `This follow-up is "${followup.status}", not pending.` },
      { status: 409 },
    );
  }

  if (parsed.data.action === "skip") {
    await prisma.outreach.update({ where: { id }, data: { status: "skipped" } });
    await scheduleNextFollowup(followup.leadId);
    return NextResponse.json({ ok: true, skipped: true });
  }

  // Gate: never nudge a prospect who has already engaged.
  if (isSequencePaused(followup.lead)) {
    return NextResponse.json(
      { error: `Sequence paused (${pauseReason(followup.lead)}). This follow-up won't be sent.` },
      { status: 409 },
    );
  }

  const result =
    parsed.data.action === "send" ? await deliverOutreach(id) : await markSentByHand(id);
  if (!result.ok) {
    return NextResponse.json(
      { error: `Send failed: ${result.error ?? "unknown error"}` },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true, delivery: result });
}
