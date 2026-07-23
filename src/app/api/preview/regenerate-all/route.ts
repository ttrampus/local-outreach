// POST /api/preview/regenerate-all — rebuild every existing preview against the
// current template (e.g. to pick up new animations). Free: photos are read from
// the on-disk cache, no Google SKU is re-billed. The work runs sequentially in the
// background (each render launches a headless browser); we respond immediately with
// how many leads were queued, like /api/discover.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { regenerateExistingPreviews } from "@/lib/preview/generate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const queued = await prisma.lead.count({ where: { previewHtmlPath: { not: null } } });
  if (queued === 0) {
    return NextResponse.json({ queued: 0 });
  }

  // Fire-and-forget: never block the response on a multi-minute batch.
  void regenerateExistingPreviews().catch((err) =>
    console.error("[regenerate-all] batch crashed:", err),
  );

  return NextResponse.json({ queued }, { status: 202 });
}
