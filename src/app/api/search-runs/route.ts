// GET /api/search-runs — recent discovery runs with their counts/status.
// Polled by the search page to show live progress.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const runs = await prisma.searchRun.findMany({
    orderBy: { createdAt: "desc" },
    take: 25,
  });
  return NextResponse.json({ runs });
}
