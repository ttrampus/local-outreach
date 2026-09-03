// The few phrases the app itself contributes to an outreach email, per locale.
//
// Everything else in the message is written by Claude in the prospect's own
// language (see claude.ts), so anything WE add has to match it or the email ends
// with an English tail on a Slovenian message — the exact tell that gives away a
// template. Kept here rather than in preview/i18n.ts, which is the vocabulary of
// the generated websites and has no business knowing about email.
import type { Locale } from "@/lib/preview/i18n";

export interface EmailStrings {
  /** Anchor text for the preview link. */
  previewLink: string;
  /**
   * The opt-out. Deliberately NOT "unsubscribe": nobody subscribed to a cold
   * email, and offering to end a subscription they never started reads as either
   * a mistake or a dark pattern. What is actually on offer is "I will stop".
   */
  optOut: string;
}

const EN: EmailStrings = {
  previewLink: "See your website preview",
  optOut: "Not interested? Let me know and I won't contact you again.",
};

const SL: EmailStrings = {
  previewLink: "Oglejte si predlog spletne strani",
  optOut: "Vas ne zanima? Sporočite mi in vas ne bom več kontaktiral.",
};

const STRINGS: Record<Locale, EmailStrings> = { en: EN, sl: SL };

export function getEmailStrings(locale: Locale): EmailStrings {
  return STRINGS[locale] ?? EN;
}
