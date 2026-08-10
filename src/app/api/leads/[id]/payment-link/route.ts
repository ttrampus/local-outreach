// POST /api/leads/:id/payment-link — create a Stripe Checkout link to send a lead
// who's ready to buy. Body: { plan?: "build" | "care" | "growth" }
// (default "care", the plan most prospects take). Returns { url }. The actual
// "mark paid" happens hands-off via the Stripe webhook — and for SEPA that can be
// days after this link is opened.
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { requireSession } from "@/lib/auth/guard";
import { createCheckoutUrl, BillingError, type Plan } from "@/lib/billing/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The legacy names are still accepted so an older client (or a bookmarked call)
// doesn't 400: "subscription" was the monthly-only plan, "buyout" the pay-once one,
// and "refresh" the retired €99 touch-up — the nearest live plan for that ask is
// a build, which is what the pricing page now offers those businesses anyway.
const BodySchema = z.object({
  plan: z.enum(["build", "care", "growth", "subscription", "buyout", "refresh"]).optional(),
});

const LEGACY_PLANS: Record<string, Plan> = {
  subscription: "care",
  buyout: "build",
  refresh: "build",
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // Second line of defence behind src/proxy.ts — this mints Stripe Checkout
  // sessions against our account. See the note in billing-portal.
  const denied = await requireSession();
  if (denied) return denied;

  const { id } = await params;

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  const requested = parsed.success ? (parsed.data.plan ?? "care") : "care";
  const plan: Plan = LEGACY_PLANS[requested] ?? (requested as Plan);

  const lead = await prisma.lead.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, stripeCustomerId: true },
  });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  try {
    const url = await createCheckoutUrl(lead, plan, env.appBaseUrl);
    return NextResponse.json({ url });
  } catch (err) {
    if (err instanceof BillingError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error(`[payment-link] failed for lead ${id}:`, err);
    return NextResponse.json({ error: "Could not create a payment link." }, { status: 502 });
  }
}
