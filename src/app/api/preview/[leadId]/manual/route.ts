// Manual (zero-cost) design route — the paste-it-yourself counterpart to the
// billed AI path.
//
//   GET  /api/preview/:leadId/manual   → the exact design brief, as plain text.
//                                        Paste it into a chat UI yourself.
//   POST /api/preview/:leadId/manual   → paste the returned HTML back (raw body).
//                                        Placeholders are filled, the contact form
//                                        injected, the hero screenshot rendered and
//                                        everything stored, exactly as the API path
//                                        does. Recorded as previewEngine="manual".
//
// This makes no Anthropic API calls, so it costs nothing and needs no key. It is
// one business at a time by hand — a way to produce a few good sites without
// spend, not a substitute for the automated path.
//
// The prompt is pure text: photos never enter it (the design references
// {{PHOTO_0}}… and the real bytes are substituted here afterwards), so there is
// nothing large to copy and the pasted HTML stays small.
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { getCachedDetails } from "@/lib/places";
import { fetchPreviewPhotos } from "@/lib/preview/photos";
import { fetchStaticMap } from "@/lib/preview/staticMap";
import { buildManualDesignPrompt, applyPlaceholders, extractHtml } from "@/lib/preview/aiSite";
import { injectContactForm } from "@/lib/preview/contactForm";
import { detectLocale } from "@/lib/preview/i18n";
import { renderPreview } from "@/lib/preview/render";
import type { NormalizedPlaceDetails } from "@/lib/leadSource/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120; // Playwright render only; no model call

/** Lead + cached details + photo/map assets — everything both verbs need. */
async function loadContext(leadId: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { searchRun: true },
  });
  if (!lead) return null;

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

  // Both cached on disk already — neither re-bills a Google SKU.
  const photos = await fetchPreviewPhotos(lead.placeId, details.photoRefs);
  const mapUri = await fetchStaticMap(lead.placeId, details);

  return { lead, details, photos, mapUri };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> },
) {
  const { leadId } = await params;
  const ctx = await loadContext(leadId);
  if (!ctx) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const { lead, details, photos, mapUri } = ctx;
  const { system, user } = buildManualDesignPrompt(
    details,
    lead.searchRun?.query ?? "",
    photos,
    Boolean(mapUri),
    lead.previewVariant ?? 0,
  );

  // ?part=system / ?part=user return one half, bare and banner-free.
  //
  // The system half is identical for every business, so it belongs in a chat
  // Project's custom instructions — set once, then only the per-business brief
  // gets pasted each time, which is roughly half the text.
  // Carried as a header so the client panel knows where to open without needing the
  // value inlined at build time — changing MANUAL_CHAT_URL takes effect on restart,
  // and the setting stays server-side like the rest of env.
  const headers = {
    "Content-Type": "text/plain; charset=utf-8",
    "X-Chat-Url": env.manualChatUrl,
  };

  const part = req.nextUrl.searchParams.get("part");
  if (part === "system" || part === "user") {
    return new NextResponse(part === "system" ? system : user, { headers });
  }

  // Plain text, not JSON: this is meant to be copied straight out of the terminal
  // or browser into a chat box, and JSON escaping would make that miserable.
  const body = [
    `===== SYSTEM PROMPT (paste as the first message, or as a project instruction) =====`,
    ``,
    system,
    ``,
    `===== USER PROMPT (${lead.name}) =====`,
    ``,
    user,
    ``,
    `===== AFTER YOU GET THE HTML =====`,
    ``,
    `Save it to a file, then post it back:`,
    `  curl -X POST http://localhost:3000/api/preview/${lead.id}/manual \\`,
    `    -H 'Content-Type: text/html' --data-binary @site.html`,
    ``,
    `${photos.length} photo placeholder(s) ({{PHOTO_0}}…) and ${mapUri ? "a {{MAP}} placeholder" : "no map"} will be filled in for you.`,
    `Leave those tokens exactly as they are — do not paste real image URLs.`,
  ].join("\n");

  return new NextResponse(body, { headers });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> },
) {
  const { leadId } = await params;
  const ctx = await loadContext(leadId);
  if (!ctx) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const { lead, details, photos, mapUri } = ctx;

  // Accept a raw HTML body, or {"html": "..."} for convenience.
  const raw = await req.text();
  let pasted = raw;
  if (req.headers.get("content-type")?.includes("application/json")) {
    try {
      const parsed = JSON.parse(raw) as { html?: unknown };
      if (typeof parsed.html !== "string") {
        return NextResponse.json({ error: "Expected a string `html` field" }, { status: 400 });
      }
      pasted = parsed.html;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
  }

  // Tolerate a copy that brought markdown fences or chat preamble along.
  const html = extractHtml(pasted);
  if (!html) {
    return NextResponse.json(
      { error: "No HTML document found in the body (expected <!doctype html> or <html>)" },
      { status: 400 },
    );
  }

  const withPhotos = applyPlaceholders(html, photos, mapUri);
  const finalHtml = injectContactForm(withPhotos, lead.id, detectLocale(details));

  // "manual" is neither "ai" nor "template": it is hand-brokered model output, and
  // collapsing it into "ai" would corrupt the cost-per-preview figure in analytics
  // (this one cost nothing). It also keeps the AI-preservation guard in generate.ts
  // from mistaking it for an API-produced design.
  const { imagePath, htmlPath } = await renderPreview(
    lead.placeId,
    finalHtml,
    "manual",
    lead.previewVariant ?? 0,
  );

  const updated = await prisma.lead.update({
    where: { id: lead.id },
    data: {
      previewImagePath: imagePath,
      previewHtmlPath: htmlPath,
      previewEngine: "manual",
      status: lead.status === "discovered" ? "preview_ready" : lead.status,
    },
  });

  return NextResponse.json({
    lead: updated,
    photosFilled: photos.length,
    mapFilled: Boolean(mapUri),
    bytes: finalHtml.length,
  });
}
