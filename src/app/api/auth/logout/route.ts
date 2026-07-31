// POST /api/auth/logout — clear the session cookie.
import { NextResponse } from "next/server";
import { COOKIE_OPTIONS, SESSION_COOKIE } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { ...COOKIE_OPTIONS, maxAge: 0 });
  return res;
}
