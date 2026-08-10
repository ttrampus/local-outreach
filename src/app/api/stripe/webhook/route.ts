// POST /api/stripe/webhook — Stripe calls this when a Checkout completes, a
// payment settles, or a subscription changes, so a lead becomes a paying customer
// with no manual step. Signature-verified with STRIPE_WEBHOOK_SECRET; we read the
// RAW body (req.text()) because any reparse would break verification.
//
// The rule this file exists to enforce: a lead is marked PAID only when the money
// has actually settled. SEPA Direct Debit is a delayed-notification method — the
// Checkout Session completes as soon as the customer authorises the mandate, and
// the debit can still fail days later ("Wait for the payment to succeed or fail",
// per Stripe's own SEPA guide). Marking a customer on session completion would
// mean building and hosting sites for debits that never arrive.
//
// Configure in the Stripe dashboard: endpoint <APP_BASE_URL>/api/stripe/webhook,
// events:
//   checkout.session.completed
//   checkout.session.async_payment_succeeded   (delayed method settled)
//   checkout.session.async_payment_failed      (delayed method failed)
//   invoice.paid                               (renewal collected)
//   invoice.payment_failed                     (renewal failed → dunning)
//   customer.subscription.updated / .deleted
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { getStripe } from "@/lib/billing/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Stripe subscription statuses that mean "this one is actually paying". */
type LeadBilling = {
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus?: string | null;
};

/**
 * Record Stripe ids against a lead without touching its funnel status. Used for
 * money that has been AUTHORISED but not yet settled.
 */
async function recordBilling(leadId: string, data: LeadBilling) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true } });
  if (!lead) return;
  await prisma.lead.update({ where: { id: leadId }, data });
}

/** Promote a lead to customer. Never downgrade one that's already live. */
async function markCustomer(leadId: string, data: LeadBilling) {
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

function leadIdOf(s: Stripe.Checkout.Session): string | undefined {
  return s.metadata?.leadId ?? s.client_reference_id ?? undefined;
}

function idsOf(s: Stripe.Checkout.Session) {
  return {
    stripeCustomerId: typeof s.customer === "string" ? s.customer : undefined,
    stripeSubscriptionId: typeof s.subscription === "string" ? s.subscription : undefined,
  };
}

/**
 * Resolve the lead behind an invoice. Subscription invoices carry our metadata via
 * subscription_details (that's where subscription_data.metadata surfaces); we fall
 * back to matching the stored subscription id.
 */
async function leadIdForInvoice(inv: Stripe.Invoice): Promise<string | undefined> {
  // On this API version the subscription that generated an invoice hangs off
  // `parent.subscription_details` — the old top-level `invoice.subscription`
  // and `invoice.subscription_details` are gone.
  const details = inv.parent?.subscription_details ?? null;

  const fromMetadata = details?.metadata?.leadId ?? inv.metadata?.leadId;
  if (fromMetadata) return fromMetadata;

  const sub = details?.subscription;
  const subId = typeof sub === "string" ? sub : sub?.id;
  if (!subId) return undefined;

  const lead = await prisma.lead.findFirst({
    where: { stripeSubscriptionId: subId },
    select: { id: true },
  });
  return lead?.id;
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
      // The customer finished Checkout. For cards this already means paid; for
      // SEPA it only means the mandate was authorised.
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        const leadId = leadIdOf(s);
        if (!leadId) break;

        // "no_payment_required" covers 100%-discounted sessions, which are settled.
        const settled = s.payment_status === "paid" || s.payment_status === "no_payment_required";
        if (settled) {
          await markCustomer(leadId, {
            ...idsOf(s),
            subscriptionStatus: s.mode === "subscription" ? "active" : undefined,
          });
        } else {
          // Money is in flight. Keep the ids so later events can be matched, but
          // leave the funnel status alone — they are not a customer yet.
          await recordBilling(leadId, {
            ...idsOf(s),
            subscriptionStatus: s.mode === "subscription" ? "incomplete" : undefined,
          });
          console.info(
            `[stripe/webhook] lead ${leadId}: checkout complete but payment_status=${s.payment_status} — awaiting settlement`,
          );
        }
        break;
      }

      // A delayed-notification payment (SEPA) finally settled. THIS is the signal
      // to fulfil: build the site, put it live.
      case "checkout.session.async_payment_succeeded": {
        const s = event.data.object as Stripe.Checkout.Session;
        const leadId = leadIdOf(s);
        if (leadId) {
          await markCustomer(leadId, {
            ...idsOf(s),
            subscriptionStatus: s.mode === "subscription" ? "active" : undefined,
          });
        }
        break;
      }

      // ...or it failed, days later. Do not promote; surface it to the operator.
      case "checkout.session.async_payment_failed": {
        const s = event.data.object as Stripe.Checkout.Session;
        const leadId = leadIdOf(s);
        if (leadId) {
          await recordBilling(leadId, {
            ...idsOf(s),
            subscriptionStatus: s.mode === "subscription" ? "incomplete_expired" : undefined,
          });
          console.warn(
            `[stripe/webhook] lead ${leadId}: delayed payment FAILED — contact them, nothing was collected`,
          );
        }
        break;
      }

      // Renewals. invoice.paid is the canonical "money arrived" event for the
      // recurring care/growth plans; payment_failed opens Stripe's dunning cycle.
      case "invoice.paid": {
        const inv = event.data.object as Stripe.Invoice;
        const leadId = await leadIdForInvoice(inv);
        if (leadId) await markCustomer(leadId, { subscriptionStatus: "active" });
        break;
      }
      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        const leadId = await leadIdForInvoice(inv);
        if (leadId) {
          await recordBilling(leadId, { subscriptionStatus: "past_due" });
          console.warn(`[stripe/webhook] lead ${leadId}: renewal payment failed — in dunning`);
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const leadId = sub.metadata?.leadId;
        if (leadId) {
          await recordBilling(leadId, {
            stripeSubscriptionId: sub.id,
            subscriptionStatus: sub.status,
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
