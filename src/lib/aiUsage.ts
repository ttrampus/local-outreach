// Claude API cost accounting — one row per billable call, mirroring what usage.ts
// does for Google SKUs. Every Claude call site (preview vision/reviews/design,
// outreach drafting) reports its token usage here so the analytics dashboard can
// answer "what does a preview actually cost" and "AI spend vs revenue".
//
// Recording is strictly best-effort: a failed insert must never break the
// generation that produced the tokens (the money is already spent either way).
import { prisma } from "@/lib/prisma";

export type AiPurpose =
  | "preview_vision" // Haiku photo captioning + hero pick
  | "preview_reviews" // Haiku review-insight mining
  | "preview_design" // the big Opus site-design call
  | "preview_critique" // Haiku visual review of the rendered page
  | "preview_repair" // RETIRED: Opus correction pass. Nothing writes this any
  //                    more (it cost more per call than the generation it fixed);
  //                    the member stays so historical rows keep a typed name.
  | "outreach_draft"; // Claude-written outreach sequence

// USD per million tokens, matched by model-id prefix (longest match wins by
// order). Mirrors https://platform.claude.com/docs/en/pricing — update alongside
// any ANTHROPIC_MODEL change.
const PRICES: { prefix: string; inPerM: number; outPerM: number }[] = [
  { prefix: "claude-fable-5", inPerM: 10, outPerM: 50 },
  { prefix: "claude-opus", inPerM: 5, outPerM: 25 },
  { prefix: "claude-sonnet", inPerM: 3, outPerM: 15 },
  { prefix: "claude-haiku", inPerM: 1, outPerM: 5 },
];

/** The subset of the SDK's usage object we bill from. */
export interface UsageLike {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

/** Estimate the USD cost of one call (cache reads ~0.1×, cache writes ~1.25×). */
export function estimateCostUsd(model: string, usage: UsageLike): number {
  const price = PRICES.find((p) => model.startsWith(p.prefix));
  if (!price) return 0; // unknown model — record tokens, don't guess a price

  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const inputCost =
    (usage.input_tokens + cacheRead * 0.1 + cacheWrite * 1.25) * (price.inPerM / 1_000_000);
  const outputCost = usage.output_tokens * (price.outPerM / 1_000_000);
  return inputCost + outputCost;
}

/** Record one billable Claude call. Never throws. */
export async function recordAiUsage(
  purpose: AiPurpose,
  model: string,
  usage: UsageLike,
  placeId?: string,
): Promise<void> {
  try {
    await prisma.aiUsage.create({
      data: {
        purpose,
        model,
        placeId: placeId ?? null,
        inputTokens:
          usage.input_tokens +
          (usage.cache_read_input_tokens ?? 0) +
          (usage.cache_creation_input_tokens ?? 0),
        outputTokens: usage.output_tokens,
        costUsd: estimateCostUsd(model, usage),
      },
    });
  } catch (err) {
    console.error(`[aiUsage] failed to record ${purpose} call:`, err);
  }
}
