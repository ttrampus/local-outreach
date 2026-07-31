// Shared preview-build pipeline: turn a lead + its cached Google details into a
// single-page site (HTML + hero screenshot) and persist the paths. Used by the
// single-lead route and the bulk "regenerate all" route. Photos come from the
// on-disk cache, so regenerating never re-bills any Google SKU.
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { getCachedDetails, isCachedLanguageStale } from "@/lib/places";
import { refreshLeadDetails } from "@/lib/discovery";
import { generateSiteHtml } from "@/lib/preview/template";
import { generateAiSiteHtml } from "@/lib/preview/aiSite";
import { renderPreview } from "@/lib/preview/render";
import { fetchPreviewPhotos } from "@/lib/preview/photos";
import { fetchStaticMap } from "@/lib/preview/staticMap";
import { injectContactForm } from "@/lib/preview/contactForm";
import { detectLocale } from "@/lib/preview/i18n";
import type { NormalizedPlaceDetails } from "@/lib/leadSource/types";
import type { Prisma } from "@/generated/prisma/client";

type LeadWithRun = Prisma.LeadGetPayload<{ include: { searchRun: true } }>;

/** Build + screenshot + persist a preview for one already-loaded lead. */
export async function buildAndStorePreview(lead: LeadWithRun) {
  // Heal a snapshot cached under a different Places language before building.
  // Reviews, opening hours and the category label are all localized by Google
  // and land verbatim on the page, so a stale row silently ships an English site
  // for a non-English business. Re-fetching costs one Place Details call and
  // respects the existing daily/monthly ceilings (it returns "capped" instead of
  // spending), so a capped run just proceeds on the older snapshot.
  if (await isCachedLanguageStale(lead.placeId)) {
    const res = await refreshLeadDetails(lead.id);
    if (res.status !== "ok") {
      console.warn(
        `[preview] lead ${lead.id} (${lead.name}) has details cached in a different language and the refresh did not run (${res.status}) — the site may contain English copy`,
      );
    }
  }

  // Prefer the cached normalized details (review snippets, categories, photoRefs);
  // fall back to the flat Lead fields if the cache row is missing.
  const details: NormalizedPlaceDetails =
    (await getCachedDetails(lead.placeId)) ?? {
      placeId: lead.placeId,
      name: lead.name,
      address: lead.address ?? undefined,
      phone: lead.phone ?? undefined,
      website: lead.website ?? undefined,
      rating: lead.rating ?? undefined,
      reviewCount: lead.reviewCount,
      photoCount: lead.photoCount,
      reviewSnippets: [],
      categories: [],
    };

  const photos = await fetchPreviewPhotos(lead.placeId, details.photoRefs);
  const mapUri = await fetchStaticMap(lead.placeId, details);
  const searchHint = lead.searchRun?.query ?? "";

  // Engine: "ai" → Claude designs a bespoke site (falls back to the template on any
  // failure); "template" → the free deterministic generator. Default to AI when an
  // Anthropic key is configured, since bespoke sites are what make outreach land.
  const requested = env.previewEngine || (env.anthropicApiKey ? "ai" : "template");

  // Record which engine actually produced the HTML rather than collapsing the two
  // with `??`. The AI path returns null on any failure, so without this a silently
  // failed design is indistinguishable from a real one in the previews directory.
  // `?? 0` because callers hand us a Lead object they loaded themselves, which
  // may predate this column or come from a narrower select.
  const variant = lead.previewVariant ?? 0;
  const aiHtml =
    requested === "ai"
      ? await generateAiSiteHtml(details, searchHint, photos, mapUri, variant)
      : null;
  if (requested === "ai" && aiHtml === null) {
    console.warn(
      `[preview] AI design unavailable for lead ${lead.id} (${lead.name}) — served the deterministic template instead`,
    );

    // ...unless this lead already has an unreproducible design. Falling back would
    // repoint previewHtmlPath at a fresh template and orphan a site that cost real
    // money (ai) or real human effort (manual) and cannot be recreated. That is
    // exactly how the first AI batch was lost: a regenerate-all sweep ran with no
    // API key, every design silently degraded to a template, and the originals were
    // overwritten. Keep what we have and let the caller see it as a no-op.
    if (lead.previewEngine && lead.previewEngine !== "template" && lead.previewHtmlPath) {
      console.warn(
        `[preview] keeping the existing ${lead.previewEngine} preview for lead ${lead.id} (${lead.name}) rather than downgrading it to a template`,
      );
      return lead;
    }
  }
  const engine = aiHtml ? "ai" : "template";
  const rawHtml = aiHtml ?? generateSiteHtml(details, searchHint, photos, mapUri, variant);

  // Swap in a real, working contact form (posts enquiries back to this app). It
  // lives below the hero, so the outreach screenshot stays clean; on the live /p/
  // page and the deployed customer site it's a functioning enquiry form.
  const html = injectContactForm(rawHtml, lead.id, detectLocale(details));

  const { imagePath, mobileImagePath, htmlPath } = await renderPreview(
    lead.placeId,
    html,
    engine,
    variant,
  );

  return prisma.lead.update({
    where: { id: lead.id },
    data: {
      previewImagePath: imagePath,
      previewMobileImagePath: mobileImagePath,
      previewHtmlPath: htmlPath,
      previewEngine: engine,
      previewVariant: variant,
      // Advance the funnel only if we haven't moved past this stage already.
      status: lead.status === "discovered" ? "preview_ready" : lead.status,
    },
  });
}

export interface BulkRegenResult {
  total: number;
  ok: number;
  failed: number;
}

/**
 * Rebuild every lead that already has a preview, so older previews pick up the
 * current template (e.g. new animations). Sequential on purpose — each render
 * launches a headless browser, and one at a time keeps memory bounded. Per-lead
 * failures are counted, never thrown, so one bad lead can't abort the batch.
 */
export async function regenerateExistingPreviews(): Promise<BulkRegenResult> {
  const leads = await prisma.lead.findMany({
    where: { previewHtmlPath: { not: null } },
    include: { searchRun: true },
  });

  let ok = 0;
  let failed = 0;
  for (const lead of leads) {
    try {
      await buildAndStorePreview(lead);
      ok += 1;
    } catch (err) {
      failed += 1;
      console.error(`[regenerate-all] lead ${lead.id} failed:`, err);
    }
  }
  return { total: leads.length, ok, failed };
}
