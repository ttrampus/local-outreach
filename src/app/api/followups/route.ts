// GET /api/followups — the follow-up work queue: scheduled follow-ups bucketed into
// due (ready to send now, prospect hasn't engaged), upcoming, and paused (prospect
// replied / showed interest / converted, so the sequence stopped). Read-only.
import { NextResponse } from "next/server";
import { listFollowups } from "@/lib/outreach/followups";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const buckets = await listFollowups();
  return NextResponse.json({
    ...buckets,
    counts: {
      due: buckets.due.length,
      upcoming: buckets.upcoming.length,
      paused: buckets.paused.length,
    },
  });
}
