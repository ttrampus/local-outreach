// GET /api/analytics — aggregate funnel metrics for the dashboard.
import { NextResponse } from "next/server";
import { computeAnalytics } from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await computeAnalytics());
}
