// POST /api/requalify — re-score all existing leads from their cached details.
// No Google API calls, no spend. Useful after changing the qualifier logic.
import { NextResponse } from "next/server";
import { requalifyAll } from "@/lib/discovery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const result = await requalifyAll();
  return NextResponse.json(result);
}
