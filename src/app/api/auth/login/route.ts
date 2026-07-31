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

export const runtime = "nodejs";

const Body = z.object({ password: z.string().min(1) });

export async function POST(req: Request) {
  if (!authConfigured()) {
    return NextResponse.json(
      { error: "Auth is not configured on this server." },
      { status: 503 },
    );
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Password required." }, { status: 400 });
  }

  if (!checkPassword(parsed.data.password)) {
    // Slow every failure down. This is a single shared password on a small box;
    // a second per attempt is the difference between a feasible online guess and
    // an infeasible one, and costs a legitimate operator nothing.
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }

  const session = issueSession();
  if (!session) {
    return NextResponse.json({ error: "Auth is not configured." }, { status: 503 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, session, COOKIE_OPTIONS);
  return res;
}
