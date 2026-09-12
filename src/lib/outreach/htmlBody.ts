// The HTML half of an outreach email.
//
// Every message goes out multipart/alternative: this, plus the plain text it was
// built from. That is not belt-and-braces — a receiver that finds only HTML, or
// an HTML part whose text alternative says something different, is looking at one
// of the older spam heuristics there is. The two parts must say the same thing.
//
// The markup is deliberately impoverished. No tables, no images, no tracking
// pixel, no button, no width, no background — a person's mail client would emit
// roughly this, and anything more elaborate reads as a campaign. The one thing
// HTML buys us over plain text is the reason it exists here: a preview URL is
// ~45 characters and wraps across three lines in most clients, which looks
// broken. As an anchor it is one line of link text.
//
// Anchor text is a real translated phrase rather than a disguised URL. Text that
// LOOKS like a different address than the href is the classic phishing shape and
// is scored as such; ordinary link text is not.

/** Escape for text that lands inside an HTML element. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Escape for a value that lands inside a double-quoted attribute. */
function escAttr(s: string): string {
  return esc(s).replace(/'/g, "&#39;");
}

// Trailing punctuation is not part of a URL that ends a sentence, and neither is
// the bold marker below — "**https://…**" must link the address, not the markers.
const URL_RE = /https?:\/\/[^\s<>"'*]+[^\s<>"'*.,;:!?)]/g;

// The one piece of markup the drafters may use: **bold**, for the price. Kept to
// one construct on purpose — a body with headings and bullet lists is a brochure,
// and the plain-text alternative has to remain a readable message on its own.
const BOLD_RE = /\*\*(.+?)\*\*/g;

/**
 * The plain-text half of the same message: the body with the bold markers taken
 * out. Both parts must say the same thing (see the header), and a reader whose
 * client shows text sees prose, not asterisks.
 */
export function toPlainTextEmail(text: string): string {
  return text.replace(BOLD_RE, "$1");
}

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export interface HtmlEmailOptions {
  /** Anchor text for links pointing at `linkUrl`. Other URLs keep their address. */
  linkUrl?: string | null;
  linkLabel?: string;
  /** The opt-out, rendered as a quiet last line. */
  optOutUrl?: string | null;
  optOutLabel?: string;
}

/** Turn the drafter's **bold** into <strong>, after escaping and linking. */
function bold(html: string): string {
  return html.replace(BOLD_RE, (_m, inner: string) => `<strong>${inner}</strong>`);
}

/**
 * Render a plain-text outreach body as minimal HTML. Blank lines become
 * paragraphs and single newlines become breaks, which is how the text was
 * written and how it reads back.
 */
export function toHtmlEmail(text: string, opts: HtmlEmailOptions = {}): string {
  const { linkUrl, linkLabel, optOutUrl, optOutLabel } = opts;

  const paragraphs = text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const html = esc(block).replace(URL_RE, (url) => {
        // Only the preview link gets prose for its anchor; any other URL keeps
        // its address as its text, because replacing THAT with words would be
        // the disguise this file's header warns about. Dropping the scheme and a
        // trailing slash is not a disguise — the domain, which is the part a
        // reader checks, is still exactly what it says.
        const isPreview = Boolean(linkUrl && url === linkUrl && linkLabel);
        const label = isPreview
          ? (linkLabel as string)
          : url.replace(/^https?:\/\//, "").replace(/\/$/, "");
        // The preview link is the one thing the email is asking for, so it is
        // weighted — bold text, still a link and not a rendered button, because
        // a button-shaped call to action is what a campaign looks like.
        const weight = isPreview ? ";font-weight:600" : "";
        return `<a href="${escAttr(url)}" style="color:#1a56db${weight}">${esc(label)}</a>`;
      });
      return `<p style="margin:0 0 14px">${bold(html).replace(/\n/g, "<br>")}</p>`;
    })
    .join("");

  const optOut =
    optOutUrl && optOutLabel
      ? `<p style="margin:22px 0 0;font-size:13px;color:#8a8a8a">` +
        `<a href="${escAttr(optOutUrl)}" style="color:#8a8a8a">${esc(optOutLabel)}</a></p>`
      : "";

  return (
    `<div style="font-family:${FONT};font-size:15px;line-height:1.55;color:#1a1a1a">` +
    paragraphs +
    optOut +
    `</div>`
  );
}
