// Turn a raw Google business name into a clean display name for the hero/nav.
// Google names are often cluttered: "Lassana - frizerski, pedikerski in kozmetični
// salon Mateja Mikiša s.p." — the brand is just "Lassana". We strip legal forms,
// prefer the segment before a dash, and length-cap. Used by the template fallback;
// the AI engine derives its own tasteful name in-context.
const LEGAL_SRC =
  /\b(s\.?\s?p\.?|d\.?\s?o\.?\s?o\.?|d\.?\s?d\.?|d\.?\s?n\.?\s?o\.?|k\.?\s?d\.?|z\.?\s?o\.?\s?o\.?|ltd\.?|l\.?l\.?c\.?|inc\.?|gmbh|s\.?r\.?o\.?)\b\.?/;
const LEGAL = new RegExp(LEGAL_SRC.source, "gi");
/** Non-global copy — `.test()` on a /g regex is stateful and skips matches. */
const HAS_LEGAL = new RegExp(LEGAL_SRC.source, "i");

/** Drop a dangling "(" / "[" left behind by truncation, plus trailing punctuation. */
function tidyBrackets(s: string): string {
  let out = s;
  for (const [open, close] of [
    ["(", ")"],
    ["[", "]"],
  ] as const) {
    const opens = out.split(open).length - 1;
    const closes = out.split(close).length - 1;
    // More openers than closers → cut from the last unmatched opener onward.
    if (opens > closes) out = out.slice(0, out.lastIndexOf(open));
  }
  return out.replace(/[\s,\-–—([]+$/g, "").trim();
}

export function cleanDisplayName(name: string): string {
  let n = (name ?? "").trim();
  if (!n) return name;

  // "Brand - long descriptive tail" → keep the brand, if it's substantial.
  const segs = n.split(/\s[–—-]\s/);
  if (segs.length > 1 && segs[0].trim().length >= 2) n = segs[0].trim();

  // "Frizerski salon Marija, Marija Trdin s.p." → the comma tail is the owner and
  // legal entity, not the brand. Only applied when a legal form is actually
  // present, so an ordinary comma in a name is left alone. Truncating instead
  // produced headlines like "Frizerski salon Marija, Marija".
  if (HAS_LEGAL.test(n) && n.includes(",")) {
    const head = n.split(",")[0].trim();
    if (head.length >= 3) n = head;
  }

  n = n.replace(LEGAL, "").replace(/[,\s]+$/g, "").trim();

  // A trailing parenthetical is a descriptor ("(Hair Extensions Ljubljana)"),
  // not the brand — drop it before length-capping, so the cap doesn't slice the
  // parenthesis open and leave "Golden Boys (Hair Extensions" in a giant hero.
  const withoutParen = n.replace(/\s*[([][^)\]]*[)\]]?\s*$/, "").trim();
  if (withoutParen.length >= 2) n = withoutParen;

  // Still a mouthful → keep the first few words (the recognizable part).
  if (n.length > 30) {
    n = n.split(/\s+/).slice(0, 4).join(" ");
  }

  n = tidyBrackets(n);
  return n.length >= 2 ? n : name;
}
