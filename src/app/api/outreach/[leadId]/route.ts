// Per-lead outreach actions. The model is "one active draft per lead":
//   POST  /api/outreach/:leadId  — (re)generate a draft (replaces any prior draft)
//   PATCH /api/outreach/:leadId  — edit fields, or transition via { action }
//
// Sending is an explicit, separate action (PATCH { action: "send" }) — never
// automatic and never bulk. The UI gates it behind a confirm step.
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCachedDetails } from "@/lib/places";
import { buildDraft } from "@/lib/outreach/draft";
import { generateOutreachWithClaude } from "@/lib/outreach/claude";
import { deliverOutreach, markSentByHand } from "@/lib/outreach/send";
import { isSmsConfigured } from "@/lib/outreach/sms";
import { env } from "@/lib/env";
import type { NormalizedPlaceDetails } from "@/lib/leadSource/types";

import { requireSession } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadLead(leadId: string) {
  return prisma.lead.findUnique({ where: { id: leadId }, include: { searchRun: true } });
}

// POST — generate (or regenerate) the lead's draft.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ leadId: string }> },
) {
  const denied = await requireSession();
  if (denied) return denied;

  const { leadId } = await params;
  const lead = await loadLead(leadId);
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const details: NormalizedPlaceDetails =
    (await getCachedDetails(lead.placeId)) ?? {
      placeId: lead.placeId,
      name: lead.name,
      address: lead.address ?? undefined,
      phone: lead.phone ?? undefined,
      website: lead.website ?? undefined,
      rating: lead.rating ?? undefined,
      reviewCount: lead.reviewCount,
      photoCount: lead.photoCount,
      reviewSnippets: [],
      categories: [],
    };

  // Prefer a Claude-drafted message (native language, references the live preview
  // link); fall back to the deterministic template when no key / refusal / error.
  const previewUrl = `${env.appBaseUrl}/p/${lead.id}`;
  const draft =
    (await generateOutreachWithClaude(lead, details, previewUrl)) ??
    buildDraft(lead, details, lead.searchRun?.query ?? "", {
      // SMS is only worth picking when it can actually be delivered; without
      // Twilio a phone number is better spent on a DM or a call.
      smsEnabled: isSmsConfigured(),
      previewUrl,
    });

  // Replace any existing *unsent* messages (the editable initial draft plus queued
  // follow-ups); sent history is kept intact. Step 0 is the editable/sendable draft;
  // steps 1+ are queued follow-ups, stored as reference for when there's no reply.
  await prisma.outreach.deleteMany({
    where: { leadId: lead.id, status: { in: ["draft", "approved", "queued"] } },
  });
  const created = [];
  for (const m of draft.messages) {
    created.push(
      await prisma.outreach.create({
        data: {
          leadId: lead.id,
          channel: draft.channel,
          contact: draft.contact,
          subject: m.subject,
          body: m.body,
          step: m.step,
          status: m.step === 0 ? "draft" : "queued",
        },
      }),
    );
  }
  const primary = created.find((c) => c.step === 0) ?? created[0];

  // Advance funnel to "drafted" unless already further along.
  if (["discovered", "preview_ready"].includes(lead.status)) {
    await prisma.lead.update({ where: { id: lead.id }, data: { status: "drafted" } });
  }

  return NextResponse.json({ outreach: primary, sequence: created });
}

const PatchSchema = z.object({
  body: z.string().min(1).optional(),
  subject: z.string().optional(),
  channel: z.string().optional(),
  contact: z.string().nullable().optional(),
  action: z.enum(["approve", "send", "mark-sent", "unapprove"]).optional(),
  // Set by the pre-send checklist in OutreachReview. Required to approve.
  reviewed: z.boolean().optional(),
});

// PATCH — edit the current draft and/or transition its status.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ leadId: string }> },
) {
  const denied = await requireSession();
  if (denied) return denied;

  const { leadId } = await params;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = PatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Operate on the lead's most recent non-sent outreach record.
  const current = await prisma.outreach.findFirst({
    where: { leadId, status: { in: ["draft", "approved"] } },
    orderBy: { updatedAt: "desc" },
  });
  if (!current) {
    return NextResponse.json(
      { error: "No editable draft for this lead. Generate one first." },
      { status: 404 },
    );
  }

  const { body, subject, channel, contact, action, reviewed } = parsed.data;
  const data: Record<string, unknown> = {};
  if (body !== undefined) data.body = body;
  if (subject !== undefined) data.subject = subject;
  if (channel !== undefined) data.channel = channel;
  if (contact !== undefined) data.contact = contact;

  // Sending is special: persist any final edits first, then hand off to the shared
  // delivery path (real SMTP send when configured, else a Gmail compose link),
  // which marks it sent, advances the lead, and schedules the first follow-up.
  // "mark-sent" is the same bookkeeping without any delivery — for a touch the
  // operator made outside the app. It goes through the same approval gate, because
  // the checklist is about what the prospect sees, not about who pressed send.
  if (action === "send" || action === "mark-sent") {
    if (current.status !== "approved") {
      return NextResponse.json(
        { error: "Approve the message before sending." },
        { status: 409 },
      );
    }
    if (Object.keys(data).length) {
      await prisma.outreach.update({ where: { id: current.id }, data });
    }
    const result =
      action === "send" ? await deliverOutreach(current.id) : await markSentByHand(current.id);
    if (!result.ok) {
      return NextResponse.json(
        { error: `Send failed: ${result.error ?? "unknown error"}` },
        { status: 502 },
      );
    }
    const outreach = await prisma.outreach.findUnique({ where: { id: current.id } });
    return NextResponse.json({ outreach, delivery: result });
  }

  let leadStatus: string | null = null;
  if (action === "approve") {
    // Enforced here and not only in the UI. A disabled button is a convenience;
    // this is the actual gate. Sending a site with the wrong phone number costs
    // the prospect's trust permanently, and the check takes half a minute.
    if (reviewed !== true) {
      return NextResponse.json(
        { error: "Complete the pre-send checklist before approving." },
        { status: 409 },
      );
    }
    data.status = "approved";
    data.reviewedAt = new Date();
    leadStatus = "approved";
  } else if (action === "unapprove") {
    data.status = "draft";
    // Back to draft means the message is about to change, so the previous
    // review no longer describes what would be sent.
    data.reviewedAt = null;
  }

  const outreach = await prisma.outreach.update({ where: { id: current.id }, data });
  if (leadStatus) {
    await prisma.lead.update({ where: { id: leadId }, data: { status: leadStatus } });
  }

  return NextResponse.json({ outreach });
}
