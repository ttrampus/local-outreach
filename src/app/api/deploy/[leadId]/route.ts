// POST /api/deploy/:leadId — opt-in, manual deploy of a lead's generated site.
// Requires a preview to have been generated first (we deploy the stored HTML).
import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { prisma } from "@/lib/prisma";
import { deploySite, DeployError } from "@/lib/deploy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ leadId: string }> },
) {
  const { leadId } = await params;
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  if (!lead.previewHtmlPath) {
    return NextResponse.json(
      { error: "Generate a preview first — there is no site HTML to deploy." },
      { status: 409 },
    );
  }

  let html: string;
  try {
    html = await readFile(lead.previewHtmlPath, "utf8");
  } catch {
    return NextResponse.json(
      { error: "Stored preview HTML is missing. Regenerate the preview." },
      { status: 409 },
    );
  }

  const name = `lead-${lead.placeId}`.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 52);

  try {
    const deployedUrl = await deploySite({ name, html });
    const updated = await prisma.lead.update({
      where: { id: lead.id },
      data: { deployedUrl, status: "deployed" },
    });
    return NextResponse.json({ lead: updated });
  } catch (err) {
    const status = err instanceof DeployError ? 400 : 500;
    return NextResponse.json(
      { error: `Deploy failed: ${(err as Error).message}` },
      { status },
    );
  }
}
