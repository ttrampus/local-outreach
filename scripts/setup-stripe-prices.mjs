// Create the Stripe Products and Prices for the plans in src/lib/pricing.ts, then
// print the env lines to paste into .env.local.
//
//   node scripts/setup-stripe-prices.mjs            # dry run: show what it would create
//   node scripts/setup-stripe-prices.mjs --create   # actually create them
//
// Refuses to run against a live key unless you also pass --live, because the
// normal build order is test mode first: you cannot put a test payment through a
// live Price, and the SEPA test IBAN is the whole point of the first run.
//
// Idempotent by lookup_key: re-running finds the existing Price instead of
// minting a duplicate. Prices are immutable in Stripe — to change an amount you
// create a new Price and archive the old one, which is why this never updates.
import Stripe from "stripe";
import { readFileSync } from "node:fs";

// Read the key straight from .env.local rather than importing @/lib/env, which is
// server-only and pulls in the whole Next runtime.
function envLocal(key) {
  try {
    const line = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
      .split("\n")
      .find((l) => l.startsWith(`${key}=`));
    return line ? line.slice(key.length + 1).trim().replace(/^["']|["']$/g, "") : "";
  } catch {
    return "";
  }
}

const create = process.argv.includes("--create");
const allowLive = process.argv.includes("--live");

const key = process.env.STRIPE_SECRET_KEY || envLocal("STRIPE_SECRET_KEY");
if (!key) {
  console.error("No STRIPE_SECRET_KEY (checked the environment and .env.local).");
  console.error("Get a TEST key from https://dashboard.stripe.com/test/apikeys — it starts sk_test_.");
  process.exit(1);
}
const isLive = key.startsWith("sk_live_") || key.startsWith("rk_live_");
if (isLive && !allowLive) {
  console.error("That is a LIVE key. Re-run with --live if you really mean it,");
  console.error("or use a test key (sk_test_...) to build against test mode first.");
  process.exit(1);
}

// Mirrors PRICING in src/lib/pricing.ts. Kept as literals rather than imported
// because that module is TypeScript; if you change the prices there, change them
// here too — the mismatch is loud (the Dashboard shows the wrong number).
const PLANS = [
  {
    envVar: "STRIPE_BUILD_PRICE_ID",
    lookupKey: "build_once",
    product: "Spletna stran — izdelava",
    description: "One-time website build, delivered and put live on your domain.",
    amount: 39900,
    recurring: null,
  },
  {
    envVar: "STRIPE_CARE_PRICE_ID",
    lookupKey: "care_monthly",
    product: "Skrb za spletno stran",
    description: "Hosting, SSL, backups, monitoring and 30 minutes of changes each month.",
    amount: 4900,
    recurring: { interval: "month" },
  },
  {
    envVar: "STRIPE_GROWTH_PRICE_ID",
    lookupKey: "growth_monthly",
    product: "Rast",
    description: "Everything in Care, plus monthly SEO, content and conversion work.",
    amount: 19900,
    recurring: { interval: "month" },
  },
  {
    envVar: "STRIPE_REFRESH_PRICE_ID",
    lookupKey: "refresh_once",
    product: "Prenova obstoječe strani",
    description: "One-time refresh of an existing website: design, mobile and speed.",
    amount: 9900,
    recurring: null,
  },
];

const stripe = new Stripe(key, { apiVersion: "2026-05-27.dahlia" });
const mode = isLive ? "LIVE" : "TEST";
console.log(`Mode: ${mode}${create ? "" : "  (dry run — pass --create to write)"}\n`);

const envLines = [];
for (const plan of PLANS) {
  const label = `${plan.product} — €${(plan.amount / 100).toFixed(0)}${plan.recurring ? "/mo" : " once"}`;

  // Already there from an earlier run?
  const existing = await stripe.prices.list({ lookup_keys: [plan.lookupKey], limit: 1 });
  if (existing.data.length) {
    console.log(`= ${label}\n    exists: ${existing.data[0].id}`);
    envLines.push(`${plan.envVar}="${existing.data[0].id}"`);
    continue;
  }

  if (!create) {
    console.log(`+ ${label}\n    would create (lookup_key: ${plan.lookupKey})`);
    envLines.push(`${plan.envVar}="<pending>"`);
    continue;
  }

  const product = await stripe.products.create({
    name: plan.product,
    description: plan.description,
  });
  const price = await stripe.prices.create({
    product: product.id,
    currency: "eur", // SEPA Direct Debit requires every line item in EUR
    unit_amount: plan.amount,
    lookup_key: plan.lookupKey,
    ...(plan.recurring ? { recurring: plan.recurring } : {}),
  });
  console.log(`+ ${label}\n    created: ${price.id}`);
  envLines.push(`${plan.envVar}="${price.id}"`);
}

console.log(`\n--- paste into .env.local (${mode} mode) ---`);
console.log(envLines.join("\n"));
