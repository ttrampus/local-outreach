// Build the outreach sequence without an LLM — the fallback for when Claude is
// unavailable (see ./claude.ts, which writes the same shape with one personalized
// clause added).
//
// The message leads with the preview, because the preview IS the pitch: an owner
// who opens it has already seen what they'd be buying. Then one price, once, with
// the point that adjustments are included — not a menu of plans. The monthly care
// plan is deliberately absent from outreach; it turns a single yes/no into a
// recurring-cost question, and it is a conversation for after they say yes.
//
// Written in the prospect's language, and it calls them by the kind of business
// they actually are. Saved as a draft, never sent.
import type { Lead } from "@/generated/prisma/client";
import type { NormalizedPlaceDetails } from "@/lib/leadSource/types";
import { PRICING } from "@/lib/pricing";
import { BRAND } from "@/lib/brand";
import { detectLocale, type Locale } from "@/lib/preview/i18n";
import { businessPhrase } from "./emailStrings";
import { classifyWebPresence } from "@/lib/qualify";

/** One message in an outreach sequence. step 0 = initial; 1.. = follow-ups. */
export interface OutreachMessage {
  step: number;
  subject: string;
  body: string;
}

/** A full outreach sequence for one lead: a channel/contact + ordered messages. */
export interface OutreachDraft {
  channel: string;
  contact: string | null;
  messages: OutreachMessage[];
}

/**
 * Build a direct-message deep link for a Facebook/Instagram page URL, if possible.
 * m.me/<page> opens the page's Messenger thread; ig.me/m/<user> opens an IG DM.
 * These are OPEN-a-chat links — actually sending the DM stays a human click,
 * because neither platform has an API for cold DMs (automating them via bots
 * violates Meta's ToS and gets the sending account banned).
 */
function socialDmLink(website: string): { channel: string; contact: string } | null {
  const { presence, platform } = classifyWebPresence(website);
  if (presence !== "social" || !platform) return null;
  try {
    const u = new URL(website);
    const path = u.pathname.split("/").filter(Boolean);
    if (platform === "Facebook") {
      // facebook.com/<page> or facebook.com/profile.php?id=<id> — m.me takes both.
      const id = path[0] === "profile.php" ? u.searchParams.get("id") : path[0];
      if (id) return { channel: "facebook", contact: `https://m.me/${id}` };
    }
    if (platform === "Instagram") {
      const user = path[0];
      if (user && !["p", "reel", "reels", "explore", "stories"].includes(user)) {
        return { channel: "instagram", contact: `https://ig.me/m/${user}` };
      }
    }
  } catch {
    /* unparseable URL — fall through to the next channel */
  }
  return null;
}

/** Where the sign-off points when the caller doesn't say. */
const SITE_URL = "https://avenyo.app";

/** Knobs that change which channels are even available to pick from. */
export interface ChannelOptions {
  /** True when Twilio is configured, so an SMS can actually be delivered. */
  smsEnabled?: boolean;
}

/** Everything buildDraft needs beyond the lead itself. */
export interface DraftOptions extends ChannelOptions {
  /** Public preview link (…/p/<leadId>). An SMS has no attachment — it needs this. */
  previewUrl?: string;
  /** Our own site, for the sign-off. Falls back to the public domain. */
  siteUrl?: string;
}

/**
 * Decide the first-touch channel, best available first:
 *   email (delivered by us over SMTP)
 *   > SMS (delivered by us over Twilio — only offered when Twilio is configured,
 *     otherwise a phone number is better spent on a DM or a call)
 *   > Facebook/Instagram DM (one click opens the thread, the operator pastes —
 *     often the ONLY channel for social-only businesses, and locals answer DMs)
 *   > phone (opens the dialer; the call is the operator's to make)
 *   > manual (nothing usable on file).
 *
 * We deliberately avoid WhatsApp: cold WhatsApp messaging breaches WhatsApp
 * Business policy and risks a ban on the sending number.
 *
 * This module is imported by client-safe code paths, so config arrives as an
 * argument rather than by reading `env` here.
 */
