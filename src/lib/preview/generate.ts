// Shared preview-build pipeline: turn a lead + its cached Google details into a
// single-page site (HTML + hero screenshot) and persist the paths. Used by the
// single-lead route and the bulk "regenerate all" route. Photos come from the
// on-disk cache, so regenerating never re-bills any Google SKU.
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { createSemaphore } from "@/lib/concurrency";
import { getCachedDetails, isCachedLanguageStale } from "@/lib/places";
import { refreshLeadDetails } from "@/lib/discovery";
import { generateSiteHtml } from "@/lib/preview/template";
import { generateAiSiteHtml } from "@/lib/preview/aiSite";
import { renderPreview, type RenderResult } from "@/lib/preview/render";
import { auditHtml, summarize, type Finding } from "@/lib/preview/audit";
import { critiqueRender } from "@/lib/preview/critique";
import { fetchPreviewPhotos } from "@/lib/preview/photos";
import { fetchStaticMap } from "@/lib/preview/staticMap";
import { injectContactForm } from "@/lib/preview/contactForm";
import { detectLocale } from "@/lib/preview/i18n";
import type { NormalizedPlaceDetails } from "@/lib/leadSource/types";
import type { Prisma } from "@/generated/prisma/client";

type LeadWithRun = Prisma.LeadGetPayload<{ include: { searchRun: true } }>;

// Module-level, so every caller shares one queue. Gating here rather than in the
// route covers the bulk regenerator too — it is already sequential by hand, and
// this makes that guarantee structural instead of a comment someone can miss.
const previewSemaphore = createSemaphore(env.previewConcurrency);

/**
 * Build + screenshot + persist a preview for one already-loaded lead.
 *
 * Queued rather than run immediately: see src/lib/concurrency.ts. A caller may
 * wait minutes for a slot, which is why the HTTP path in front of this needs a
 * generous proxy timeout.
 */
export async function buildAndStorePreview(lead: LeadWithRun) {
  if (previewSemaphore.pending > 0) {
    console.log(
      `[preview] lead ${lead.id} queued behind ${previewSemaphore.pending} other build(s)`,
    );
  }
  return previewSemaphore.withSlot(() => buildAndStore(lead));
}

/**
 * Retry the render once, and only the render. Launching Chromium is the step that
 * fails transiently (a slow page, a browser that didn't come up), and repeating it
 * costs nothing but time. The AI design is deliberately not retried: it already
 * degrades to the template internally on failure, and a second attempt would bill
 * another full generation.
 */
async function render(
  lead: LeadWithRun,
  html: string,
  engine: string,
  variant: number,
): Promise<RenderResult> {
  try {
    return await renderPreview(lead.placeId, html, engine, variant);
  } catch (err) {
    console.warn(`[preview] render failed for lead ${lead.id} (${lead.name}), retrying once:`, err);
    return renderPreview(lead.placeId, html, engine, variant);
  }
}

function countBlocking(findings: Finding[], issues: { severity: string }[]): number {
  return (
    findings.filter((f) => f.severity === "blocking").length +
    issues.filter((i) => i.severity === "blocking").length
  );
}

async function buildAndStore(lead: LeadWithRun) {
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
  const ai =
    requested === "ai"
      ? await generateAiSiteHtml(details, searchHint, photos, mapUri, variant)
      : null;
  if (requested === "ai" && ai === null) {
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
  const engine = ai ? "ai" : "template";
  const siteHtml = ai?.html ?? generateSiteHtml(details, searchHint, photos, mapUri, variant);
  const locale = detectLocale(details);

  // Swap in a real, working contact form (posts enquiries back to this app). It
  // lives below the hero, so the outreach screenshot stays clean; on the live /p/
  // page and the deployed customer site it's a functioning enquiry form.
  const html = injectContactForm(siteHtml, lead.id, locale);

  const rendered = await render(lead, html, engine, variant);

  // ── Verify, and report ──────────────────────────────────────────────────────
  // Only for the AI engine: the template is deterministic and already known-good.
  //
  // There used to be a repair pass here — on a failed audit or a low visual score
  // it sent the page back to Opus for a correction. It was removed on cost: it
  // fired on a quarter of builds and cost MORE per call than the generation it was
  // fixing (the whole document goes back in and the whole document comes back
  // out), which made it about 27% of the AI cost of a lead on its own. What it
  // bought was marginal — it was kept only when it strictly reduced the blocking
  // count, which was often not the case.
  //
  // The checks stay, because they are nearly free (static audit is local, the
  // visual review is a ~$0.008 Haiku call) and because they are the measurement
  // that tells you whether a prompt change made the pages better or worse. They
  // now only report. A page that fails its brief is a signal to fix the DESIGN
  // PROMPT — where the fix applies to every future lead at no per-lead cost — or
  // to regenerate that one lead by hand from the console.
  if (ai) {
    // The static pass runs on the PRE-substitution document — that is where the
    // {{CONTACT_FORM}} token is still visible and where the file is small enough
    // to scan cheaply.
    const staticFindings = auditHtml(ai.rawHtml, ai.direction);
    const findings = [...staticFindings, ...(rendered.audit?.findings ?? [])];

    const critique = await critiqueRender(
      rendered.desktopShot,
      rendered.mobileShot,
      ai.direction,
      details.placeId,
    );

    const label = `lead ${lead.id} (${lead.name})`;
    console.log(
      `[preview] ${label} audit: ${summarize(findings)}${
        critique ? `, visual score ${critique.score}/10` : ", visual review unavailable"
      }`,
    );
    for (const f of findings) console.log(`[preview]   · [${f.severity}] ${f.check}: ${f.detail}`);
    for (const i of critique?.issues ?? []) console.log(`[preview]   · [${i.severity}] ${i.where}: ${i.what}`);

    // Say it once, loudly, at the end: this page went out to a stranger with
    // something visibly wrong on it. Nothing downstream acts on this — it is for
    // you, so a bad batch is obvious in the log instead of only in the previews.
    const blocking = countBlocking(findings, critique?.issues ?? []);
    if (blocking > 0) {
      console.warn(
        `[preview] ${label} shipped with ${blocking} blocking defect(s) — review the design prompt or regenerate this lead`,
      );
    }
  }

  const { imagePath, mobileImagePath, htmlPath } = rendered;

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
 *
 * BUDGET THIS ONE. Every lead in the sweep re-bills a full design call (~$0.58 at
 * Opus prices) plus the cheap Haiku steps, so a hundred existing previews is
 * roughly $60 and a couple of hours of sequential Chromium renders.
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
