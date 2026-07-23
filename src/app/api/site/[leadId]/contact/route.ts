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

const BodySchema = z.object({
  name: z.string().trim().max(200).optional(),
  email: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(60).optional(),
  message: z.string().trim().min(1).max(5000),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ leadId: string }> },
) {
  const { leadId } = await params;
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
