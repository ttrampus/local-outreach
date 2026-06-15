// POST /api/preview/:leadId — generate a single-page site from data we already
// have and capture a hero screenshot (the cheap artifact). Does NOT deploy.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCachedDetails } from "@/lib/places";
import { generateSiteHtml } from "@/lib/preview/template";
import { renderPreview } from "@/lib/preview/render";
import type { NormalizedPlaceDetails } from "@/lib/leadSource/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

  // Prefer the cached normalized details (has review snippets + categories);
  // fall back to the flat Lead fields if the cache row is missing.
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

  try {
    const html = generateSiteHtml(details, lead.searchRun?.query ?? "");
    const { imagePath, htmlPath } = await renderPreview(lead.placeId, html);

    const updated = await prisma.lead.update({
      where: { id: lead.id },
      data: {
        previewImagePath: imagePath,
        previewHtmlPath: htmlPath,
        // Advance the funnel only if we haven't moved past this stage already.
        status: lead.status === "discovered" ? "preview_ready" : lead.status,
      },
    });
    return NextResponse.json({ lead: updated });
  } catch (err) {
    return NextResponse.json(
      { error: `Preview generation failed: ${(err as Error).message}` },
      { status: 500 },
    );
  }
}
