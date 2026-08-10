// Stripe billing — the bridge from an "interested" lead to a paying customer.
// We never store card data or build a payment form: we hand the prospect a hosted
// Stripe Checkout link and a webhook marks the lead paid. Stripe has no monthly
// fee, so this only ever costs a per-transaction cut on money you've collected.
//
// The plans mirror @/lib/pricing exactly. The important one is "care": €399 once
// AND €49/month, which is a SINGLE Checkout Session — a subscription-mode session
// may carry one-time prices as ordinary line items, and Stripe puts them on the
// subscription's first invoice. Sending two links for one sale would be a good way
// to lose half the sale.
import "server-only";
import Stripe from "stripe";
import { env } from "@/lib/env";

let client: Stripe | null = null;

/** Lazy singleton; null when STRIPE_SECRET_KEY isn't configured (feature off). */
export function getStripe(): Stripe | null {
  if (!env.stripeSecretKey) return null;
  if (!client)
    client = new Stripe(env.stripeSecretKey, {
      // Pinned deliberately: without this the SDK follows whatever default the
      // installed version ships, so an npm upgrade can change response shapes
      // under the webhook without a line of our code changing. This value must
      // stay in step with the SDK's own bundled types (stripe/cjs/apiVersion.js)
      // — pinning OLDER than the installed SDK makes the types lie about the
      // payloads. Bump both together, deliberately.
      apiVersion: "2026-05-27.dahlia",
    });
  return client;
}

/**
 * What the prospect is being sold. Mirrors the plans on the public pricing page.
 *
 * "refresh" (a €99 touch-up of an existing site) used to be here and is gone: the
 * free preview already IS the pitch to a business that has a dated site, so a
 * cheaper half-product sitting next to it only gave them a way to buy less.
 * Anyone who bought one keeps their subscription — nothing reads this union to
 * interpret an existing customer, only to create a new Checkout.
 */
export type Plan = "build" | "care" | "growth";

export class BillingError extends Error {}

interface CheckoutLead {
  id: string;
  name: string;
  email: string | null;
  stripeCustomerId: string | null;
}

/**
 * Which Prices make up each plan, and which env var supplies each one.
 * `recurring: false` items are charged once, on the first invoice.
 */
function planLineItems(plan: Plan): { priceId: string; envVar: string; recurring: boolean }[] {
  const build = { priceId: env.stripeBuildPriceId, envVar: "STRIPE_BUILD_PRICE_ID", recurring: false };
  const care = { priceId: env.stripeCarePriceId, envVar: "STRIPE_CARE_PRICE_ID", recurring: true };

  switch (plan) {
    case "build":
      return [build];
    case "care":
      // The €399 rides along on the subscription's first invoice.
      return [care, build];
    case "growth":
      // Growth includes the build in the monthly price — no one-time line.
      return [{ priceId: env.stripeGrowthPriceId, envVar: "STRIPE_GROWTH_PRICE_ID", recurring: true }];
  }
}

/**
 * Create a hosted Checkout link for a lead. Returns the URL to send the prospect.
 * Throws a BillingError (not a raw Stripe error) when billing isn't configured.
 *
 * The lead is only marked as a customer by the webhook, never here — with SEPA
 * Direct Debit the money can still fail days after this link is opened.
 */
export async function createCheckoutUrl(
  lead: CheckoutLead,
  plan: Plan,
  appBaseUrl: string,
): Promise<string> {
  const stripe = getStripe();
  if (!stripe) throw new BillingError("Stripe is not configured (set STRIPE_SECRET_KEY).");

  const items = planLineItems(plan);
  const missing = items.find((i) => !i.priceId);
  if (missing) {
    throw new BillingError(`No price configured for the "${plan}" plan (set ${missing.envVar}).`);
  }

  // Any recurring line makes the whole session a subscription; one-time lines
  // are then billed on the first invoice.
  const isSubscription = items.some((i) => i.recurring);

  const session = await stripe.checkout.sessions.create({
    mode: isSubscription ? "subscription" : "payment",
    line_items: items.map((i) => ({ price: i.priceId, quantity: 1 })),
    // Reuse an existing customer if we have one, else let Stripe create one from the
    // prefilled email so repeat charges land on the same customer.
    ...(lead.stripeCustomerId
      ? { customer: lead.stripeCustomerId }
      : lead.email
        ? { customer_email: lead.email }
        : {}),
    client_reference_id: lead.id,
    metadata: { leadId: lead.id, plan },
    // In subscription mode Stripe won't let us stamp metadata on the PaymentIntent,
    // so the subscription carries it instead — that's what later subscription and
    // invoice events are matched back to the lead by.
    ...(isSubscription
      ? { subscription_data: { metadata: { leadId: lead.id, plan } } }
      : { payment_intent_data: { metadata: { leadId: lead.id, plan } } }),
    success_url: `${appBaseUrl}/pay/success?lead=${lead.id}`,
    cancel_url: `${appBaseUrl}/pay/cancelled?lead=${lead.id}`,
    allow_promotion_codes: true,
  });

  if (!session.url) throw new BillingError("Stripe returned no checkout URL.");
  return session.url;
}

/**
 * A Billing Portal link, where the customer can cancel, swap card, and read
 * invoices themselves. The public page promises "odpoved kadar koli"; without
 * this every cancellation is a manual job for the operator.
 *
 * Requires the portal to be activated once in the Stripe Dashboard
 * (Settings → Billing → Customer portal).
 */
export async function createBillingPortalUrl(
  stripeCustomerId: string | null,
  appBaseUrl: string,
): Promise<string> {
  const stripe = getStripe();
  if (!stripe) throw new BillingError("Stripe is not configured (set STRIPE_SECRET_KEY).");
  if (!stripeCustomerId) {
    throw new BillingError("This lead has no Stripe customer yet — they haven't paid.");
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${appBaseUrl}/app`,
  });
  return session.url;
}
