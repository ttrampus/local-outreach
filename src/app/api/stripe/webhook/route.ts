// POST /api/stripe/webhook — Stripe calls this when a Checkout completes or a
// subscription changes, so a lead becomes a paying customer with no manual step.
// Signature-verified with STRIPE_WEBHOOK_SECRET; we read the RAW body (req.text())
// because any reparse would break verification.
//
// Configure in the Stripe dashboard: endpoint <APP_BASE_URL>/api/stripe/webhook,
// events checkout.session.completed + customer.subscription.updated/deleted.
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { getStripe } from "@/lib/billing/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Never downgrade a lead that's already live.
async function markCustomer(
  leadId: string,
  data: { stripeCustomerId?: string; stripeSubscriptionId?: string; subscriptionStatus?: string },
) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { status: true } });
  if (!lead) return;
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      ...data,
      ...(lead.status === "deployed" ? {} : { status: "customer" }),
    },
  });
}

export async function POST(req: Request) {
  const stripe = getStripe();
  if (!stripe || !env.stripeWebhookSecret) {
    return NextResponse.json({ error: "Billing webhook not configured." }, { status: 501 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing signature." }, { status: 400 });

  let event: Stripe.Event;
  try {
    const raw = await req.text();
    event = stripe.webhooks.constructEvent(raw, sig, env.stripeWebhookSecret);
  } catch (err) {
    return NextResponse.json(
      { error: `Signature verification failed: ${(err as Error).message}` },
      { status: 400 },
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        const leadId = s.metadata?.leadId ?? s.client_reference_id ?? undefined;
        if (leadId) {
          await markCustomer(leadId, {
            stripeCustomerId: typeof s.customer === "string" ? s.customer : undefined,
            stripeSubscriptionId: typeof s.subscription === "string" ? s.subscription : undefined,
            subscriptionStatus: s.mode === "subscription" ? "active" : "paid",
          });
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const leadId = sub.metadata?.leadId;
        if (leadId) {
          await prisma.lead.update({
            where: { id: leadId },
            data: { stripeSubscriptionId: sub.id, subscriptionStatus: sub.status },
          });
        }
        break;
      }
    }
  } catch (err) {
    // Log but still 200 so Stripe doesn't hammer retries for a transient DB blip.
    console.error(`[stripe/webhook] handling ${event.type} failed:`, err);
  }

  return NextResponse.json({ received: true });
}
