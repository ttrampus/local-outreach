// What the business charges, in one place.
//
// Three numbers drive everything a prospect ever sees — the landing page's plan
// cards, the FAQ, and the pricing sentence in outreach — because the fastest way
// to lose a sale is to quote €39 in an email and show €49 on the page.
//
// The shape is deliberately three options, not twelve. A prospect is only ever
// asking one of three questions: "I just need a website", "I need someone to
// look after it", "I want it to keep getting better". One plan answers each.
//
// NOTHING here meters the work. There used to be a menu of add-ons (€40 a page,
// €50 an hour for edits) and a monthly edit allowance measured in minutes. Both
// are gone on purpose. The whole advantage of building this way is that another
// section costs almost nothing to produce, so charging for one trains the
// customer to ask "what will this button cost me?" instead of "make it how I
// want it". Be generous with ordinary website work; the money is in the project
// plus the recurring hosting, not in nickel-and-diming.
//
// The line that is NOT generous: things that are a different product rather than
// a bigger website (a real booking platform with accounts and payments, a shop,
// a customer portal, integrations with someone's back-office). Those get quoted
// per job — see the "po dogovoru" panel on the pricing page.
//
// These are launch prices. With no testimonials yet, the job of the price is to
// get the first ten customers, not to maximise per-customer revenue; raise them
// once there's a wall of finished work to point at.

export const PRICING = {
  /** One-time: the preview, finished and put live on their domain. */
  buildEur: 399,
  /**
   * Care plan: hosting and upkeep after launch. This is where the business
   * actually becomes interesting — one-time builds are lumpy revenue, this isn't.
   * Hosting a static site costs a few euros, so at €49 the margin survives both
   * the infrastructure and a customer who asks for changes most months.
   *
   * The domain is deliberately NOT in here: it stays registered to the customer
   * and is billed at cost, so nobody is ever arguing about who owns it.
   */
  careMonthlyEur: 49,
  /**
   * Growth plan: care plus ongoing SEO and content. Real SEO work runs to
   * hundreds a month at an agency; this is deliberately under that for the first
   * customers, but not so far under that the work loses money.
   *
   * Expect to sell none of these at first, and that's fine — it exists so that
   * the customer who asks "can you also get us found on Google?" has something
   * to say yes to.
   */
  growthMonthlyEur: 199,
} as const;

/**
 * The pricing sentence for outreach, in English (the deterministic draft is
 * English; the Claude drafter translates it into the prospect's language).
 *
 * Leads with the outcome and the fact that the work is already done — the price
 * is the last clause, not the first.
 */
export const OUTREACH_PRICE_SENTENCE =
  `€${PRICING.buildEur} to make it yours — once that's settled I change whatever ` +
  `you want changed (text, photos, colours, layout) until it's right, at no extra ` +
  `charge, and then it goes live on your domain — plus €${PRICING.careMonthlyEur}/month ` +
  `if you'd like me to host it and look after it afterwards (optional, cancel anytime)`;

/** The same thing compressed, for a follow-up that has to stay short. */
export const OUTREACH_PRICE_SHORT =
  `€${PRICING.buildEur} to make it yours, changed however you want, ` +
  `€${PRICING.careMonthlyEur}/month to look after it`;
