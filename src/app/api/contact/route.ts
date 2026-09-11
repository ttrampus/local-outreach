// POST /api/contact — the enquiry form on the marketing site at `/`.
//
// Sibling of /api/site/:leadId/contact, which does the same job for a generated
// customer's site. The difference is whose lead it is: that one forwards a
// stranger's message to the business we built a site for, this one is somebody
// asking US for a website. So there is no lead to attach it to and nothing to
// store — it goes straight to the operator's inbox, with Reply-To set so that
// hitting reply answers the prospect rather than the server.
//
// Same shape of guard as its sibling, and for the same reason: an accepted POST
// spends the operator's own Google Workspace sending quota. That mailbox is the
// outreach channel; it gets a budget.
import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { isSmtpConfigured, sendMail } from "@/lib/outreach/mailer";
import { clientKey } from "@/lib/auth/loginThrottle";
import { rateLimit } from "@/lib/http/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Same origin as the page, so no CORS dance is needed here — unlike the
// generated-site endpoint, which is called from a customer's own domain.
const PER_IP = { limit: 5, windowMs: 10 * 60 * 1000 };
const GLOBAL = { limit: 40, windowMs: 60 * 60 * 1000 };

const OptionalText = z
  .string()
  .trim()
  .max(200)
  .transform((v) => (v === "" ? undefined : v))
  .optional();

const BodySchema = z.object({
  name: OptionalText,
  business: OptionalText,
  // The one field that steers a mail header rather than sitting in the body, so
  // it has to be a real address. It is also the only way to answer: a message
  // with no route back is not an enquiry, it is a note to nobody.
  email: z.string().trim().max(200).pipe(z.email()),
  message: z.string().trim().max(5000).optional(),
  /** Which form on the page it came from, so the subject line says something. */
  source: z.enum(["hero", "quote", "contact"]).optional(),
});

function tooMany(retryAfter: number) {
  return NextResponse.json(
    { ok: false, error: "Too many submissions. Please try again later." },
    { status: 429, headers: { "retry-after": String(retryAfter) } },
  );
}

export async function POST(req: Request) {
  // Before the body is parsed and long before any mail is sent: a 429 has to be
  // the cheapest path through here.
  const byIp = rateLimit("site-contact:ip", clientKey(req), PER_IP.limit, PER_IP.windowMs);
  if (!byIp.ok) return tooMany(byIp.retryAfter);
  // A second, shared budget bounds the damage when the flood comes from many
  // addresses and the per-IP limit never trips.
  const overall = rateLimit("site-contact:all", "global", GLOBAL.limit, GLOBAL.windowMs);
  if (!overall.ok) return tooMany(overall.retryAfter);

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 });
  }

  const { name, business, email, message, source } = parsed.data;

  // Nowhere to send it and nowhere to store it is a broken form, not a quiet
  // success: say so, so the page can show the email address instead of swallowing
  // what someone just typed.
  if (!env.ownerEmail || !isSmtpConfigured()) {
    console.error("[contact] enquiry dropped — OUTREACH_OWNER_EMAIL or SMTP not configured");
    return NextResponse.json({ ok: false, error: "unconfigured" }, { status: 503 });
  }

  const who = business ?? name ?? email;

  try {
    await sendMail({
      to: env.ownerEmail,
      subject: `Avenyo enquiry — ${who}`,
      text: [
        `Someone asked for a website through avenyo.app${source ? ` (${source} form)` : ""}.`,
        "",
        name ? `Name:     ${name}` : "",
        business ? `Business: ${business}` : "",
        `Email:    ${email}`,
        "",
        message || "(no message)",
      ]
        .filter(Boolean)
        .join("\n"),
      replyTo: email,
    });
  } catch (err) {
    console.error("[contact] failed to deliver enquiry:", err);
    return NextResponse.json({ ok: false, error: "send-failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
