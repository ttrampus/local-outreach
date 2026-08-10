// POST /api/leads/:id/billing-portal — a Stripe Billing Portal link for a paying
// customer: cancel, change card, download invoices, all self-serve. Returns { url }.
//
// This exists because the public page promises "odpoved kadar koli" (cancel any
// time). Without a portal, honouring that promise is a manual job every time, and
// a customer who can't find the cancel button churns by disputing the charge instead.
//
// Requires the portal to be activated once in the Stripe Dashboard
// (Settings → Billing → Customer portal). Portal links are short-lived, so mint
// one per request rather than storing it.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { requireSession } from "@/lib/auth/guard";
import { createBillingPortalUrl, BillingError } from "@/lib/billing/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // src/proxy.ts already gates this, but the URL this returns is a bearer token in
  // link form: anyone holding it can cancel the subscription, swap the card or read
  // the invoice history of a paying customer, with no further authentication. That
  // is too much to rest on the matcher in one file staying correct forever.
  const denied = await requireSession();
  if (denied) return denied;

  const { id } = await params;

  const lead = await prisma.lead.findUnique({
    where: { id },
    select: { id: true, stripeCustomerId: true },
  });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  try {
    const url = await createBillingPortalUrl(lead.stripeCustomerId, env.appBaseUrl);
    return NextResponse.json({ url });
  } catch (err) {
    if (err instanceof BillingError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error(`[billing-portal] failed for lead ${id}:`, err);
    return NextResponse.json({ error: "Could not create a billing portal link." }, { status: 502 });
  }
}
