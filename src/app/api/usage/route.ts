// GET /api/usage — per-SKU API usage (today + this month) vs free-tier estimates.
import { NextResponse } from "next/server";
import { usageSummary } from "@/lib/usage";

import { requireSession } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireSession();
  if (denied) return denied;

  const usage = await usageSummary();
  return NextResponse.json({ usage });
}
