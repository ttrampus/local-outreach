// GET /api/analytics — aggregate funnel metrics for the dashboard.
import { NextResponse } from "next/server";
import { computeAnalytics } from "@/lib/analytics";

import { requireSession } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireSession();
  if (denied) return denied;

  return NextResponse.json(await computeAnalytics());
}
