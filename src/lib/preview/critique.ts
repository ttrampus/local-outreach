// Look at the rendered page and score it against the brief it was built from.
//
// audit.ts catches everything decidable from the source or from a pixel scan:
// a substituted ground, a banned family, a band of bare background, invisible
// text. What neither can answer is whether the page the designer was asked for
// is the page that got built — whether the briefed composition is actually
// there, whether the hero photograph is well cropped, whether the thing reads as
// bespoke or as the house template in a new colour. That needs eyes.
//
// Built on the pattern describePhotos() in aiSite.ts already established: a
// cheap Haiku vision call, usage recorded, best-effort, returning null on any
// failure so the caller degrades to "no critique" rather than losing the site.
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";
import { recordAiUsage } from "@/lib/aiUsage";
import type { ArtDirection } from "./designTokens";

const CRITIQUE_MODEL = "claude-haiku-4-5";

export interface CritiqueIssue {
  /** "blocking" mirrors audit.ts — worth spending a repair call on. */
  severity: "blocking" | "cosmetic";
  /** Where on the page, in plain language ("the hero", "the services section"). */
  where: string;
  what: string;
}

export interface Critique {
  /** 0–10. Below the configured threshold triggers a repair. */
  score: number;
  issues: CritiqueIssue[];
}

/**
 * Reuse of aiSite's loose JSON parse, kept local so the two modules don't have
 * to import each other (aiSite is the heavier module and critique is called
 * from the pipeline, not from it).
 */
function parseJsonLoose(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "");
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(t.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * A compact restatement of the brief — just the parts a screenshot can be
 * checked against. The full brief is thousands of tokens and most of it (copy
 * rules, content inventory, voice) is invisible in a hero screenshot, so sending
 * it would cost money to no purpose and dilute what the model is looking for.
 */
function briefDigest(d: ArtDirection): string {
  return [
    `PALETTE "${d.palette.id}" (${d.palette.mode}): the page ground must be ${d.palette.bg}, text ${d.palette.ink}, accent ${d.palette.accent}.`,
    `TYPE: display "${d.type.display}", body "${d.type.body}". ${d.type.treatment}`,
    `HERO COMPOSITION "${d.composition.id}": ${d.composition.structure} FORBIDDEN: ${d.composition.forbids}`,
    `HERO PATTERN "${d.hero.id}": ${d.hero.content} DELIBERATELY OMITTED: ${d.hero.omits}`,
    `SURFACE "${d.surface.id}": the ground must carry visible texture, not be a flat fill. ${d.surface.usage}`,
    `ICONS "${d.icons.id}": ${d.icons.expectsSvg ? d.icons.usage : "this page deliberately uses NO pictograms; a typographic numeral system replaces them."}`,
    `SIGNATURE DETAIL "${d.signature.id}": ${d.signature.spec}`,
  ].join("\n");
}

const INSTRUCTION = `You are reviewing a website mockup that will be sent to a local business owner in a cold outreach email. Two screenshots are attached: the first screen at 1280px desktop, then the same page on a 390px phone.

The designer was given a specification. Your job is to report where the page DEPARTS from it, and where it fails on its own terms. Judge only what you can actually see.

Check, in this order:
1. LEGIBILITY. Is every piece of text readable against what it actually sits on? Light text on a light ground is the single most common failure and it is always blocking.
2. THE BRIEFED GROUND. Is the page background the specified colour, and does it carry visible texture rather than being a flat fill?
3. THE BRIEFED COMPOSITION. Is the first screen the structure that was specified, or a different one? Does it do any of the things the composition forbids?
4. THE FOLD. Is more than half of the first screen empty ground? Is there any empty band taller than a quarter of the screen?
5. PHOTOGRAPHY. Is the business's own photo visible in the first screen, at a real size, with its subject intact and not cropped away or covered by an overlay?
6. ICONOGRAPHY. Are there hand-drawn icons where the spec asks for them, all in one consistent style? Emoji or star/arrow characters standing in for icons is blocking.
7. THE SIGNATURE DETAIL. Is it present, and is it built properly — aligned, deliberate — or bolted on?
8. THE PHONE SHOT. Does the layout hold at 390px, or does something overflow, overlap, or collapse?
9. GENERIC-LOOKING? Does this read as a bespoke page for this business, or as a template? Specifically flag: a wide-tracked uppercase eyebrow above the headline, a two-line headline with the second line in the accent colour, a filled button paired with a ghost-outline button, a rating stat block parked in a corner, a horizontal scrolling marquee of keywords.

Score 0-10 on whether an owner would believe a designer made this for them. 8+ means ship it. Be exacting but do not invent problems: if the page is good, say so and score it high.

Reply with ONLY minified JSON, no prose:
{"score":<0-10>,"issues":[{"severity":"blocking"|"cosmetic","where":"...","what":"..."}]}
"what" must be specific and actionable enough for the designer to fix without seeing the page again. Empty issues array is a valid answer.`;

/**
 * Score a rendered page. Returns null on any failure — no key, a refusal, an
 * unparseable reply — so the pipeline treats "we could not look at it" as
 * distinct from "we looked and it was fine".
 */
export async function critiqueRender(
  desktop: Buffer,
  mobile: Buffer | null,
  direction: ArtDirection,
  placeId: string,
): Promise<Critique | null> {
  if (!env.anthropicApiKey) return null;

  const client = new Anthropic({ apiKey: env.anthropicApiKey });
  const content: Anthropic.ContentBlockParam[] = [
    { type: "text", text: "Desktop, 1280px — the first screen:" },
    { type: "image", source: { type: "base64", media_type: "image/png", data: desktop.toString("base64") } },
  ];
  if (mobile) {
    content.push({ type: "text", text: "The same page at 390px:" });
    content.push({
      type: "image",
      source: { type: "base64", media_type: "image/png", data: mobile.toString("base64") },
    });
  }
  content.push({ type: "text", text: `THE SPECIFICATION THE DESIGNER WAS GIVEN:\n${briefDigest(direction)}\n\n${INSTRUCTION}` });

  try {
    const msg = await client.messages.create({
      model: CRITIQUE_MODEL,
      max_tokens: 2000,
      messages: [{ role: "user", content }],
    });
    await recordAiUsage("preview_critique", CRITIQUE_MODEL, msg.usage, placeId);

    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const obj = parseJsonLoose(text) as { score?: unknown; issues?: unknown } | null;
    if (!obj || typeof obj.score !== "number" || !Number.isFinite(obj.score)) return null;

    const issues: CritiqueIssue[] = Array.isArray(obj.issues)
      ? obj.issues
          .filter((i): i is Record<string, unknown> => typeof i === "object" && i !== null)
          .map((i): CritiqueIssue => ({
            severity: i.severity === "blocking" ? "blocking" : "cosmetic",
            where: typeof i.where === "string" ? i.where.slice(0, 120) : "unspecified",
            what: typeof i.what === "string" ? i.what.slice(0, 400) : "",
          }))
          .filter((i) => i.what.length > 0)
          .slice(0, 12)
      : [];

    return { score: Math.max(0, Math.min(10, obj.score)), issues };
  } catch (err) {
    console.error(`[critique] failed for ${placeId}:`, err);
    return null;
  }
}
