// GET /p/:leadId — the public, shareable, full-screen preview of a lead's generated
// site. This is the clean link you drop into outreach (yourapp.com/p/<leadId>); it
// serves the stored HTML as-is, animations and all. No Google SKU is touched.
import { readFile } from "node:fs/promises";
import { prisma } from "@/lib/prisma";
import { injectOwnerBar } from "@/lib/preview/ownerBar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ leadId: string }> },
) {
  const { leadId } = await params;
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, name: true, address: true, previewHtmlPath: true, firstViewedAt: true },
  });

  if (!lead?.previewHtmlPath) {
    return new Response("This preview isn't available yet.", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  let html: string;
  try {
    html = await readFile(lead.previewHtmlPath, "utf8");
  } catch {
    return new Response("This preview is no longer available.", {
      status: 410,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  // Record the open so a viewed-but-silent lead becomes a known-warm lead. Best
  // effort — a tracking write must never break serving the preview.
  try {
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        previewViews: { increment: 1 },
        lastViewedAt: new Date(),
        ...(lead.firstViewedAt ? {} : { firstViewedAt: new Date() }),
      },
    });
  } catch {
    /* ignore */
  }

  return new Response(injectOwnerBar(html, lead), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
