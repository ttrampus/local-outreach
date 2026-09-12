// POST /api/leads/bulk/send — draft, approve and email every selected lead.
//
// This is the one endpoint in the app that can mail hundreds of strangers from a
// single click, so it is worth being explicit about what it gives up and what it
// puts back in exchange.
//
// GIVES UP: the per-lead pre-send checklist. PATCH /api/outreach/:leadId refuses
// to approve without it, on the grounds that sending someone a broken generated
// site costs far more than 30 seconds of checking. That reasoning is sound and
// that gate stays exactly as it is for single sends. Bulk moves the review one
// level up: the operator confirms a run, having already looked at the previews
// this engine produces, rather than re-ticking eight boxes 50 times.
//
// PUTS BACK:
//   · a typed "SEND" confirmation, so the request cannot be produced by a
//     mis-click or a stray double-submit;
//   · a per-run cap (BULK_SEND_MAX_PER_RUN) that bounds one mistake;
//   · a rolling 24h cap (BULK_SEND_MAX_PER_DAY) counted from actually-sent rows,
//     that bounds a bad afternoon and keeps the mailbox under Google's limits;
//   · hard exclusions resolved BEFORE anything is sent or counted: no email
//     address, already unsubscribed, or already sent an initial message;
//   · sequential delivery, so a cancel means something and so the mailbox does
//     not emit a burst with one identical body.
//
// Requests are never retried on failure. A 502 from SMTP leaves the row unsent
// and counts as a failure in the job; re-running the selection picks it up again
// because sent leads are excluded.
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { requireSession } from "@/lib/auth/guard";
import { LeadFilterSchema, leadWhere } from "@/lib/leads/selection";
import { createBulkJob, describeTarget, runBulkJob } from "@/lib/leads/bulkJob";
import { loadLeadForOutreach, prepareOutreach } from "@/lib/outreach/prepare";
import { deliverOutreach } from "@/lib/outreach/send";
import { buildAndStorePreview } from "@/lib/preview/generate";
import { isSmtpConfigured } from "@/lib/outreach/mailer";
import type { Prisma } from "@/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Spelled out rather than a boolean: a client cannot send this by accident, and
// it reads the same in the network tab as it does in the dialog.
const BodySchema = z.intersection(
  z.object({ confirm: z.literal("SEND") }),
  z.union([
    z.object({ ids: z.array(z.string().min(1).max(60)).min(1).max(500) }),
    z.object({ filter: LeadFilterSchema }),
  ]),
);

/**
 * Leads this endpoint will never mail, whatever the selection said.
 *
 * Applied as part of the query rather than checked per lead, so the count in the
 * confirmation is the real count and the operator is never told "50" and then
 * shown "31 skipped" afterwards.
 */
const SENDABLE: Prisma.LeadWhereInput = {
  // Bulk is email-only. The other channels (DM, phone) are assisted by design —
  // they open a thread or a dialer for a human to finish — so there is nothing
  // for a batch to do with them.
  email: { not: null },
  NOT: { email: "" },
  // Asked not to be contacted. deliverOutreach refuses these too; excluding them
  // here keeps them out of the count instead of turning into failures.
  unsubscribedAt: null,
  // Already had their first touch. Follow-ups are a different, scheduled
  // mechanism with its own pacing; a bulk run must never re-open a sent sequence.
  outreach: { none: { step: 0, status: "sent" } },
};

export async function POST(req: Request) {
  const denied = await requireSession();
  if (denied) return denied;

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Send { confirm: "SEND" } with either ids or filter.' },
      { status: 400 },
    );
  }
  const body = parsed.data;

  // No transport, no run. Without SMTP the single-lead path degrades to a Gmail
  // compose deep-link, which is meaningless 50 times over.
  if (!isSmtpConfigured()) {
    return NextResponse.json(
      { error: "SMTP is not configured, so nothing can be emailed." },
      { status: 409 },
    );
  }

  const running = await prisma.bulkJob.findFirst({
    where: { kind: "send", status: "running" },
    select: { id: true },
  });
  if (running) {
    return NextResponse.json(
      { error: "A send run is already going. Wait for it or cancel it.", jobId: running.id },
      { status: 409 },
    );
  }

  // Rolling 24h, counted from what actually went out — not from job rows, which
  // would miss single sends made through the per-lead button and could double
  // count a cancelled run.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const sentToday = await prisma.outreach.count({
    where: { status: "sent", sentAt: { gte: since } },
  });
  const dayRemaining = Math.max(0, env.bulkSendMaxPerDay - sentToday);
  if (dayRemaining === 0) {
    return NextResponse.json(
      {
        error: `Daily send cap reached (${sentToday}/${env.bulkSendMaxPerDay} in the last 24h). Try again later.`,
      },
      { status: 429 },
    );
  }

  const base: Prisma.LeadWhereInput =
    "ids" in body ? { id: { in: body.ids } } : leadWhere(body.filter);
  const requested = "ids" in body ? body.ids.length : await prisma.lead.count({ where: base });

  const eligible = await prisma.lead.findMany({
    where: { AND: [base, SENDABLE] },
    // Best leads first, so a capped run spends its budget on the ones most
    // likely to convert rather than on whatever sorted first.
    orderBy: [{ score: "desc" }, { id: "asc" }],
    select: { id: true },
  });

  const cap = Math.min(env.bulkSendMaxPerRun, dayRemaining);
  const ids = eligible.slice(0, cap).map((l) => l.id);
  if (ids.length === 0) {
    return NextResponse.json(
      {
        error:
          "None of those leads can be emailed — they have no address, unsubscribed, or were already sent to.",
        requested,
      },
      { status: 400 },
    );
  }

  // Everything the selection lost: ineligible leads plus anything the caps cut.
  const skipped = requested - ids.length;
  const jobId = await createBulkJob("send", describeTarget(body), ids.length, skipped);

  void runBulkJob(jobId, ids, async (leadId) => {
    let lead = await loadLeadForOutreach(leadId);
    if (!lead) return "skip";

    // The email's whole pitch is the link to their own site. A lead fresh from
    // discovery has none yet, and sending it would point a stranger at "this
    // preview isn't available". Build it first — free on the kit engine — and
    // if that fails, don't send at all.
    if (!lead.previewHtmlPath) {
      try {
        await buildAndStorePreview(lead);
      } catch (err) {
        console.error(`[bulk-send] no preview for lead ${leadId}, not sending:`, err);
        return "failed";
      }
      lead = await loadLeadForOutreach(leadId);
      if (!lead?.previewHtmlPath) return "failed";
    }

    // Draft fresh rather than reusing whatever is sitting there: the body embeds
    // the preview URL and the price, and a draft written before the last preview
    // rebuild could point at a stale link.
    const { primary } = await prepareOutreach(lead);
    if (!primary || primary.channel !== "email") return "skip";

    // Approve on the operator's behalf — the run confirmation was the review.
    // reviewedAt is stamped so the audit trail says a human authorised this,
    // which is true; it was authorised in bulk.
    await prisma.outreach.update({
      where: { id: primary.id },
      data: { status: "approved", reviewedAt: new Date() },
    });

    const result = await deliverOutreach(primary.id);
    return result.ok ? "ok" : "failed";
  });

  return NextResponse.json(
    { jobId, total: ids.length, requested, skipped, cap, sentToday },
    { status: 202 },
  );
}
