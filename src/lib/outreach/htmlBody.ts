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

// Trailing punctuation is not part of a URL that ends a sentence.
const URL_RE = /https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)]/g;

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
        // the disguise this file's header warns about.
        const label = linkUrl && url === linkUrl && linkLabel ? linkLabel : url;
        return `<a href="${escAttr(url)}" style="color:#1a56db">${esc(label)}</a>`;
      });
      return `<p style="margin:0 0 14px">${html.replace(/\n/g, "<br>")}</p>`;
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
