// Defence in depth for the routes that spend real money. src/proxy.ts already
// blocks these, but the Next docs are explicit that proxy should not be the only
// check — a matcher edit or a future rewrite could quietly route around it, and
// the failure mode here is someone else draining the Google, Anthropic, Vercel
// and Stripe budgets.
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "./session";

/**
 * Returns a 401/503 response when the caller has no valid session, or null when
 * the request may proceed:
 *
 *   const denied = await requireSession();
 *   if (denied) return denied;
 */
export async function requireSession(): Promise<NextResponse | null> {
  if (!process.env.AUTH_SECRET) {
    return NextResponse.json(
      { error: "Auth is not configured on this server." },
      { status: 503 },
    );
  }

  const store = await cookies();
  if (verifySession(store.get(SESSION_COOKIE)?.value)) return null;

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
