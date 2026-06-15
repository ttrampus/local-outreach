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
import type { NormalizedPlaceDetails } from "@/lib/leadSource/types";

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

  const draft = buildDraft(lead, details, lead.searchRun?.query ?? "");

  // Replace any existing *unsent* draft; keep sent history intact.
  await prisma.outreach.deleteMany({ where: { leadId: lead.id, status: "draft" } });
  const outreach = await prisma.outreach.create({
    data: {
      leadId: lead.id,
      channel: draft.channel,
      contact: draft.contact,
      subject: draft.subject,
      body: draft.body,
      status: "draft",
    },
  });

  // Advance funnel to "drafted" unless already further along.
  if (["discovered", "preview_ready"].includes(lead.status)) {
    await prisma.lead.update({ where: { id: lead.id }, data: { status: "drafted" } });
  }

  return NextResponse.json({ outreach });
}

const PatchSchema = z.object({
  body: z.string().min(1).optional(),
  subject: z.string().optional(),
  channel: z.string().optional(),
  contact: z.string().nullable().optional(),
  action: z.enum(["approve", "send", "unapprove"]).optional(),
});

// PATCH — edit the current draft and/or transition its status.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ leadId: string }> },
) {
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

  const { body, subject, channel, contact, action } = parsed.data;
  const data: Record<string, unknown> = {};
  if (body !== undefined) data.body = body;
  if (subject !== undefined) data.subject = subject;
  if (channel !== undefined) data.channel = channel;
  if (contact !== undefined) data.contact = contact;

  let leadStatus: string | null = null;
  if (action === "approve") {
    data.status = "approved";
    leadStatus = "approved";
  } else if (action === "unapprove") {
    data.status = "draft";
  } else if (action === "send") {
    if (current.status !== "approved") {
      return NextResponse.json(
        { error: "Approve the message before sending." },
        { status: 409 },
      );
    }
    data.status = "sent";
    data.sentAt = new Date();
    leadStatus = "sent";
  }

  const outreach = await prisma.outreach.update({ where: { id: current.id }, data });
  if (leadStatus) {
    await prisma.lead.update({ where: { id: leadId }, data: { status: leadStatus } });
  }

  return NextResponse.json({ outreach });
}
