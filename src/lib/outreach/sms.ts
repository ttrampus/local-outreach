// SMS transport for actually SENDING an outreach message to a lead's phone number.
// Entirely optional, exactly like SMTP: when Twilio isn't configured the send path
// degrades to an `sms:` deep-link the operator finishes by hand.
//
// Twilio's REST API is called directly over fetch rather than through the `twilio`
// npm package — one form POST with basic auth is the whole integration, and the
// SDK would pull in a large dependency tree for it.
//
// SMS is a legitimate cold channel (unlike WhatsApp/Meta DMs, which have no cold-
// send API and ban accounts that automate them), but it is NOT unregulated: many
// markets require opt-out handling and forbid marketing to numbers on a do-not-call
// register. Twilio appends STOP handling for you on most routes; the rest is on you.
import "server-only";
import { env } from "@/lib/env";

export function isSmsConfigured(): boolean {
  return Boolean(
    env.twilioAccountSid && env.twilioAuthToken && (env.twilioFrom || env.twilioMessagingServiceSid),
  );
}

/**
 * Coerce a phone number into E.164 (+<country><number>), which is the only format
 * Twilio accepts. Google Places hands back numbers in whatever shape the business
 * listed them — "+386 1 234 5678", "01 234 5678", "(01) 234-5678" — so a national
 * number needs SMS_DEFAULT_COUNTRY_CODE to become dialable. Returns null when the
 * number can't be resolved, so the caller can fail loudly instead of sending into
 * the void.
 */
export function toE164(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Keep a leading +, drop every other non-digit (spaces, dashes, parens, dots).
  const plus = trimmed.startsWith("+");
  let digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  if (plus) return `+${digits}`;
  // "00" is the international prefix in most of the world — same thing as "+".
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;

  const cc = env.smsDefaultCountryCode.replace(/\D/g, "");
  if (!cc) return null; // national number with no country to attach it to
  // National trunk prefix: "01 234 5678" in +386 is "+386 1 234 5678".
  if (digits.startsWith("0")) digits = digits.replace(/^0+/, "");
  if (!digits) return null;
  // Already carries the country code (some listings write "386 1 234 5678").
  if (digits.startsWith(cc)) return `+${digits}`;
  return `+${cc}${digits}`;
}

/**
 * Check the credentials and the sender without sending a message: fetch the
 * account, then confirm the sender actually exists on it. A typo'd From number or
 * a suspended trial account otherwise stays invisible until a real send fails —
 * and Twilio bills nothing for these reads. Used by the outreach self-test.
 */
export async function verifyTwilio(): Promise<{ ok: boolean; detail?: string; error?: string }> {
  if (!isSmsConfigured()) return { ok: false, error: "Twilio is not configured." };

  const auth = `Basic ${Buffer.from(`${env.twilioAccountSid}:${env.twilioAuthToken}`).toString("base64")}`;
  const get = async (url: string) => {
    const res = await fetch(url, { headers: { Authorization: auth } });
    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok) throw new Error((json?.message as string) ?? `HTTP ${res.status}`);
    return json ?? {};
  };

  try {
    const account = await get(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(env.twilioAccountSid)}.json`,
    );
    if (account.status !== "active") {
      return { ok: false, error: `Twilio account is "${account.status}", not active.` };
    }

    if (env.twilioMessagingServiceSid) {
      const svc = await get(
        `https://messaging.twilio.com/v1/Services/${encodeURIComponent(env.twilioMessagingServiceSid)}`,
      );
      return { ok: true, detail: `messaging service "${svc.friendly_name as string}"` };
    }

    // A number that isn't on the account can't be sent from, whatever it says.
    const owned = (await get(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(env.twilioAccountSid)}` +
        `/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(env.twilioFrom)}`,
    )) as { incoming_phone_numbers?: unknown[] };
    if (!owned.incoming_phone_numbers?.length) {
      // A trial number is not returned by IncomingPhoneNumbers — the listing comes
      // back empty for an account that is demonstrably sending from it. Failing
      // here would call a working setup broken, which is worse than missing a
      // typo: on a trial the only number you can send from is the one Twilio gave
      // you, so there is little to typo. Keep the hard check for paid accounts,
      // where the listing is authoritative and a wrong number is a real mistake.
      if (String(account.type ?? "").toLowerCase() === "trial") {
        return {
          ok: true,
          detail: `sending from ${env.twilioFrom} (trial account — Twilio does not list trial numbers, so this one is unverified until a real send)`,
        };
      }
      return { ok: false, error: `TWILIO_FROM ${env.twilioFrom} is not a number on this account.` };
    }
    return { ok: true, detail: `sending from ${env.twilioFrom}` };
  } catch (err) {
    return { ok: false, error: (err as Error).message.slice(0, 200) };
  }
}

export interface SendSmsInput {
  /** Destination number in any format — normalized to E.164 before sending. */
  to: string;
  body: string;
}

/** Send one SMS through Twilio. Throws with Twilio's own message on failure. */
export async function sendSms(input: SendSmsInput): Promise<{ sid: string; to: string }> {
  const to = toE164(input.to);
  if (!to) {
    throw new Error(
      `"${input.to}" isn't a dialable number. Set SMS_DEFAULT_COUNTRY_CODE (e.g. "+386") or store the number in +international form.`,
    );
  }

  const form = new URLSearchParams({ To: to, Body: input.body });
  // A Messaging Service (a pool of numbers with sender selection) is the better
  // sender when configured; a single From number is the simple case.
  if (env.twilioMessagingServiceSid) {
    form.set("MessagingServiceSid", env.twilioMessagingServiceSid);
  } else {
    form.set("From", env.twilioFrom);
  }

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(env.twilioAccountSid)}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${env.twilioAccountSid}:${env.twilioAuthToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
    },
  );

  const json = (await res.json().catch(() => null)) as
    | { sid?: string; message?: string; code?: number }
    | null;

  if (!res.ok) {
    // Twilio's own error text is far more useful than the status code
    // ("The 'To' number is not a valid mobile number", "unverified number", …).
    const detail = json?.message ?? `HTTP ${res.status}`;
    throw new Error(json?.code ? `${detail} (Twilio ${json.code})` : detail);
  }
  return { sid: json?.sid ?? "", to };
}

/**
 * An `sms:` deep-link prefilled with the message — the manual fallback when Twilio
 * isn't configured, mirroring the Gmail compose link on the email path. Opens the
 * phone's/desktop's messaging app with the number and text filled in; the operator
 * presses send. (`?&body=` is the form iOS and Android both accept.)
 */
export function smsComposeUrl(to: string, body: string): string {
  return `sms:${toE164(to) ?? to.replace(/[^\d+]/g, "")}?&body=${encodeURIComponent(body)}`;
}
