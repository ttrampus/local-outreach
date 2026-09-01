// SMTP transport for actually SENDING an approved outreach message (with the
// preview image attached) instead of copy-pasting it into Gmail by hand. Entirely
// optional: when SMTP isn't configured the send path falls back to "mark sent" plus
// a Gmail compose deep-link, so the app works with or without credentials.
import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { env } from "@/lib/env";

export function isSmtpConfigured(): boolean {
  return Boolean(env.smtpHost && env.smtpUser && env.smtpPass && env.smtpFrom);
}

let cached: Transporter | null = null;
function transport(): Transporter {
  if (cached) return cached;
  cached = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure, // true for 465, false for 587/STARTTLS
    auth: { user: env.smtpUser, pass: env.smtpPass },
  });
  return cached;
}

/**
 * Open a connection and authenticate, without sending anything. The only check
 * that distinguishes "SMTP is configured" from "SMTP works" — an App Password that
 * was revoked looks identical to a good one until the first send fails. Used by
 * the outreach self-test (scripts/outreach-selftest.mjs).
 */
export async function verifySmtp(): Promise<{ ok: boolean; error?: string }> {
  if (!isSmtpConfigured()) return { ok: false, error: "SMTP is not configured." };
  try {
    await transport().verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message.slice(0, 200) };
  }
}

export interface SendMailInput {
  to: string;
  subject: string;
  text: string;
  /** Reply-To, so prospect replies land in the operator's normal inbox. */
  replyTo?: string;
  /**
   * The recipient's opt-out URL. Supplied for outreach; omitted for
   * transactional mail (a contact-form notification to the operator is not
   * marketing and has nothing to unsubscribe from).
   */
  unsubscribeUrl?: string | null;
}

/**
 * Send one plain-text email.
 *
 * No attachment, deliberately. This used to attach the preview PNG, which cost
 * more than it bought: the message is text/plain with no HTML, so the image was
 * never displayed inline — it arrived as a file for a stranger to open, which is
 * both the thing people are told never to do and a strong spam signal on a domain
 * with no sending history. The live preview page is a better artefact anyway; it
 * is interactive, it carries the "I'm interested" button, and it tells us when it
 * was opened. So the body links to it instead. See previewLine() in draft.ts.
 *
 * List-Unsubscribe is set whenever an opt-out URL is supplied. Gmail and Outlook
 * surface their own unsubscribe control from it and weigh its ABSENCE against
 * cold mail, and RFC 8058 one-click (the -Post header) is what makes that control
 * work without the recipient opening the message. Both headers together, or
 * neither: a List-Unsubscribe-Post without a URL to post to is worse than silence.
 */
export async function sendMail(input: SendMailInput): Promise<void> {
  const headers: Record<string, string> = {};
  if (input.unsubscribeUrl) {
    // The mailto: fallback is for clients that do not implement one-click; it
    // reaches a human rather than a route, which is the point of a fallback.
    const mailto = env.ownerEmail ? `, <mailto:${env.ownerEmail}?subject=unsubscribe>` : "";
    headers["List-Unsubscribe"] = `<${input.unsubscribeUrl}>${mailto}`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }

  await transport().sendMail({
    from: env.smtpFrom,
    to: input.to,
    replyTo: input.replyTo || env.ownerEmail || undefined,
    subject: input.subject,
    text: input.text,
    headers,
  });
}

/**
 * A Gmail web "compose" deep-link prefilled with the message — the manual fallback
 * when SMTP isn't configured. The operator clicks it, attaches the preview if they
 * want, and sends from their own Gmail; the app still records the send.
 */
export function gmailComposeUrl(to: string, subject: string, body: string): string {
  const q = new URLSearchParams({ view: "cm", fs: "1", to, su: subject, body });
  return `https://mail.google.com/mail/?${q.toString()}`;
}
