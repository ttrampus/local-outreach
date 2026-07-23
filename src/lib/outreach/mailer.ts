// SMTP transport for actually SENDING an approved outreach message (with the
// preview image attached) instead of copy-pasting it into Gmail by hand. Entirely
// optional: when SMTP isn't configured the send path falls back to "mark sent" plus
// a Gmail compose deep-link, so the app works with or without credentials.
import "server-only";
import path from "node:path";
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

export interface SendMailInput {
  to: string;
  subject: string;
  text: string;
  /** Web path of the preview image (e.g. /previews/x.png) to attach, if any. */
  previewImagePath?: string | null;
  /** Reply-To, so prospect replies land in the operator's normal inbox. */
  replyTo?: string;
}

/** Send one plain-text email with the optional preview image attached. */
export async function sendMail(input: SendMailInput): Promise<void> {
  const attachments = input.previewImagePath
    ? [
        {
          filename: "website-preview.png",
          // previewImagePath is a /public web path; resolve to its file on disk.
          path: path.join(process.cwd(), "public", input.previewImagePath.replace(/^\/+/, "")),
          cid: "preview",
        },
      ]
    : undefined;

  await transport().sendMail({
    from: env.smtpFrom,
    to: input.to,
    replyTo: input.replyTo || env.ownerEmail || undefined,
    subject: input.subject,
    text: input.text,
    attachments,
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
