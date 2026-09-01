// GET/POST /api/unsubscribe — the opt-out behind every outreach email.
//
// Public by necessity: the person clicking it is a prospect who has never logged
// into anything here, and the mail client that follows it (see POST) carries no
// cookie at all. The HMAC in `t` is what authorises the write.
//
// Both verbs exist because there are two callers with different needs:
//
//   GET  — a human clicked the link in the message. Answers with a small HTML
//          page confirming it worked, because a blank 200 leaves someone unsure
//          whether they are still on the list.
//   POST — RFC 8058 one-click. Gmail and friends render their own "Unsubscribe"
//          button next to the sender and POST here when it is pressed, without
//          the recipient ever opening the mail. This is the half that actually
//          improves deliverability, and it must work without a body.
//
// Idempotent: unsubscribing twice is a no-op, not an error. People click twice.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyUnsubscribeToken } from "@/lib/outreach/unsubscribeToken";
import { clientKey } from "@/lib/auth/loginThrottle";
import { rateLimit } from "@/lib/http/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function page(title: string, message: string, status = 200): Response {
  return new Response(
    `<!doctype html><meta charset="utf-8">` +
      `<meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<title>${title}</title>` +
      `<style>body{font:16px/1.6 system-ui,sans-serif;margin:0;min-height:100vh;` +
      `display:grid;place-items:center;padding:2rem;color:#111;background:#fafafa}` +
      `main{max-width:32rem;text-align:center}h1{font-size:1.25rem;margin:0 0 .5rem}` +
      `p{margin:0;color:#555}</style>` +
      `<main><h1>${title}</h1><p>${message}</p></main>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );
}

/** Mark the lead opted out. Returns false when the token doesn't authorise it. */
async function unsubscribe(req: Request): Promise<boolean> {
  const url = new URL(req.url);
  const leadId = url.searchParams.get("lead");
  const token = url.searchParams.get("t");
  if (!leadId || !verifyUnsubscribeToken(leadId, token)) return false;

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, unsubscribedAt: true },
  });
  // A token that verifies but names a deleted lead is still a legitimate request;
  // there is simply nothing left to mark. Report success — the prospect's ask has
  // been satisfied either way.
  if (!lead) return true;
  if (lead.unsubscribedAt) return true;

  await prisma.lead.update({
    where: { id: lead.id },
    data: { unsubscribedAt: new Date() },
  });
  return true;
}

export async function GET(req: Request) {
  // Cheap, but it writes, and the URL travels through mail scanners that fetch
  // every link they see. A budget keeps a scanner loop from becoming a write loop.
  const limited = rateLimit("unsubscribe:ip", clientKey(req), 60, 10 * 60 * 1000);
  if (!limited.ok) return page("Too many requests", "Please try again in a few minutes.", 429);

  const ok = await unsubscribe(req);
  return ok
    ? page("You're unsubscribed", "You won't be contacted again. Sorry for the interruption.")
    : page("Link not recognised", "This unsubscribe link is invalid or incomplete.", 400);
}

export async function POST(req: Request) {
  const limited = rateLimit("unsubscribe:ip", clientKey(req), 60, 10 * 60 * 1000);
  if (!limited.ok) return NextResponse.json({ ok: false }, { status: 429 });

  const ok = await unsubscribe(req);
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}
