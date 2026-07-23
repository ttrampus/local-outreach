"use client";

import { useEffect, useState } from "react";

interface Usage {
  sku: string;
  today: number;
  dailyLimit: number;
  month: number;
  freeTierMonthly: number;
  freeTierPct: number;
}

const LABELS: Record<string, string> = {
  TEXT_SEARCH: "Text Search",
  PLACE_DETAILS: "Place Details",
  PLACE_PHOTOS: "Place Photos",
  STATIC_MAP: "Static Map",
};

export function UsageBar({ refreshKey = 0 }: { refreshKey?: number }) {
  const [usage, setUsage] = useState<Usage[]>([]);

  useEffect(() => {
    let alive = true;
    fetch("/api/usage")
      .then((r) => r.json())
      .then((d) => alive && setUsage(d.usage ?? []))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  if (!usage.length) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {usage.map((u) => {
        const pct = Math.min(u.freeTierPct, 100);
        const hot = u.freeTierPct >= 80;
        return (
          <div
            key={u.sku}
            className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4"
          >
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium">{LABELS[u.sku] ?? u.sku}</span>
              <span className="text-[11px] text-[var(--muted)]">
                today {u.today}/{u.dailyLimit}
              </span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-[var(--panel-2)] overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${pct}%`,
                  background: hot ? "var(--hot)" : "var(--accent)",
                }}
              />
            </div>
            <div className="mt-1.5 flex items-baseline justify-between text-[11px] text-[var(--muted)]">
              <span>
                {u.month} / ~{u.freeTierMonthly} free this month
              </span>
              <span style={{ color: hot ? "var(--hot)" : undefined }}>{u.freeTierPct}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
