// POST /api/site/:leadId/contact — receives an enquiry from the contact form on a
// generated/deployed customer site. The deployed site is static and lives on a
// different origin, so this endpoint is CORS-open (it only ever WRITES a message,
// reveals nothing) and also answers the preflight. Each submission is stored and,
// best-effort, emailed to the site owner so they actually get their leads.
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { isSmtpConfigured, sendMail } from "@/lib/outreach/mailer";
import { clientKey } from "@/lib/auth/loginThrottle";
import { rateLimit } from "@/lib/http/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

// Two budgets, because they stop different things. The per-IP one stops a single
// source hammering the form. The per-lead one bounds the damage when that source
// is a botnet and the per-IP limit never trips: whatever happens, one generated
// site cannot produce more than a handful of emails an hour to the operator.
//
// Sized for the real traffic, which is tiny — a genuine enquiry is one submission,
// and a second one is someone who forgot what they typed. Anything past that is
// not a customer.
const PER_IP = { limit: 5, windowMs: 10 * 60 * 1000 };
const PER_LEAD = { limit: 20, windowMs: 60 * 60 * 1000 };

function tooMany(retryAfter: number) {
  return NextResponse.json(
    { ok: false, error: "Too many submissions. Please try again later." },
    { status: 429, headers: { ...CORS, "retry-after": String(retryAfter) } },
  );
}

/**
 * A real address, not any string: this value becomes the Reply-To of the mail sent
 * to the site owner, so it is the one field here that steers a mail header rather
 * than sitting in the body. An empty string folds to absent rather than failing,
 * because a blank optional field is a normal submission, not a malformed one.
 */
const OptionalEmail = z
  .string()
  .trim()
  .max(200)
  .transform((v) => (v === "" ? undefined : v))
  .pipe(z.email().optional());

const BodySchema = z.object({
  name: z.string().trim().max(200).optional(),
  email: OptionalEmail.optional(),
  phone: z.string().trim().max(60).optional(),
  message: z.string().trim().min(1).max(5000),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ leadId: string }> },
) {
  const { leadId } = await params;

  // Before the body is parsed and long before any mail is sent: the cost this
  // guards against is the send, and a 429 must be the cheapest path through here.
  const byIp = rateLimit("contact:ip", clientKey(req), PER_IP.limit, PER_IP.windowMs);
  if (!byIp.ok) return tooMany(byIp.retryAfter);
  const byLead = rateLimit("contact:lead", leadId, PER_LEAD.limit, PER_LEAD.windowMs);
  if (!byLead.ok) return tooMany(byLead.retryAfter);

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400, headers: CORS });
  }

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, name: true },
  });
  if (!lead) return NextResponse.json({ ok: false }, { status: 404, headers: CORS });

  const { name, email, phone, message } = parsed.data;

  // Best-effort owner notification — never let a mail hiccup drop the enquiry.
  let notified = false;
  if (env.ownerEmail && isSmtpConfigured()) {
    try {
      await sendMail({
        to: env.ownerEmail,
        subject: `New enquiry from ${lead.name}'s website`,
        text: [
          `New message via the contact form on ${lead.name}'s site:`,
          "",
          name ? `Name:  ${name}` : "",
          email ? `Email: ${email}` : "",
          phone ? `Phone: ${phone}` : "",
          "",
          message,
        ]
          .filter(Boolean)
          .join("\n"),
        replyTo: email || undefined,
      });
      notified = true;
    } catch {
      /* stored anyway; owner can read it in the app */
    }
  }

  await prisma.siteMessage.create({
    data: { leadId: lead.id, name, email, phone, message, notified },
  });

  return NextResponse.json({ ok: true }, { headers: CORS });
}
