// POST /api/p/:leadId/interest — a prospect tapped "I'm interested" on the public
// preview's owner bar. Records the intent (the strongest signal in the funnel) and
// advances the lead to "interested" so it surfaces for follow-up. Idempotent: it
// only ever flips flags forward.
//
// Public, but NOT unauthenticated: the body must carry a short-lived token minted
// by the /p/ route that served the bar. A lead id is not a secret — /examples
// publishes one for every showcased preview — so without the token any visitor
// could mark real prospects as interested and quietly corrupt the only number
// this endpoint exists to produce.
//
// CORS-open like /api/site/, because /p/ is served with a CSP sandbox and so posts
// from an opaque origin. Safe: it writes one flag and reveals nothing, and the
// token is what actually authorises it.
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyInterestToken } from "@/lib/auth/interestToken";
import { clientKey } from "@/lib/auth/loginThrottle";
import { rateLimit } from "@/lib/http/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

// Stages at/after conversion — never downgrade these back to "interested".
const TERMINAL = new Set(["customer", "deployed", "lost"]);

const BodySchema = z.object({ token: z.string().max(500).optional() });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ leadId: string }> },
) {
  const { leadId } = await params;

  // Cheaper than the contact form (one flag, no mail) and already gated by the
  // token, so this is only here to stop a valid token being replayed into a write
  // loop. Generous enough that a prospect double-tapping the button never sees it.
  const limited = rateLimit("interest:ip", clientKey(req), 30, 10 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false },
      { status: 429, headers: { ...CORS, "retry-after": String(limited.retryAfter) } },
    );
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  const token = parsed.success ? parsed.data.token : undefined;
  if (!verifyInterestToken(leadId, token)) {
    return NextResponse.json({ ok: false }, { status: 403, headers: CORS });
  }

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, status: true, interestedAt: true },
  });
  if (!lead) return NextResponse.json({ ok: false }, { status: 404, headers: CORS });

  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      interestedAt: lead.interestedAt ?? new Date(),
      ...(TERMINAL.has(lead.status) ? {} : { status: "interested" }),
    },
  });

  return NextResponse.json({ ok: true }, { headers: CORS });
}
