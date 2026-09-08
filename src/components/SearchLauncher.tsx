"use client";

import { useEffect, useState } from "react";
import { SWEEP_REGIONS } from "@/lib/regions";

const SLOVENIA_COUNT = SWEEP_REGIONS.slovenia.length;

// Query is free text handed straight to Google's Text Search — anything you'd
// type into Google Maps' search box works ("hair salon", "24 hour pharmacy",
// "vegan restaurant"). These are just a starting-point autocomplete, not a
// fixed list — typing something else is fine.
const CATEGORY_SUGGESTIONS = [
  "hair salon",
  "beauty salon",
  "nail salon",
  "barber shop",
  "dentist",
  "physiotherapist",
  "veterinary clinic",
  "gym",
  "yoga studio",
  "massage therapist",
  "tattoo studio",
  "photographer",
  "wedding photographer",
  "restaurant",
  "cafe",
  "bakery",
  "florist",
  "auto repair shop",
  "plumber",
  "electrician",
  "law firm",
  "accountant",
  "real estate agency",
  "architect",
];

interface Pair {
  query: string;
  location: string;
}

interface SingleRun {
  kind: "single";
  id: string;
  query: string;
  location: string;
  status: string;
  error: string | null;
  totalFound: number;
  newLeads: number;
  cachedHits: number;
  detailCalls: number;
  createdAt: string;
}

interface SweepRun {
  kind: "sweep";
  sweep: string;
  sweepBatchId: string;
  query: string;
  status: string;
  regionsTotal: number;
  regionsRunning: number;
  regionsErrored: number;
  totalFound: number;
  newLeads: number;
  cachedHits: number;
  detailCalls: number;
  createdAt: string;
  ids: string[];
  regions: {
    id: string;
    location: string;
    status: string;
    error: string | null;
    totalFound: number;
    newLeads: number;
  }[];
}

type Run = SingleRun | SweepRun;

