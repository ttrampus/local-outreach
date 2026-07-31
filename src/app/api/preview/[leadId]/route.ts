// POST /api/preview/:leadId — generate a single-page site from data we already
// have and capture a hero screenshot (the cheap artifact). Does NOT deploy.
//
// POST /api/preview/:leadId?reroll=1 additionally bumps the lead's art-direction
// seed, so a rebuild produces a genuinely different palette/composition/motion
// rather than reproducing the same one. Use it when a lead draws a direction that
// doesn't suit the business.
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { buildAndStorePreview } from "@/lib/preview/generate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180; // bespoke AI generation streams a full HTML doc

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> },
) {
  const denied = await requireSession();
  if (denied) return denied;

  const { leadId } = await params;
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { searchRun: true },
  });
  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  // Persisted by buildAndStorePreview alongside the rest of the preview state.
  if (req.nextUrl.searchParams.get("reroll")) {
    lead.previewVariant += 1;
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
