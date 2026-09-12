// Build and store a lead's outreach sequence.
//
// Lifted out of POST /api/outreach/:leadId so the bulk sender can do exactly what
// the per-lead button does. Two copies of "replace the unsent drafts, keep the
// sent history" is not a divergence anyone would notice until a bulk run mailed
// the wrong text or wiped a sent row.
import "server-only";
import { prisma } from "@/lib/prisma";
import { getCachedDetails } from "@/lib/places";
import { buildDraft } from "@/lib/outreach/draft";
import { isSmsConfigured } from "@/lib/outreach/sms";
import { env } from "@/lib/env";
import type { NormalizedPlaceDetails } from "@/lib/leadSource/types";
import type { Lead, Outreach, SearchRun } from "@/generated/prisma/client";

export type LeadWithRun = Lead & { searchRun: SearchRun | null };

export function loadLeadForOutreach(leadId: string) {
  return prisma.lead.findUnique({ where: { id: leadId }, include: { searchRun: true } });
}

/**
 * (Re)generate the lead's draft sequence. Returns the step-0 message — the one
 * that is editable and sendable — plus the whole created sequence.
 */
export async function prepareOutreach(
  lead: LeadWithRun,
): Promise<{ primary: Outreach; sequence: Outreach[] }> {
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

  // One fixed message, in the prospect's language, naming the kind of business
  // they are and nothing else about them. The preview link is the
  // personalization: it is their own business, already built.
  const previewUrl = `${env.appBaseUrl}/p/${lead.id}`;
  const draft = buildDraft(lead, details, {
    // SMS is only worth picking when it can actually be delivered; without
    // Twilio a phone number is better spent on a DM or a call.
    smsEnabled: isSmsConfigured(),
    previewUrl,
    siteUrl: env.appBaseUrl,
  });

  // Replace any existing *unsent* messages (the editable initial draft plus queued
  // follow-ups); sent history is kept intact. Step 0 is the editable/sendable draft;
  // steps 1+ are queued follow-ups, stored as reference for when there's no reply.
  await prisma.outreach.deleteMany({
    where: { leadId: lead.id, status: { in: ["draft", "approved", "queued"] } },
  });
  const created: Outreach[] = [];
  for (const m of draft.messages) {
    created.push(
      await prisma.outreach.create({
        data: {
          leadId: lead.id,
          channel: draft.channel,
          contact: draft.contact,
          subject: m.subject,
          body: m.body,
          step: m.step,
          status: m.step === 0 ? "draft" : "queued",
        },
      }),
    );
  }

  // Advance funnel to "drafted" unless already further along.
  if (["discovered", "preview_ready"].includes(lead.status)) {
    await prisma.lead.update({ where: { id: lead.id }, data: { status: "drafted" } });
  }

  return { primary: created.find((c) => c.step === 0) ?? created[0], sequence: created };
}
