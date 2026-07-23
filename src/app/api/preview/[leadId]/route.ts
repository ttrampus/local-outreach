// POST /api/preview/:leadId — generate a single-page site from data we already
// have and capture a hero screenshot (the cheap artifact). Does NOT deploy.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildAndStorePreview } from "@/lib/preview/generate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180; // bespoke AI generation streams a full HTML doc

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ leadId: string }> },
) {
  const { leadId } = await params;
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { searchRun: true },
  });
  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  try {
    const updated = await buildAndStorePreview(lead);
    return NextResponse.json({ lead: updated });
  } catch (err) {
    return NextResponse.json(
      { error: `Preview generation failed: ${(err as Error).message}` },
      { status: 500 },
    );
  }
}