export function pickChannel(
  lead: Pick<Lead, "email" | "phone" | "website">,
  opts: ChannelOptions = {},
): {
  channel: string;
  contact: string | null;
} {
  if (lead.email) return { channel: "email", contact: lead.email };
  if (opts.smsEnabled && lead.phone) return { channel: "sms", contact: lead.phone };
  const dm = lead.website ? socialDmLink(lead.website) : null;
  if (dm) return dm;
  if (lead.phone) return { channel: "phone", contact: lead.phone };
  return { channel: "manual", contact: null };
}


/**
 * How the message points at the work. Always a link, never an attachment: mail
 * from this domain is plain text, so an attached PNG was never shown inline, and
 * attachments from an unknown sender are both ignored by people and penalised by
 * spam filters. The live page is the better artefact regardless — it is the real
 * site, and opening it is a signal we can see.
 *
 * The link sits alone on its line because that is what the HTML half turns into a
 * single clickable line of prose (see htmlBody.ts) — a bare URL in the middle of
 * a sentence wraps across three lines and looks broken.
 */
function previewLink(lead: Lead, previewUrl?: string): string | null {
  return lead.deployedUrl || previewUrl || null;
}

/** The fixed-shape sequence, per locale. Mirrors the spec Claude writes to. */
interface Sequence {
  subject: string;
  initial: string;
  followup1: string;
  followup2: string;
  smsInitial: string;
  smsFollowup1: string;
  smsFollowup2: string;
}

/**
 * The deterministic sequence, in the prospect's language.
 *
 * This is the fallback for when Claude is unavailable, so it says exactly what
 * the Claude prompt asks for — a greeting, the idea, the preview, the price with
 * adjustments included, and how to answer — minus the one personalized clause,
 * which is the only thing a template genuinely cannot do. A message that changes
 * shape depending on whether an API key was set is a message nobody can iterate
 * on.
 */
function sequence(
  locale: Locale,
  business: string,
  link: string | null,
  price: string,
  priceShort: string,
  signOff: string,
): Sequence {
  // No link yet means there is nothing to look at, so the whole pitch collapses
  // to an offer to send one — the preview is the argument.
  const linkBlock = link ? `\n\n${link}` : "";

  if (locale === "sl") {
    return {
      subject: "Naredil sem vam predogled nove spletne strani",
      initial: `Pozdravljeni,

naletel sem na ${business} in sem imel idejo, kako bi lahko vaša spletna stran izgledala precej bolj moderno.

${link ? "Zato sem vam kar pripravil predogled:" : "Z veseljem vam pripravim predogled, da vidite, kako bi izgledala."}${linkBlock}

Če vam je všeč, jo lahko za ${price} dokončam in objavim na vaši domeni. V ceno je vključeno vse, kar potrebujete za dokončno stran, tudi prilagoditve — če želite kaj dodati, spremeniti ali popraviti, uredimo brez doplačila.

Ni torej treba posebej plačevati za vsako manjšo spremembo.

Če vam je predogled zanimiv, lahko samo kliknete gumb na predogledu ali mi odgovorite na ta mail in se dogovorimo.

${signOff}`,
      followup1: `Pozdravljeni,

samo na kratko glede predogleda spletne strani, ki sem vam ga poslal — ste ga uspeli pogledati?${linkBlock}

Če vam kaj ni všeč, mi povejte in popravim. Za dogovor zadostuje en klik na gumb na strani.

${signOff}`,
      followup2: `Pozdravljeni,

predogled bom kmalu umaknil, da sprostim prostor. Če želite, da stran objavim na vaši domeni (${priceShort}), mi samo odgovorite na to sporočilo.

Kakor koli se odločite, hvala za vaš čas.

${signOff}`,
      smsInitial: `Pozdravljeni, pripravil sem vam predogled nove spletne strani.${link ? ` ${link}` : ""}

Če vam je všeč, jo za ${priceShort} dokončam in objavim na vaši domeni.

[Your name]`,
      smsFollowup1: `Pozdravljeni, ste uspeli pogledati predogled spletne strani?${link ? ` ${link}` : ""} Karkoli vam ni všeč, popravim.

[Your name]`,
      smsFollowup2: `Pozdravljeni, predogled bom kmalu umaknil. Če želite, da stran objavim (${priceShort}), mi samo odgovorite. Hvala!

[Your name]`,
    };
  }

  return {
    subject: "I made you a preview of a new website",
    initial: `Hello,

I came across ${business} and had an idea for how your website could look a lot more modern.

${link ? "So I went ahead and made you a preview:" : "I'd be glad to put a preview together so you can see it."}${linkBlock}

If you like it, I can finish it and publish it on your domain for ${price}. That price covers everything the finished site needs, adjustments included — anything you'd like added, changed or fixed, at no extra charge.

So there's nothing extra to pay for every small change.

If the preview looks interesting, just press the button on it or reply to this email and we'll sort out the details.

${signOff}`,
    followup1: `Hello,

Just a quick note about the website preview I sent — did you get a chance to look at it?${linkBlock}

If anything feels off, tell me and I'll change it. The button on the page is one press.

${signOff}`,
    followup2: `Hello,

I'll be taking the preview down soon to free it up. If you'd like it live on your domain (${priceShort}), just reply to this message.

Either way, thanks for your time.

${signOff}`,
    smsInitial: `Hello — I made you a preview of a new website.${link ? ` ${link}` : ""}

If you like it, I'll finish it and put it live on your domain for ${priceShort}.

[Your name]`,
    smsFollowup1: `Hello — did you get a chance to look at the website preview?${link ? ` ${link}` : ""} Anything you don't like, I'll change.

[Your name]`,
    smsFollowup2: `Hello — I'll take the preview down soon. If you'd like it live (${priceShort}), just reply. Thanks!

[Your name]`,
  };
}

