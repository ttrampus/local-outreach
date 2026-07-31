// GET /p/:leadId — the public, shareable, full-screen preview of a lead's generated
// site. This is the clean link you drop into outreach (yourapp.com/p/<leadId>); it
// serves the stored HTML as-is, animations and all. No Google SKU is touched.
import { readFile } from "node:fs/promises";
import { prisma } from "@/lib/prisma";
import { injectOwnerBar } from "@/lib/preview/ownerBar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ leadId: string }> },
) {
  const { leadId } = await params;

  // Reached from the public /examples portfolio rather than from this business's
  // own outreach email. Same page, but none of the per-lead signals apply.
  const fromShowcase =
    new URL(req.url).searchParams.get("src") === "examples";
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
  //
  // Skipped for portfolio traffic: those views are strangers browsing examples,
  // not the business opening its own proposal. Counting them would make every
  // showcased lead look hot and quietly corrupt the funnel in analytics.ts —
  // which is the number the whole operation is steered by.
  if (!fromShowcase) {
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
  }

  return new Response(injectOwnerBar(html, lead, { showcase: fromShowcase }), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
