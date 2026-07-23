"use client";

import { useEffect, useState } from "react";
import { SWEEP_REGIONS } from "@/lib/regions";

const SLOVENIA_COUNT = SWEEP_REGIONS.slovenia.length;

interface Pair {
  query: string;
  location: string;
}

interface Run {
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

export function SearchLauncher() {
  const [pairs, setPairs] = useState<Pair[]>([{ query: "", location: "" }]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0); // bump to re-trigger the poll effect

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
      setRefresh((n) => n + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Form */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-5">
        <div className="space-y-2">
          {pairs.map((p, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={p.query}
                onChange={(e) => updatePair(i, "query", e.target.value)}
                placeholder="Category — e.g. hair salon"
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

        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => setPairs((prev) => [...prev, { query: "", location: "" }])}
            className="text-sm text-[var(--muted)] hover:text-[var(--text)]"
          >
            + Add another pair
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={launchSweep}
              disabled={submitting}
              title={`Runs the first row's category across all ${SLOVENIA_COUNT} Slovenian regions (location ignored).`}
              className="px-4 py-2 rounded-lg border border-[var(--border)] text-[var(--text)] text-sm font-medium hover:border-[var(--accent)] disabled:opacity-50"
            >
              🇸🇮 Sweep all Slovenia ({SLOVENIA_COUNT})
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
          Sweep fans the first row&apos;s category across {SLOVENIA_COUNT} regions, then stops
          fetching new businesses once your daily/monthly cost cap is reached — rerun on
          later days to continue where it left off.
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
              </tr>
            </thead>
            <tbody>
              {runs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[var(--muted)]">
                    No searches yet.
                  </td>
                </tr>
              )}
              {runs.map((r) => (
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
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
