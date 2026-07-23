"use client";

import { useEffect, useState } from "react";

interface FunnelStep {
  stage: string;
  count: number;
  fromPrev: number | null;
  ofTotal: number;
}
interface Segment {
  label: string;
  leads: number;
  sent: number;
  interested: number;
  customers: number;
  replyRate: number | null;
  winRate: number;
}
interface Analytics {
  totals: {
    leads: number;
    withEmail: number;
    previews: number;
    sent: number;
    viewed: number;
    interested: number;
    replied: number;
    customers: number;
    previewViews: number;
  };
  funnel: FunnelStep[];
  byTier: Segment[];
  byCategory: Segment[];
  byRegion: Segment[];
}

const pct = (n: number | null): string => (n == null ? "—" : `${Math.round(n * 100)}%`);

export function AnalyticsDashboard() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analytics")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading && !data) return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  if (!data) return <p className="text-sm text-[var(--hot)]">Could not load analytics.</p>;

  const t = data.totals;

  return (
    <div className="space-y-8">
      {/* Headline numbers */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Leads" value={t.leads} />
        <Stat label="With email" value={t.withEmail} sub={pct(div(t.withEmail, t.leads))} />
        <Stat label="Sent" value={t.sent} sub={pct(div(t.sent, t.leads))} />
        <Stat label="Preview views" value={t.previewViews} />
        <Stat label="Viewed" value={t.viewed} sub={`${pct(div(t.viewed, t.sent))} of sent`} />
        <Stat label="Interested" value={t.interested} sub={`${pct(div(t.interested, t.sent))} of sent`} />
        <Stat label="Replied" value={t.replied} />
        <Stat label="Customers" value={t.customers} sub={`${pct(div(t.customers, t.leads))} of leads`} accent />
      </div>

      {/* Funnel */}
      <section>
        <h2 className="text-sm font-semibold mb-3">Funnel</h2>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4 space-y-2">
          {data.funnel.map((s) => (
            <div key={s.stage} className="flex items-center gap-3">
              <div className="w-28 text-sm text-[var(--muted)]">{s.stage}</div>
              <div className="flex-1 h-6 rounded bg-[var(--panel-2)] overflow-hidden">
                <div
                  className="h-full bg-[var(--accent)] flex items-center px-2 text-[11px] text-white"
                  style={{ width: `${Math.max(s.ofTotal * 100, s.count > 0 ? 6 : 0)}%` }}
                >
                  {s.count}
                </div>
              </div>
              <div className="w-16 text-right text-[11px] text-[var(--muted)]">
                {s.fromPrev == null ? "" : `${pct(s.fromPrev)} ↓`}
              </div>
            </div>
          ))}
        </div>
      </section>

      <SegmentTable title="By tier" rows={data.byTier} />
      <SegmentTable title="By category" rows={data.byCategory} note="Which searches produce buyers — aim discovery here." />
      <SegmentTable title="By region" rows={data.byRegion} />
    </div>
  );
}

function div(a: number, b: number): number {
  return b > 0 ? a / b : 0;
}

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4">
      <div className="text-[11px] uppercase tracking-wide text-[var(--muted)]">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${accent ? "text-[var(--accent)]" : ""}`}>
        {value}
      </div>
      {sub && <div className="text-[11px] text-[var(--muted)] mt-0.5">{sub}</div>}
    </div>
  );
}

function SegmentTable({
  title,
  rows,
  note,
}: {
  title: string;
  rows: Segment[];
  note?: string;
}) {
  if (!rows.length) return null;
  return (
    <section>
      <h2 className="text-sm font-semibold mb-1">{title}</h2>
      {note && <p className="text-[12px] text-[var(--muted)] mb-2">{note}</p>}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-[var(--muted)] border-b border-[var(--border)]">
              <th className="px-4 py-2.5 font-medium">{title.replace("By ", "")}</th>
              <th className="px-4 py-2.5 font-medium text-right">Leads</th>
              <th className="px-4 py-2.5 font-medium text-right">Sent</th>
              <th className="px-4 py-2.5 font-medium text-right">Interested</th>
              <th className="px-4 py-2.5 font-medium text-right">Reply rate</th>
              <th className="px-4 py-2.5 font-medium text-right">Customers</th>
              <th className="px-4 py-2.5 font-medium text-right">Win rate</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-b border-[var(--border)] last:border-0">
                <td className="px-4 py-2.5 truncate max-w-[220px]">{r.label}</td>
                <td className="px-4 py-2.5 text-right font-mono">{r.leads}</td>
                <td className="px-4 py-2.5 text-right font-mono text-[var(--muted)]">{r.sent}</td>
                <td className="px-4 py-2.5 text-right font-mono text-[var(--muted)]">{r.interested}</td>
                <td className="px-4 py-2.5 text-right font-mono">{pct(r.replyRate)}</td>
                <td className="px-4 py-2.5 text-right font-mono text-[var(--muted)]">{r.customers}</td>
                <td className="px-4 py-2.5 text-right font-mono">{pct(r.winRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
