// POST /api/auth/login — exchange the shared password for a signed session cookie.
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  COOKIE_OPTIONS,
  SESSION_COOKIE,
  authConfigured,
  checkPassword,
  issueSession,
} from "@/lib/auth/session";
import { clientKey, recordFailure, recordSuccess, retryAfter } from "@/lib/auth/loginThrottle";

export const runtime = "nodejs";

const Body = z.object({ password: z.string().min(1) });

export async function POST(req: Request) {
  if (!authConfigured()) {
    return NextResponse.json(
      { error: "Auth is not configured on this server." },
      { status: 503 },
    );
  }

  // Refuse before checking anything, so a blocked source cannot keep testing.
  const key = clientKey(req);
  const wait = retryAfter(key);
  if (wait > 0) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429, headers: { "retry-after": String(wait) } },
    );
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Password required." }, { status: 400 });
  }

  if (!checkPassword(parsed.data.password)) {
    recordFailure(key);
    // Slow every failure down. The sleep costs a legitimate operator nothing and
    // ruins a sequential guesser; the counter above is what handles the parallel
    // one, since a sleep does nothing to two hundred simultaneous connections.
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }

  recordSuccess(key);
  const session = issueSession();
  if (!session) {
    return NextResponse.json({ error: "Auth is not configured." }, { status: 503 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, session, COOKIE_OPTIONS);
  return res;
}
