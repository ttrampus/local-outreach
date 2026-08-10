// POST /api/followups/auto — run one auto-send pass NOW: deliver every due email
// follow-up (the same pass the AUTO_SEND_FOLLOWUPS timer runs on an interval).
// Requires SMTP; without it the pass reports ran:false and sends nothing, so this
// can never silently mark undelivered messages as sent.
import { NextResponse } from "next/server";
import { sendDueFollowups } from "@/lib/outreach/autoSend";

import { requireSession } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const denied = await requireSession();
  if (denied) return denied;

  const result = await sendDueFollowups();
  return NextResponse.json(result, { status: result.ran ? 200 : 409 });
}