export function SearchLauncher() {
  const [pairs, setPairs] = useState<Pair[]>([{ query: "", location: "" }]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0); // bump to re-trigger the poll effect
  const [sweepProgress, setSweepProgress] = useState<{ done: number; total: number } | null>(
    null,
  );
  const [clearing, setClearing] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  // Look up how much of the Slovenia sweep is already covered for whatever
  // category is currently typed in the first row.
  const sweepQuery = pairs[0]?.query.trim();
  useEffect(() => {
    if (!sweepQuery) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch(
          `/api/discover?sweep=slovenia&query=${encodeURIComponent(sweepQuery)}`,
        );
        if (!res.ok || !alive) return;
        const data = await res.json();
        if (alive) setSweepProgress({ done: data.done.length, total: data.total });
      } catch {
        // Best-effort — the sweep button still works without this hint.
      }
    })();
    return () => {
      alive = false;
    };
  }, [sweepQuery, refresh]);

  // Fetch runs on mount and whenever `refresh` is bumped (e.g. after launching).
  // Self-reschedules only while a run is still in progress, so polling stops on
  // its own once everything is done. setState happens after await (never sync).
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      try {
        const res = await fetch("/api/search-runs");
        const data = await res.json();
        if (!alive) return;
        const next: Run[] = data.runs ?? [];
        setRuns(next);
        if (next.some((r) => r.status === "running")) {
          timer = setTimeout(tick, 1500);
        }
      } catch {
        if (alive) timer = setTimeout(tick, 3000); // transient — retry slower
      }
    };

    void tick();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [refresh]);

  function updatePair(i: number, field: keyof Pair, value: string) {
    setPairs((prev) => prev.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)));
  }

  async function launch() {
    setError(null);
    const valid = pairs.filter((p) => p.query.trim() && p.location.trim());
    if (!valid.length) {
      setError("Add at least one (category, location) pair.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pairs: valid }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }
      setRefresh((n) => n + 1); // restart polling to pick up the new run(s)
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  // Fan the first row's category across every Slovenian region (location ignored).
  async function launchSweep() {
    setError(null);
    const query = pairs[0]?.query.trim();
    if (!query) {
      setError("Enter a category in the first row to sweep all of Slovenia.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, sweep: "slovenia" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }
      const data = await res.json();
      if (data.runs.length === 0 && data.message) {
        setError(data.message);
      }
      setRefresh((n) => n + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  // Forget sweep progress for the first row's category, so the next sweep
  // re-covers every region instead of skipping the ones already done.
  async function clearSweepProgressFor() {
    setError(null);
    const query = pairs[0]?.query.trim();
    if (!query) {
      setError("Enter a category in the first row to clear its sweep progress.");
      return;
    }
    setClearing(true);
    try {
      const res = await fetch("/api/discover", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, sweep: "slovenia" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }
      setRefresh((n) => n + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setClearing(false);
    }
  }

  // Remove rows from the run ledger (never touches leads — see the API route).
  async function deleteRuns(key: string, ids: string[]) {
    setError(null);
    setDeletingKey(key);
    try {
      const res = await fetch("/api/search-runs", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }
      setRefresh((n) => n + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeletingKey(null);
    }
  }

  function toggleExpanded(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="space-y-8">
      {/* Form */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-5">
        <datalist id="category-suggestions">
          {CATEGORY_SUGGESTIONS.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <div className="space-y-2">
          {pairs.map((p, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={p.query}
                onChange={(e) => updatePair(i, "query", e.target.value)}
                placeholder="Category — e.g. hair salon"
                list="category-suggestions"
                className="flex-1 bg-[var(--panel-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
              />
              <input
                value={p.location}
                onChange={(e) => updatePair(i, "location", e.target.value)}
                placeholder="Location — e.g. Bucharest"
                className="flex-1 bg-[var(--panel-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
              />
              {pairs.length > 1 && (
                <button
                  onClick={() => setPairs((prev) => prev.filter((_, idx) => idx !== i))}
                  className="px-3 text-[var(--muted)] hover:text-[var(--hot)]"
                  aria-label="Remove pair"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-[var(--muted)]">
          Category is free text — same as typing into Google Maps search. Start typing for
          suggestions, or use anything else Google would match (e.g. &quot;24 hour pharmacy&quot;).
        </p>

        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => setPairs((prev) => [...prev, { query: "", location: "" }])}
            className="text-sm text-[var(--muted)] hover:text-[var(--text)]"
          >
            + Add another pair
          </button>
          <div className="flex items-center gap-2">
            {sweepQuery && sweepProgress && sweepProgress.done > 0 && (
              <button
                onClick={clearSweepProgressFor}
                disabled={clearing}
                title="Forget which regions were already covered, so the next sweep re-covers all of them."
                className="text-sm text-[var(--muted)] hover:text-[var(--hot)] disabled:opacity-50"
              >
                {clearing ? "Clearing…" : "Clear sweep progress"}
              </button>
            )}
            <button
              onClick={launchSweep}
              disabled={submitting}
              title={`Runs the first row's category across Slovenian regions not already covered (location ignored).`}
              className="px-4 py-2 rounded-lg border border-[var(--border)] text-[var(--text)] text-sm font-medium hover:border-[var(--accent)] disabled:opacity-50"
            >
              🇸🇮 Sweep all Slovenia{" "}
              {sweepQuery && sweepProgress
                ? `(${sweepProgress.done}/${sweepProgress.total} done)`
                : `(${SLOVENIA_COUNT})`}
            </button>
            <button
              onClick={launch}
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "Launching…" : "Launch discovery"}
            </button>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-[var(--muted)]">
          Sweep fans the first row&apos;s category across {SLOVENIA_COUNT} regions, skipping any
          already covered by a previous sweep of the same category, and stops fetching new
          businesses once your daily/monthly cost cap is reached — rerun (any day) to continue
          where it left off. Use &quot;Clear sweep progress&quot; to start that category over.
        </p>
        {error && <p className="mt-3 text-sm text-[var(--hot)]">{error}</p>}
      </div>

      {/* Runs */}
      <div>
        <h2 className="text-sm font-medium mb-3 text-[var(--muted)]">Recent runs</h2>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-[var(--muted)] border-b border-[var(--border)]">
                <th className="px-4 py-3 font-medium">Search</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Found</th>
                <th className="px-4 py-3 font-medium">New</th>
                <th className="px-4 py-3 font-medium">Cached</th>
                <th className="px-4 py-3 font-medium">Details billed</th>
                <th className="px-4 py-3 font-medium w-8" />
              </tr>
            </thead>
            <tbody>
              {runs.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[var(--muted)]">
                    No searches yet.
                  </td>
                </tr>
              )}
              {runs.map((r) =>
                r.kind === "single" ? (
                  <tr key={r.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium">{r.query}</div>
                      <div className="text-[11px] text-[var(--muted)]">{r.location}</div>
                      {r.error && (
                        <div className="text-[11px] text-[var(--hot)] mt-0.5">{r.error}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={r.status} />
                    </td>
                    <td className="px-4 py-3 font-mono text-[var(--muted)]">{r.totalFound}</td>
                    <td className="px-4 py-3 font-mono text-[var(--warm)]">{r.newLeads}</td>
                    <td className="px-4 py-3 font-mono text-[var(--muted)]">{r.cachedHits}</td>
                    <td className="px-4 py-3 font-mono text-[var(--muted)]">{r.detailCalls}</td>
                    <td className="px-4 py-3">
                      {r.status !== "running" && (
                        <button
                          onClick={() => deleteRuns(r.id, [r.id])}
                          disabled={deletingKey === r.id}
                          aria-label="Delete run"
                          title="Delete this run"
                          className="text-[var(--muted)] hover:text-[var(--hot)] disabled:opacity-50"
                        >
                          🗑
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  <SweepRowGroup
                    key={r.sweepBatchId}
                    run={r}
                    isExpanded={expanded.has(r.sweepBatchId)}
                    onToggle={() => toggleExpanded(r.sweepBatchId)}
                    onDelete={() => deleteRuns(r.sweepBatchId, r.ids)}
                    deleting={deletingKey === r.sweepBatchId}
                  />
                ),
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SweepRowGroup({
  run,
  isExpanded,
  onToggle,
  onDelete,
  deleting,
}: {
  run: SweepRun;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <>
      <tr className="border-b border-[var(--border)] last:border-0 bg-[var(--panel-2)]/40">
        <td className="px-4 py-3">
          <button
            onClick={onToggle}
            className="flex items-center gap-1.5 font-medium hover:text-[var(--accent)]"
          >
            <span className="text-[10px] text-[var(--muted)]">{isExpanded ? "▾" : "▸"}</span>
            🇸🇮 {run.query}
          </button>
          <div className="text-[11px] text-[var(--muted)]">
            Slovenia sweep — {run.regionsTotal} regions
            {run.regionsErrored > 0 && `, ${run.regionsErrored} errored`}
          </div>
        </td>
        <td className="px-4 py-3">
          <StatusPill status={run.status} />
        </td>
        <td className="px-4 py-3 font-mono text-[var(--muted)]">{run.totalFound}</td>
        <td className="px-4 py-3 font-mono text-[var(--warm)]">{run.newLeads}</td>
        <td className="px-4 py-3 font-mono text-[var(--muted)]">{run.cachedHits}</td>
        <td className="px-4 py-3 font-mono text-[var(--muted)]">{run.detailCalls}</td>
        <td className="px-4 py-3">
          {run.status !== "running" && (
            <button
              onClick={onDelete}
              disabled={deleting}
              aria-label="Delete sweep"
              title="Delete every region row in this sweep"
              className="text-[var(--muted)] hover:text-[var(--hot)] disabled:opacity-50"
            >
              🗑
            </button>
          )}
        </td>
      </tr>
      {isExpanded &&
        run.regions.map((reg) => (
          <tr key={reg.id} className="border-b border-[var(--border)] last:border-0">
            <td className="pl-10 pr-4 py-2 text-[13px] text-[var(--muted)]">{reg.location}</td>
            <td className="px-4 py-2">
              <StatusPill status={reg.status} />
            </td>
            <td className="px-4 py-2 font-mono text-[13px] text-[var(--muted)]">
              {reg.totalFound}
            </td>
            <td className="px-4 py-2 font-mono text-[13px] text-[var(--warm)]">{reg.newLeads}</td>
            <td className="px-4 py-2" colSpan={2} />
            <td className="px-4 py-2" />
          </tr>
        ))}
    </>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string }> = {
    running: { color: "var(--warm)", bg: "var(--warm-bg)" },
    done: { color: "#4ade80", bg: "#0f2417" },
    error: { color: "var(--hot)", bg: "var(--hot-bg)" },
  };
  const s = map[status] ?? map.done;
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-md font-medium"
      style={{ color: s.color, background: s.bg }}
    >
      {status === "running" && (
        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
      )}
      {status}
    </span>
  );
}
