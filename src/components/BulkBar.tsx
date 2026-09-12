"use client";

// The action bar that appears once rows are selected, plus the progress line for
// a run in flight.
//
// Two things it is careful about:
//
// 1. It sends a FILTER, not an id list, when "all matching" is chosen. The table
//    holds at most 500 rows, and the operator means "every HOT lead with an
//    email", not "the ones that happened to load".
// 2. Sending asks the operator to type SEND. That is not decoration: bulk send
//    approves each draft on their behalf, skipping the per-lead checklist, and
//    mail cannot be recalled. The dialog is the review step, so it names the
//    count, the channel and who the first few are.
import { useCallback, useEffect, useRef, useState } from "react";

export interface BulkFilter {
  tier?: string;
  reach?: string;
  q?: string;
}

interface BulkJob {
  id: string;
  kind: string;
  status: string;
  target: string;
  total: number;
  done: number;
  ok: number;
  failed: number;
  skipped: number;
  current: string | null;
  error: string | null;
  cancelRequested: boolean;
}

/** Either the ticked rows, or the filter standing for everything it matches. */
function selectionBody(
  allMatching: boolean,
  ids: string[],
  filter: BulkFilter,
): Record<string, unknown> {
  if (allMatching) {
    const f: BulkFilter = {};
    if (filter.tier) f.tier = filter.tier;
    if (filter.reach) f.reach = filter.reach;
    if (filter.q?.trim()) f.q = filter.q.trim();
    return { filter: f };
  }
  return { ids };
}

export function BulkBar({
  selectedIds,
  allMatching,
  matchingCount,
  filter,
  onClear,
  onDone,
}: {
  selectedIds: string[];
  allMatching: boolean;
  matchingCount: number;
  filter: BulkFilter;
  onClear: () => void;
  onDone: () => void;
}) {
  const [job, setJob] = useState<BulkJob | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [starting, setStarting] = useState<"preview" | "send" | null>(null);
  // Held in a ref so the poll loop can stop itself after unmount without
  // depending on state that has already been torn down.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const count = allMatching ? matchingCount : selectedIds.length;

  // Self-terminating poll, same shape as the sweep list: reschedule only while
  // the run is still running, and back off on a transient error rather than
  // hammering a server that is busy doing the actual work.
  // Held in a ref because the loop reschedules itself: a plain useCallback that
  // referenced its own binding would capture the first render's copy of onDone
  // and keep calling that one for the life of the run.
  const pollRef = useRef<(jobId: string) => void>(() => {});
  useEffect(() => {
    pollRef.current = async (jobId: string) => {
      try {
        const res = await fetch(`/api/leads/bulk/${jobId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!alive.current) return;
        setJob(data.job);
        if (data.job?.status === "running") {
          setTimeout(() => pollRef.current(jobId), 1500);
        } else {
          onDone();
        }
      } catch {
        if (alive.current) setTimeout(() => pollRef.current(jobId), 3000);
      }
    };
  }, [onDone]);
  const poll = useCallback((jobId: string) => pollRef.current(jobId), []);

  async function start(kind: "preview" | "send", extra: Record<string, unknown> = {}) {
    setErr(null);
    setStarting(kind);
    try {
      const res = await fetch(`/api/leads/bulk/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...selectionBody(allMatching, selectedIds, filter), ...extra }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status !== 202) throw new Error(data.error ?? `Request failed (${res.status})`);
      setConfirming(false);
      setTyped("");
      onClear();
      poll(data.jobId);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setStarting(null);
    }
  }

  async function cancel() {
    if (!job) return;
    await fetch(`/api/leads/bulk/${job.id}`, { method: "DELETE" }).catch(() => {});
  }

  // A run in flight replaces the bar: there is only one thing to look at, and
  // offering "send 40 more" while 40 are going out invites a double send.
  if (job && job.status === "running") {
    const pct = job.total ? Math.round((job.done / job.total) * 100) : 0;
    return (
      <Shell>
        <div className="flex-1">
          <div className="text-sm">
            {job.kind === "send" ? "Sending" : "Building previews"} — {job.done} of {job.total}
            {job.failed > 0 && <span className="text-red-400"> · {job.failed} failed</span>}
          </div>
          {job.current && (
            <div className="text-[11px] text-[var(--muted)] truncate">{job.current}</div>
          )}
          <div className="mt-1.5 h-1 rounded bg-[var(--border)] overflow-hidden">
            <div className="h-full bg-[var(--accent)] transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <button
          type="button"
          onClick={cancel}
          disabled={job.cancelRequested}
          className="border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm hover:border-red-500 disabled:opacity-50"
        >
          {job.cancelRequested ? "Stopping…" : "Stop"}
        </button>
      </Shell>
    );
  }

  // A finished run stays on screen until dismissed — a batch that quietly
  // vanished is how you end up re-running it.
  if (job) {
    return (
      <Shell>
        <div className="flex-1 text-sm">
          {job.status === "cancelled" ? "Stopped" : job.status === "error" ? "Run failed" : "Done"} —{" "}
          {job.ok} {job.kind === "send" ? "sent" : "built"}
          {job.failed > 0 && <span className="text-red-400"> · {job.failed} failed</span>}
          {job.skipped > 0 && (
            <span className="text-[var(--muted)]"> · {job.skipped} skipped</span>
          )}
          {job.error && <div className="text-[11px] text-red-400 mt-0.5">{job.error}</div>}
        </div>
        <button
          type="button"
          onClick={() => setJob(null)}
          className="border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm hover:border-[var(--accent)]"
        >
          Dismiss
        </button>
      </Shell>
    );
  }

  if (count === 0) return null;

  if (confirming) {
    return (
      <Shell>
        <div className="flex-1">
          <div className="text-sm">
            Email <b>{count}</b> {count === 1 ? "business" : "businesses"}. Drafts are approved
            automatically, and mail cannot be recalled.
          </div>
          <div className="text-[11px] text-[var(--muted)] mt-0.5">
            Leads with no email address, who unsubscribed, or who were already sent to are skipped.
            Capped per run and per day.
          </div>
          {err && <div className="text-[11px] text-red-400 mt-1">{err}</div>}
        </div>
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="Type SEND"
          aria-label="Type SEND to confirm"
          className="bg-[var(--panel-2)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm w-28 focus:outline-none focus:border-[var(--accent)]"
        />
        <button
          type="button"
          disabled={typed !== "SEND" || starting === "send"}
          onClick={() => start("send", { confirm: "SEND" })}
          className="bg-red-600 text-white rounded-lg px-3 py-1.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {starting === "send" ? "Starting…" : `Send ${count}`}
        </button>
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            setTyped("");
          }}
          className="border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm hover:border-[var(--accent)]"
        >
          Cancel
        </button>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex-1 text-sm">
        <b>{count}</b> selected
        {allMatching && <span className="text-[var(--muted)]"> (everything matching)</span>}
        {err && <div className="text-[11px] text-red-400 mt-0.5">{err}</div>}
      </div>
      <button
        type="button"
        onClick={() => start("preview")}
        disabled={starting !== null}
        title="Rebuild each selected lead's preview from the current template — free on the kit engine"
        className="border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm hover:border-[var(--accent)] disabled:opacity-60"
      >
        {starting === "preview" ? "Starting…" : "Generate previews"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm hover:border-red-500"
      >
        Send emails
      </button>
      <button
        type="button"
        onClick={onClear}
        className="text-sm text-[var(--muted)] hover:text-[var(--text)] px-2"
      >
        Clear
      </button>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-4 rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)]/20 px-4 py-3">
      {children}
    </div>
  );
}
