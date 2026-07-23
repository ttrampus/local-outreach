// POST /api/leads/:id/payment-link — create a Stripe Checkout link to send a lead
// who's ready to buy. Body: { plan?: "subscription" | "buyout" } (default subscription).
// Returns { url }. The actual "mark paid" happens hands-off via the Stripe webhook.
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { createCheckoutUrl, BillingError } from "@/lib/billing/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({ plan: z.enum(["subscription", "buyout"]).optional() });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  const plan = parsed.success ? (parsed.data.plan ?? "subscription") : "subscription";

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
