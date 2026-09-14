// The runner behind every bulk action.
//
// Shape copied from the sweep in discovery.ts, because it is the shape that
// already works here: create the progress row, answer 202, run the work
// fire-and-forget, let the UI poll. No streaming, no queue, no new dependency.
//
// Sequential on purpose, for both kinds. Previews each launch a headless browser
// and are already serialized by the semaphore in generate.ts, so parallelism
// would only queue. Sends are sequential for a different reason: a burst of
// identical mail from one mailbox is the exact signature spam filters look for,
// and a slow drip is also what makes cancelling meaningful.
import "server-only";
import { prisma } from "@/lib/prisma";

export type BulkKind = "preview" | "send";

/** What one lead's attempt produced. `skip` does not count against ok/failed. */
export type ItemOutcome = "ok" | "failed" | "skip";

export async function createBulkJob(
  kind: BulkKind,
  target: string,
  total: number,
  skipped: number,
): Promise<string> {
  const job = await prisma.bulkJob.create({
    data: { kind, target, total, skipped },
    select: { id: true },
  });
  return job.id;
}

/**
 * Walk the ids one at a time, recording progress as we go.
 *
 * Never throws: a bulk run that dies on lead 3 of 50 and reports nothing is
 * worse than one that records 47 failures, because the operator can act on the
 * second. `handler` failures are counted and logged; only a crash in the
 * bookkeeping itself can end the run early, and that is marked `error`.
 */
export async function runBulkJob(
  jobId: string,
  ids: string[],
  handler: (leadId: string) => Promise<ItemOutcome>,
): Promise<void> {
  let ok = 0;
  let failed = 0;
  let skipped = 0;

  try {
    for (const leadId of ids) {
      // Checked between leads rather than mid-flight: for a send, the previous
      // email is already gone, and the only thing left to protect is the next one.
      const job = await prisma.bulkJob.findUnique({
        where: { id: jobId },
        select: { cancelRequested: true },
      });
      if (job?.cancelRequested) {
        await prisma.bulkJob.update({
          where: { id: jobId },
          data: { status: "cancelled", current: null },
        });
        console.log(`[bulk ${jobId}] cancelled after ${ok + failed} of ${ids.length}`);
        return;
      }

      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: { name: true },
      });
      await prisma.bulkJob.update({
        where: { id: jobId },
        data: { current: lead?.name ?? leadId },
      });

      let outcome: ItemOutcome = "failed";
      try {
        outcome = await handler(leadId);
      } catch (err) {
        console.error(`[bulk ${jobId}] lead ${leadId} failed:`, err);
      }

      if (outcome === "ok") ok += 1;
      else if (outcome === "failed") failed += 1;
      else skipped += 1;

      await prisma.bulkJob.update({
        where: { id: jobId },
        data: {
          done: ok + failed,
          ok,
          failed,
          // Incremented, not assigned: the row already carries the leads dropped
          // before the run began, and these are additional ones the handler
          // itself declined (a lead whose draft vanished mid-run, say).
          ...(outcome === "skip" ? { skipped: { increment: 1 } } : {}),
        },
      });
    }

    await prisma.bulkJob.update({
      where: { id: jobId },
      data: { status: "done", current: null, done: ok + failed, ok, failed },
    });
    console.log(
      `[bulk ${jobId}] done — ${ok} ok, ${failed} failed, ${skipped} skipped of ${ids.length}`,
    );
  } catch (err) {
    // The loop's own bookkeeping broke (DB gone, most likely). Mark it so the UI
    // stops polling a run that will never advance.
    console.error(`[bulk ${jobId}] run crashed:`, err);
    await prisma.bulkJob
      .update({
        where: { id: jobId },
        data: { status: "error", error: (err as Error).message.slice(0, 300), current: null },
      })
      .catch(() => {});
  }
}

/**
 * A one-line description of what a selection was aimed at, for the job row.
 *
 * Stored rather than derived later because the filter chips move on: a run that
 * says "HOT · email" still makes sense tomorrow, while a stored filter object
 * would have to be re-rendered by code that no longer knows the UI's labels.
 */
export function describeTarget(
  selection: {
    ids?: string[];
    filter?: { tier?: string; reach?: string; emailed?: string; q?: string };
  },
): string {
  if (selection.ids) return `${selection.ids.length} selected`;
  const f = selection.filter ?? {};
  const emailed = f.emailed === "no" ? "not emailed" : f.emailed === "yes" ? "emailed" : undefined;
  const parts = [f.tier, f.reach, emailed, f.q && `"${f.q}"`].filter(Boolean);
  return parts.length ? parts.join(" · ") : "all leads";
}
