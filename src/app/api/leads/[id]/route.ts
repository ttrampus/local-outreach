// GET /api/leads/:id — one lead with its outreach, for refreshing the detail
// panel after preview/draft/deploy actions.
// PATCH /api/leads/:id — operator-driven funnel transitions:
//   { action: "replied" } — prospect replied; records repliedAt, which PAUSES the
//                           follow-up sequence (the operator takes the thread over).
//   { action: "lost" }    — close the lead out (also pauses follow-ups).
//   { action: "reopen" }  — clear repliedAt / lost so the sequence can resume.
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

import { requireSession } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireSession();
  if (denied) return denied;

  const { id } = await params;
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      outreach: { orderBy: { updatedAt: "desc" } },
      siteMessages: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  return NextResponse.json({ lead });
}

// Either a funnel transition, or the portfolio flag, or both. `showcase` is not
// a funnel action — a lead can be featured on /examples at any stage — so it
// rides alongside rather than joining the enum.
const PatchSchema = z
  .object({
    action: z.enum(["replied", "lost", "reopen"]).optional(),
    showcase: z.boolean().optional(),
  })
  .refine((v) => v.action !== undefined || v.showcase !== undefined, {
    message: "Nothing to update",
  });

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireSession();
  if (denied) return denied;

  const { id } = await params;
  const parsed = PatchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const lead = await prisma.lead.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const data: Record<string, unknown> = {};

  if (parsed.data.showcase !== undefined) data.showcase = parsed.data.showcase;

  switch (parsed.data.action) {
    case "replied":
      data.repliedAt = new Date();
      // A reply is engagement; surface it as "interested" unless already further along.
      if (!["customer", "deployed", "lost"].includes(lead.status)) data.status = "interested";
      break;
    case "lost":
      data.status = "lost";
      break;
    case "reopen":
      data.repliedAt = null;
      if (lead.status === "lost") data.status = "sent";
      break;
  }

  const updated = await prisma.lead.update({ where: { id }, data });
  return NextResponse.json({ lead: updated });
}
