// POST /api/deploy/:leadId — opt-in, manual deploy of a lead's generated site.
// Requires a preview to have been generated first (we deploy the stored HTML).
import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { deploySite, attachDomain, DeployError, type DomainResult } from "@/lib/deploy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Optionally attach a real custom domain (e.g. mojfrizer.si) so the €50/mo site
// isn't a *.vercel.app subdomain. We return the DNS records the owner must set.
const BodySchema = z.object({ customDomain: z.string().trim().min(3).optional() });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ leadId: string }> },
) {
  const denied = await requireSession();
  if (denied) return denied;

  const { leadId } = await params;
  const body = BodySchema.safeParse(await req.json().catch(() => ({})));
  const customDomain = body.success ? body.data.customDomain : undefined;

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

    // Attach the custom domain if requested. A domain failure shouldn't undo a
    // successful deploy — surface it as a warning alongside the live URL.
    let domain: DomainResult | null = null;
    let domainError: string | null = null;
    if (customDomain) {
      try {
        domain = await attachDomain(name, customDomain);
      } catch (err) {
        domainError = (err as Error).message;
      }
    }

    const updated = await prisma.lead.update({
      where: { id: lead.id },
      data: {
        deployedUrl,
        status: "deployed",
        ...(domain ? { customDomain: domain.domain } : {}),
      },
    });
    return NextResponse.json({ lead: updated, domain, domainError });
  } catch (err) {
    const status = err instanceof DeployError ? 400 : 500;
    return NextResponse.json(
      { error: `Deploy failed: ${(err as Error).message}` },
      { status },
    );
  }
}
