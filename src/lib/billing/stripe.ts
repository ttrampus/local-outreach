// Stripe billing — the bridge from an "interested" lead to a paying customer.
// We never store card data or build a payment form: we hand the prospect a hosted
// Stripe Checkout link (recurring €50/mo subscription, or an optional one-time
// buyout), and a webhook marks the lead paid. Stripe has no monthly fee, so this
// only ever costs a per-transaction cut on money you've actually collected.
import "server-only";
import Stripe from "stripe";
import { env } from "@/lib/env";

let client: Stripe | null = null;

/** Lazy singleton; null when STRIPE_SECRET_KEY isn't configured (feature off). */
export function getStripe(): Stripe | null {
  if (!env.stripeSecretKey) return null;
  if (!client) client = new Stripe(env.stripeSecretKey);
  return client;
}

export type Plan = "subscription" | "buyout";

export class BillingError extends Error {}

interface CheckoutLead {
  id: string;
  name: string;
  email: string | null;
  stripeCustomerId: string | null;
}

/**
 * Create a hosted Checkout link for a lead. `subscription` uses the recurring price;
 * `buyout` uses the one-time price. Returns the URL to send the prospect. Throws a
 * BillingError (not a raw Stripe error) when billing isn't configured for the plan.
 */
export async function createCheckoutUrl(
  lead: CheckoutLead,
  plan: Plan,
  appBaseUrl: string,
): Promise<string> {
  const stripe = getStripe();
  if (!stripe) throw new BillingError("Stripe is not configured (set STRIPE_SECRET_KEY).");

  const price = plan === "buyout" ? env.stripeBuyoutPriceId : env.stripePriceId;
  if (!price) {
    throw new BillingError(
      plan === "buyout"
        ? "No buyout price configured (set STRIPE_BUYOUT_PRICE_ID)."
        : "No subscription price configured (set STRIPE_PRICE_ID).",
    );
  }

  const session = await stripe.checkout.sessions.create({
    mode: plan === "buyout" ? "payment" : "subscription",
    line_items: [{ price, quantity: 1 }],
    // Reuse an existing customer if we have one, else let Stripe create one from the
    // prefilled email so repeat charges land on the same customer.
    ...(lead.stripeCustomerId
      ? { customer: lead.stripeCustomerId }
      : lead.email
        ? { customer_email: lead.email }
        : {}),
    client_reference_id: lead.id,
    // Stamped on the session AND propagated to the subscription, so the webhook can
    // map any future subscription event back to this lead.
    metadata: { leadId: lead.id },
    ...(plan === "subscription"
      ? { subscription_data: { metadata: { leadId: lead.id } } }
      : {}),
    success_url: `${appBaseUrl}/pay/success?lead=${lead.id}`,
    cancel_url: `${appBaseUrl}/pay/cancelled?lead=${lead.id}`,
    allow_promotion_codes: true,
  });

  if (!session.url) throw new BillingError("Stripe returned no checkout URL.");
  return session.url;
}
