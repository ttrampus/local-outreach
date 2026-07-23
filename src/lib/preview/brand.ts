// Turn a raw Google business name into a clean display name for the hero/nav.
// Google names are often cluttered: "Lassana - frizerski, pedikerski in kozmetični
// salon Mateja Mikiša s.p." — the brand is just "Lassana". We strip legal forms,
// prefer the segment before a dash, and length-cap. Used by the template fallback;
// the AI engine derives its own tasteful name in-context.
const LEGAL =
  /\b(s\.?\s?p\.?|d\.?\s?o\.?\s?o\.?|d\.?\s?d\.?|d\.?\s?n\.?\s?o\.?|k\.?\s?d\.?|z\.?\s?o\.?\s?o\.?|ltd\.?|l\.?l\.?c\.?|inc\.?|gmbh|s\.?r\.?o\.?)\b\.?/gi;

export function cleanDisplayName(name: string): string {
  let n = (name ?? "").trim();
  if (!n) return name;

  // "Brand - long descriptive tail" → keep the brand, if it's substantial.
  const segs = n.split(/\s[–—-]\s/);
  if (segs.length > 1 && segs[0].trim().length >= 2) n = segs[0].trim();

  n = n.replace(LEGAL, "").replace(/[,\s]+$/g, "").trim();

  // Still a mouthful → keep the first few words (the recognizable part).
  if (n.length > 30) {
    n = n.split(/\s+/).slice(0, 4).join(" ").replace(/[,\s]+$/g, "");
  }

  return n.length >= 2 ? n : name;
}
