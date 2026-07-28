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
  replied: number;
  interested: number;
  customers: number;
  aiCostUsd: number;
  replyRate: number | null;
  winRate: number;
}
interface PurposeSpend {
  purpose: string;
  calls: number;
  costUsd: number;
}
interface Economics {
  aiCostTotalUsd: number;
  aiCostMonthUsd: number;
  aiCalls: number;
  byPurpose: PurposeSpend[];
  costPerPreviewUsd: number | null;
  costPerSentLeadUsd: number | null;
  activeSubscriptions: number;
  monthlyPriceEur: number;
  mrrEur: number;
  profitMonthEur: number;
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
  economics: Economics;
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

      <EconomicsSection eco={data.economics} />

      <SegmentTable title="By tier" rows={data.byTier} />
      <SegmentTable title="By category" rows={data.byCategory} note="Which searches produce buyers — aim discovery here." />
      <SegmentTable title="By region" rows={data.byRegion} />
    </div>
  );
}

const usd = (n: number): string => (n < 10 ? `$${n.toFixed(2)}` : `$${n.toFixed(0)}`);
const eur = (n: number): string => `€${n < 10 && n !== 0 ? n.toFixed(2) : Math.round(n)}`;

const PURPOSE_LABELS: Record<string, string> = {
  preview_design: "Preview — site design",
  preview_vision: "Preview — photo analysis",
  preview_reviews: "Preview — review mining",
  outreach_draft: "Outreach drafting",
};

function EconomicsSection({ eco }: { eco: Economics }) {
  return (
    <section>
      <h2 className="text-sm font-semibold mb-1">Unit economics</h2>
      <p className="text-[12px] text-[var(--muted)] mb-2">
        What acquiring customers costs vs. what they pay. AI spend is measured per call from
        real token usage; profit treats $ ≈ € (slightly conservative).
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat
          label="AI spend (month)"
          value={usd(eco.aiCostMonthUsd)}
          sub={`${usd(eco.aiCostTotalUsd)} all-time · ${eco.aiCalls} calls`}
        />
        <Stat
          label="Cost / preview"
          value={eco.costPerPreviewUsd == null ? "—" : usd(eco.costPerPreviewUsd)}
          sub="design + photo + review calls"
        />
        <Stat
          label="MRR"
          value={eur(eco.mrrEur)}
          sub={`${eco.activeSubscriptions} active @ €${eco.monthlyPriceEur}/mo`}
        />
        <Stat
          label="Profit (month)"
          value={eur(eco.profitMonthEur)}
          sub="MRR − AI spend"
          accent={eco.profitMonthEur > 0}
        />
      </div>

      {eco.byPurpose.length > 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] overflow-hidden mt-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-[var(--muted)] border-b border-[var(--border)]">
                <th className="px-4 py-2.5 font-medium">Where the AI spend goes</th>
                <th className="px-4 py-2.5 font-medium text-right">Calls</th>
                <th className="px-4 py-2.5 font-medium text-right">Cost</th>
                <th className="px-4 py-2.5 font-medium text-right">Avg / call</th>
              </tr>
            </thead>
            <tbody>
              {eco.byPurpose.map((p) => (
                <tr key={p.purpose} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-2.5">{PURPOSE_LABELS[p.purpose] ?? p.purpose}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-[var(--muted)]">{p.calls}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{usd(p.costUsd)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-[var(--muted)]">
                    {usd(p.calls > 0 ? p.costUsd / p.calls : 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
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
  value: number | string;
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
              <th className="px-4 py-2.5 font-medium text-right">AI cost</th>
              <th className="px-4 py-2.5 font-medium text-right">Sent</th>
              <th className="px-4 py-2.5 font-medium text-right">Replied</th>
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
                <td className="px-4 py-2.5 text-right font-mono text-[var(--muted)]">{usd(r.aiCostUsd)}</td>
                <td className="px-4 py-2.5 text-right font-mono text-[var(--muted)]">{r.sent}</td>
                <td className="px-4 py-2.5 text-right font-mono text-[var(--muted)]">{r.replied}</td>
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