export function buildDraft(
  lead: Lead,
  details: NormalizedPlaceDetails,
  opts: DraftOptions = {},
): OutreachDraft {
  const { channel, contact } = pickChannel(lead, opts);
  const locale = detectLocale(details);
  // The ONE thing that varies between one prospect's email and another's: a café
  // is not a salon, and being called the wrong kind of business is the fastest way
  // to be read as a mailshot.
  const business = businessPhrase(locale, details.categories);
  const link = previewLink(lead, opts.previewUrl);

  // Bold survives into the HTML half and is stripped out of the plain-text one.
  // Written per locale rather than taken from pricing.ts, whose sentence is the
  // English one Claude translates — dropping it into a Slovene body unchanged is
  // exactly the English tail that gives a template away.
  const priceShort = locale === "sl" ? `${PRICING.buildEur} €` : `€${PRICING.buildEur}`;

  // The sign-off lives IN the body — who this is, the company, the site — rather
  // than being appended as a signature block. Mail clients fold a trailing block
  // that looks like a signature into the "…" quoted-text collapse, and a sender a
  // stranger cannot see is a sender they don't trust. The site carries the scheme
  // so the HTML half can link it; it is displayed as the bare domain.
  const signOff = [
    locale === "sl" ? "Lep pozdrav," : "Best,",
    "[Your name]",
    BRAND.name,
    `**${opts.siteUrl ?? SITE_URL}**`,
  ].join("\n");

  const seq = sequence(locale, business, link, `**${priceShort}**`, priceShort, signOff);
  const { subject } = seq;
  const re = locale === "sl" ? "Odg:" : "Re:";

  // An SMS is billed per 160-character segment and read on a lock screen, so the
  // long-form body above is the wrong shape entirely — send the short variant.
  // (Claude writes its own short variant when a key is set; this is the fallback.)
  if (channel === "sms") {
    return {
      channel,
      contact,
      messages: [
        { step: 0, subject, body: seq.smsInitial },
        { step: 1, subject: `${re} ${subject}`, body: seq.smsFollowup1 },
        { step: 2, subject: `${re} ${subject}`, body: seq.smsFollowup2 },
      ],
    };
  }

  return {
    channel,
    contact,
    messages: [
      { step: 0, subject, body: seq.initial },
      { step: 1, subject: `${re} ${subject}`, body: seq.followup1 },
      { step: 2, subject: `${re} ${subject}`, body: seq.followup2 },
    ],
  };
}
