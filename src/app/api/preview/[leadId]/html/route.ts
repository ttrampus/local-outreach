// GET /api/preview/:leadId/html — serve the lead's generated single-page site as
// live, interactive HTML (animations and all). This is what the dashboard's "Live"
// preview iframe loads; the PNG screenshot is the static fallback/outreach artifact.
// The HTML is read from the on-disk file written by the preview step (data/previews),
// so this never re-bills any Google SKU.
import { readFile } from "node:fs/promises";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ leadId: string }> },
) {
  const { leadId } = await params;
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { previewHtmlPath: true },
  });

  if (!lead?.previewHtmlPath) {
    return new Response("No preview generated for this lead yet.", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  let html: string;
  try {
    html = await readFile(lead.previewHtmlPath, "utf8");
  } catch {
    // DB points at a file that's gone (e.g. cleared on disk) — regenerate to fix.
    return new Response("Preview file missing on disk — regenerate the preview.", {
      status: 410,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      // Never cache: a regenerate should be reflected immediately in the iframe.
      "cache-control": "no-store",
    },
  });
}
