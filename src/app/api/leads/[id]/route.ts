// GET /api/leads/:id — one lead with its outreach, for refreshing the detail
// panel after preview/draft/deploy actions.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: { outreach: { orderBy: { updatedAt: "desc" } } },
  });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  return NextResponse.json({ lead });
}
