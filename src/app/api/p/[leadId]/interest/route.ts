// POST /api/p/:leadId/interest — a prospect tapped "I'm interested" on the public
// preview's owner bar. Records the intent (the strongest signal in the funnel) and
// advances the lead to "interested" so it surfaces for follow-up. Public + idempotent:
// it only ever flips flags forward, never reveals data, so it needs no auth.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Stages at/after conversion — never downgrade these back to "interested".
const TERMINAL = new Set(["customer", "deployed", "lost"]);

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ leadId: string }> },
) {
  const { leadId } = await params;
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, status: true, interestedAt: true },
  });
  if (!lead) return NextResponse.json({ ok: false }, { status: 404 });

  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      interestedAt: lead.interestedAt ?? new Date(),
      ...(TERMINAL.has(lead.status) ? {} : { status: "interested" }),
    },
  });

  return NextResponse.json({ ok: true });
}
