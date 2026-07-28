"use client";

import { useCallback, useEffect, useState } from "react";
import { TierBadge } from "./TierBadge";
import { FunnelStatus } from "./FunnelStatus";

export interface Lead {
  id: string;
  placeId: string;
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  reviewCount: number;
  photoCount: number;
  tier: string;
  score: number;
  qualificationReason: string | null;
  signals: string | null;
  status: string;
  previewImagePath: string | null;
  previewEngine: string | null;
  deployedUrl: string | null;
  previewViews: number;
  firstViewedAt: string | null;
  lastViewedAt: string | null;
  interestedAt: string | null;
  repliedAt: string | null;
  email: string | null;
  customDomain: string | null;
  subscriptionStatus: string | null;
  createdAt: string;
  outreach: { id: string; status: string }[];
  siteMessages?: SiteMessage[];
}

export interface SiteMessage {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  message: string;
  createdAt: string;
}

const TIERS = ["HOT", "WARM", "COLD"] as const;
const SORTS = [
  { value: "score", label: "Score" },
  { value: "reviews", label: "Reviews" },
  { value: "name", label: "Name" },
  { value: "created", label: "Newest" },
];

export function LeadsTable() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({ HOT: 0, WARM: 0, COLD: 0 });
  const [tier, setTier] = useState<string>("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("score");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [regen, setRegen] = useState<{ busy: boolean; msg: string | null }>({
    busy: false,
    msg: null,
  });

  const updateLead = useCallback((u: Partial<Lead> & { id: string }) => {
    setLeads((prev) => prev.map((l) => (l.id === u.id ? { ...l, ...u } : l)));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (tier) params.set("tier", tier);
    if (q.trim()) params.set("q", q.trim());
    params.set("sort", sort);
    try {
      const res = await fetch(`/api/leads?${params}`);
      const data = await res.json();
      setLeads(data.leads ?? []);
      setCounts(data.counts ?? {});
    } finally {
      setLoading(false);
    }
  }, [tier, q, sort]);

  useEffect(() => {
    const t = setTimeout(load, q ? 250 : 0); // debounce text search
    return () => clearTimeout(t);
  }, [load, q]);

  const total = (counts.HOT ?? 0) + (counts.WARM ?? 0) + (counts.COLD ?? 0);

  async function regenerateAll() {
    setRegen({ busy: true, msg: null });
    try {
      const res = await fetch("/api/preview/regenerate-all", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 202) {
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }
      setRegen({
        busy: false,
        msg: data.queued
          ? `Regenerating ${data.queued} preview${data.queued === 1 ? "" : "s"} in the background — reopen a lead's Live view to see it.`
          : "No previews to regenerate yet.",
      });
    } catch (e) {
      setRegen({ busy: false, msg: (e as Error).message });
    }
  }

  return (
    <div>
      {/* Filter chips + controls */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Chip active={tier === ""} onClick={() => setTier("")}>
          All <span className="opacity-60">{total}</span>
        </Chip>
        {TIERS.map((t) => (
          <Chip key={t} active={tier === t} onClick={() => setTier(tier === t ? "" : t)}>
            <TierBadge tier={t} /> <span className="opacity-60">{counts[t] ?? 0}</span>
          </Chip>
        ))}

        <div className="ml-auto flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, address, site…"
            className="bg-[var(--panel)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm w-56 focus:outline-none focus:border-[var(--accent)]"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="bg-[var(--panel)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[var(--accent)]"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={regenerateAll}
            disabled={regen.busy}
            title="Rebuild every existing preview against the latest template (free — uses cached photos)"
            className="bg-[var(--panel)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm hover:border-[var(--accent)] disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {regen.busy ? "Regenerating…" : "Regenerate all previews"}
          </button>
        </div>
      </div>
      {regen.msg && (
        <div className="-mt-2 mb-4 text-xs text-[var(--muted)]">{regen.msg}</div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-[var(--muted)] border-b border-[var(--border)]">
              <th className="px-4 py-3 font-medium">Business</th>
              <th className="px-4 py-3 font-medium">Tier</th>
              <th className="px-4 py-3 font-medium">Score</th>
              <th className="px-4 py-3 font-medium">Reviews</th>
              <th className="px-4 py-3 font-medium">Website</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-[var(--muted)]">
                  No leads yet. Head to{" "}
                  <a href="/search" className="text-[var(--accent)] underline">
                    Discovery
                  </a>{" "}
                  to run a search.
                </td>
              </tr>
            )}
            {leads.map((lead) => (
              <LeadRow
                key={lead.id}
                lead={lead}
                expanded={expanded === lead.id}
                onToggle={() => setExpanded(expanded === lead.id ? null : lead.id)}
                onUpdate={updateLead}
              />
            ))}
          </tbody>
        </table>
        {loading && (
          <div className="px-4 py-3 text-xs text-[var(--muted)] border-t border-[var(--border)]">
            Loading…
          </div>
        )}
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors ${
        active
          ? "border-[var(--accent)] bg-[var(--accent-soft)] text-white"
          : "border-[var(--border)] bg-[var(--panel)] text-[var(--muted)] hover:text-[var(--text)]"
      }`}
    >
      {children}
    </button>
  );
}

function LeadRow({
  lead,
  expanded,
  onToggle,
  onUpdate,
}: {
  lead: Lead;
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (u: Partial<Lead> & { id: string }) => void;
}) {
  const host = lead.website ? safeHost(lead.website) : null;
  return (
    <>
      <tr
        onClick={onToggle}
        className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--panel-2)] cursor-pointer"
      >
        <td className="px-4 py-3">
          <div className="font-medium">{lead.name}</div>
          {lead.address && (
            <div className="text-[11px] text-[var(--muted)] truncate max-w-xs">{lead.address}</div>
          )}
        </td>
        <td className="px-4 py-3">
          <TierBadge tier={lead.tier} />
        </td>
        <td className="px-4 py-3 font-mono text-[var(--muted)]">{lead.score}</td>
        <td className="px-4 py-3">
          {lead.reviewCount > 0 ? (
            <span>
              {lead.rating ?? "—"}
              <span className="text-[var(--muted)]"> ★ · {lead.reviewCount}</span>
            </span>
          ) : (
            <span className="text-[var(--muted)]">none</span>
          )}
        </td>
        <td className="px-4 py-3">
          {host ? (
            <span className="text-[var(--warm)]">{host}</span>
          ) : (
            <span className="text-[var(--muted)]">no site</span>
          )}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] px-2 py-0.5 rounded bg-[var(--panel-2)] text-[var(--muted)]">
              {lead.status}
            </span>
            {lead.interestedAt ? (
              <span
                title={`Interested ${new Date(lead.interestedAt).toLocaleString()}`}
                style={{ borderColor: "var(--hot)", color: "var(--hot)" }}
                className="text-[11px] px-1.5 py-0.5 rounded border font-medium whitespace-nowrap"
              >
                ★ interested
              </span>
            ) : lead.previewViews > 0 ? (
              <span
                title={`Last viewed ${lead.lastViewedAt ? new Date(lead.lastViewedAt).toLocaleString() : ""}`}
                className="text-[11px] px-1.5 py-0.5 rounded bg-[var(--panel-2)] text-[var(--warm)] whitespace-nowrap"
              >
                👁 {lead.previewViews}
              </span>
            ) : null}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-[var(--panel-2)]">
          <td colSpan={6} className="px-4 py-4">
            <LeadDetail lead={lead} onUpdate={onUpdate} />
          </td>
        </tr>
      )}
    </>
  );
}

function LeadDetail({
  lead,
  onUpdate,
}: {
  lead: Lead;
  onUpdate: (u: Partial<Lead> & { id: string }) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"image" | "live">("image");
  // Bumped whenever the preview is regenerated, to bust the live iframe's cache.
  const [previewNonce, setPreviewNonce] = useState(0);
  const [copied, setCopied] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [deployInfo, setDeployInfo] = useState<{
    domain?: string;
    verified?: boolean;
    records?: { type: string; name: string; value: string }[];
    warn?: string;
  } | null>(null);

  // On expand, pull the full lead (site messages, repliedAt, customDomain) which the
  // list endpoint omits, and merge it into the row.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/leads/${lead.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d.lead) onUpdate(d.lead);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id]);

  // Re-fetch this lead's Google details (backfills photos), then re-qualify.
  async function refreshDetails() {
    setBusy("refresh");
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(`/api/leads/${lead.id}/refresh`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      if (data.lead) onUpdate(data.lead);
      const n: number = data.photoRefs ?? 0;
      setInfo(
        n > 0
          ? `Found ${n} photo${n === 1 ? "" : "s"} — regenerate the preview to use them.`
          : "Details refreshed — Google has no photos for this place.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  // Create a Stripe Checkout link for this lead, copy it, and open it in a new tab.
  async function paymentLink(plan: "subscription" | "buyout") {
    setBusy("pay");
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(`/api/leads/${lead.id}/payment-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      try {
        await navigator.clipboard.writeText(data.url);
      } catch {
        /* clipboard may be blocked; the link still opens below */
      }
      window.open(data.url, "_blank", "noopener");
      setInfo(`${plan === "buyout" ? "Buyout" : "Subscription"} checkout link copied & opened.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  // The public, shareable full-screen preview link you drop into outreach.
  const shareUrl = `/p/${lead.id}`;
  async function copyShareLink() {
    const abs =
      typeof window !== "undefined" ? `${window.location.origin}${shareUrl}` : shareUrl;
    try {
      await navigator.clipboard.writeText(abs);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the Open link still works */
    }
  }

  let signalList: { label: string; value: string }[] = [];
  try {
    const parsed = lead.signals ? JSON.parse(lead.signals) : null;
    const site = parsed?.site;
    if (site && typeof site === "object") {
      signalList = Object.entries(site)
        .filter(([, v]) => v !== false && v !== null && v !== "")
        .map(([k, v]) => ({ label: k, value: String(v) }));
    }
  } catch {
    /* ignore malformed signals */
  }

  // Run an action, then refetch the lead so status/preview/deploy fields refresh.
  async function act(action: string, url: string) {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(url, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      const fresh = await fetch(`/api/leads/${lead.id}`).then((r) => r.json());
      if (fresh.lead) onUpdate(fresh.lead);
      if (action === "preview") setPreviewNonce((n) => n + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  // Deploy the stored HTML, optionally attaching a real custom domain. The response
  // carries the DNS records the owner must set, which we surface below.
  async function deploy(customDomain?: string) {
    setBusy("deploy");
    setError(null);
    setDeployInfo(null);
    try {
      const res = await fetch(`/api/deploy/${lead.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(customDomain ? { customDomain } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      const fresh = await fetch(`/api/leads/${lead.id}`).then((r) => r.json());
      if (fresh.lead) onUpdate(fresh.lead);
      if (data.domain) {
        setDeployInfo({
          domain: data.domain.domain,
          verified: data.domain.verified,
          records: data.domain.records,
          warn: data.domainError ?? undefined,
        });
      } else if (data.domainError) {
        setDeployInfo({ warn: data.domainError });
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  // Operator-driven funnel transitions (also pause/resume the follow-up sequence).
  async function leadAction(action: "replied" | "lost" | "reopen") {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      if (data.lead) onUpdate(data.lead);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const hasPreview = Boolean(lead.previewImagePath);
  const messages = lead.siteMessages ?? [];

  return (
    <div className="space-y-5">
      <FunnelStatus status={lead.status} />

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-[var(--muted)] mb-1">
            Why this tier
          </div>
          <p className="text-sm leading-relaxed">{lead.qualificationReason ?? "—"}</p>

          <div className="mt-4 grid grid-cols-2 gap-y-1 text-sm">
            <Field label="Phone" value={lead.phone} />
            <Field
              label="Email"
              value={lead.email}
              href={lead.email ? `mailto:${lead.email}` : undefined}
            />
            <Field label="Website" value={lead.website} href={lead.website ?? undefined} />
            <Field label="Photos" value={String(lead.photoCount)} />
            <Field label="Place ID" value={lead.placeId} mono />
            {lead.deployedUrl && (
              <Field label="Live site" value={lead.deployedUrl} href={lead.deployedUrl} />
            )}
          </div>

          <div className="mt-4">
            <div className="text-[11px] uppercase tracking-wide text-[var(--muted)] mb-1.5">
              Signals
            </div>
            {signalList.length ? (
              <div className="flex flex-wrap gap-1.5">
                {signalList.map((s) => (
                  <span
                    key={s.label}
                    className="text-[11px] px-2 py-0.5 rounded bg-[var(--panel)] border border-[var(--border)] text-[var(--muted)]"
                  >
                    {s.label}: <span className="text-[var(--text)]">{s.value}</span>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--muted)]">No site signals (no website analyzed).</p>
            )}
          </div>
        </div>

        {/* Preview + actions */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <div className="text-[11px] uppercase tracking-wide text-[var(--muted)]">
                Website preview
              </div>
              {/* The AI engine falls back to the template on any failure, so a
                  template site otherwise looks exactly like a successful design. */}
              {lead.previewEngine === "template" && (
                <span
                  title="Claude was unavailable when this was built — this is the deterministic template. Regenerate to get a bespoke design."
                  className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-amber-500/15 text-amber-500 border border-amber-500/30"
                >
                  template fallback
                </span>
              )}
            </div>
            {hasPreview && (
              <div className="flex rounded-md border border-[var(--border)] overflow-hidden text-[11px]">
                {(["image", "live"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setView(v)}
                    className={`px-2.5 py-1 capitalize transition-colors ${
                      view === v
                        ? "bg-[var(--accent,#7c3aed)] text-white"
                        : "text-[var(--muted)] hover:text-[var(--text)]"
                    }`}
                  >
                    {v === "image" ? "Image" : "Live"}
                  </button>
                ))}
              </div>
            )}
          </div>
          {hasPreview ? (
            view === "live" ? (
              <iframe
                key={previewNonce}
                src={`/api/preview/${lead.id}/html?v=${previewNonce}`}
                title={`${lead.name} live preview`}
                loading="lazy"
                className="w-full aspect-[1280/1000] rounded-lg border border-[var(--border)] bg-white"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`${lead.previewImagePath!}?v=${previewNonce}`}
                alt={`${lead.name} preview`}
                className="w-full rounded-lg border border-[var(--border)]"
              />
            )
          ) : (
            <div className="rounded-lg border border-dashed border-[var(--border)] py-10 text-center text-sm text-[var(--muted)]">
              No preview yet.
            </div>
          )}

          {hasPreview && (
            <div className="mt-2 flex items-center gap-3 text-xs">
              <a
                href={shareUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[var(--accent,#7c3aed)] hover:underline"
              >
                Open full preview ↗
              </a>
              <button
                type="button"
                onClick={copyShareLink}
                className="text-[var(--muted)] hover:text-[var(--text)]"
              >
                {copied ? "Link copied ✓" : "Copy share link"}
              </button>
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <ActionBtn
              busy={busy === "preview"}
              onClick={() => act("preview", `/api/preview/${lead.id}`)}
            >
              {hasPreview ? "Regenerate preview" : "Generate preview"}
            </ActionBtn>
            {hasPreview && (
              <ActionBtn
                busy={busy === "reroll"}
                onClick={() => act("reroll", `/api/preview/${lead.id}?reroll=1`)}
                title="Rebuild with a different palette, hero composition and motion style"
              >
                New design
              </ActionBtn>
            )}
            <ActionBtn
              busy={busy === "draft"}
              onClick={() => act("draft", `/api/outreach/${lead.id}`)}
            >
              {lead.outreach.length ? "Re-draft outreach" : "Draft outreach"}
            </ActionBtn>
            <DeployBtn
              busy={busy === "deploy"}
              disabled={!hasPreview}
              onConfirm={(domain) => deploy(domain)}
            />
            <ActionBtn
              busy={busy === "refresh"}
              onClick={refreshDetails}
              title="Re-fetch Google details to pull in real photos (uses one Place Details call)"
            >
              Refresh details
            </ActionBtn>
            <ActionBtn
              busy={busy === "pay"}
              onClick={() => paymentLink("subscription")}
              title="Create a Stripe €50/mo checkout link, copy it, and open it"
            >
              Payment link
            </ActionBtn>
          </div>

          {/* Reply / lost status — pauses or resumes the follow-up sequence. */}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            {lead.repliedAt ? (
              <span className="text-[var(--muted)]">
                Replied {new Date(lead.repliedAt).toLocaleDateString()} — follow-ups paused.{" "}
                <button
                  onClick={() => leadAction("reopen")}
                  className="text-[var(--accent)] hover:underline"
                >
                  reopen
                </button>
              </span>
            ) : (
              <button
                onClick={() => leadAction("replied")}
                disabled={busy !== null}
                className="text-[var(--muted)] hover:text-[var(--text)]"
              >
                Mark replied (pause follow-ups)
              </button>
            )}
            <span className="text-[var(--border)]">·</span>
            {lead.status === "lost" ? (
              <button
                onClick={() => leadAction("reopen")}
                disabled={busy !== null}
                className="text-[var(--accent)] hover:underline"
              >
                reopen lost
              </button>
            ) : (
              <button
                onClick={() => leadAction("lost")}
                disabled={busy !== null}
                className="text-[var(--muted)] hover:text-[var(--text)]"
              >
                Mark lost
              </button>
            )}
          </div>

          {/* DNS records for an attached custom domain. */}
          {deployInfo && (
            <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3 text-xs">
              {deployInfo.domain && (
                <div className="mb-2">
                  <span className="font-medium">{deployInfo.domain}</span>{" "}
                  <span className={deployInfo.verified ? "text-[#4ade80]" : "text-[var(--warm)]"}>
                    {deployInfo.verified ? "verified ✓" : "pending DNS"}
                  </span>
                </div>
              )}
              {deployInfo.records && deployInfo.records.length > 0 && (
                <>
                  <div className="text-[var(--muted)] mb-1">
                    Add these records at the domain&apos;s DNS provider:
                  </div>
                  <table className="w-full font-mono text-[11px]">
                    <tbody>
                      {deployInfo.records.map((r, i) => (
                        <tr key={i}>
                          <td className="pr-3 py-0.5 text-[var(--muted)]">{r.type}</td>
                          <td className="pr-3 py-0.5">{r.name}</td>
                          <td className="py-0.5 break-all">{r.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
              {deployInfo.warn && (
                <p className="mt-2 text-[var(--warm)]">Domain: {deployInfo.warn}</p>
              )}
            </div>
          )}

          {lead.customDomain && !deployInfo && (
            <p className="mt-2 text-[11px] text-[var(--muted)]">
              Custom domain: <span className="text-[var(--text)]">{lead.customDomain}</span>
            </p>
          )}

          {/* Enquiries received through the site's contact form. */}
          {messages.length > 0 && (
            <div className="mt-4">
              <div className="text-[11px] uppercase tracking-wide text-[var(--muted)] mb-1.5">
                Enquiries ({messages.length})
              </div>
              <div className="space-y-2">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-2.5 text-xs"
                  >
                    <div className="flex items-center gap-2 text-[var(--muted)]">
                      <span className="text-[var(--text)] font-medium">{m.name || "Someone"}</span>
                      {m.email && <span>· {m.email}</span>}
                      {m.phone && <span>· {m.phone}</span>}
                      <span className="ml-auto">{new Date(m.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-[var(--text)]">{m.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {lead.subscriptionStatus && (
            <p className="mt-3 text-[11px]">
              <span className="text-[var(--muted)]">Billing: </span>
              <span
                style={{
                  color:
                    lead.subscriptionStatus === "active" || lead.subscriptionStatus === "paid"
                      ? "#4ade80"
                      : "var(--warm)",
                }}
              >
                {lead.subscriptionStatus}
              </span>
            </p>
          )}

          {lead.outreach.length > 0 && (
            <p className="mt-3 text-[11px] text-[var(--muted)]">
              Draft saved.{" "}
              <a href="/outreach" className="text-[var(--accent)] underline">
                Review &amp; send in Outreach →
              </a>
            </p>
          )}
          {info && <p className="mt-3 text-[11px] text-[var(--muted)]">{info}</p>}
          {error && <p className="mt-3 text-sm text-[var(--hot)]">{error}</p>}
        </div>
      </div>
    </div>
  );
}

function ActionBtn({
  busy,
  disabled,
  onClick,
  children,
  title,
}: {
  busy: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      disabled={busy || disabled}
      className="px-3 py-1.5 rounded-lg text-sm border border-[var(--border)] bg-[var(--panel)] hover:border-[var(--accent)] disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {busy ? "Working…" : children}
    </button>
  );
}

// Deploy creates real hosted infrastructure → gate behind a confirm click. The
// confirm step also offers an optional custom domain (so the live site isn't a
// *.vercel.app subdomain).
function DeployBtn({
  busy,
  disabled,
  onConfirm,
}: {
  busy: boolean;
  disabled: boolean;
  onConfirm: (customDomain?: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [domain, setDomain] = useState("");
  if (confirming) {
    return (
      <span
        className="inline-flex items-center gap-1"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="custom domain (optional)"
          className="bg-[var(--panel)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-sm w-48 focus:outline-none focus:border-[var(--accent)]"
        />
        <button
          onClick={(e) => {
            e.stopPropagation();
            setConfirming(false);
            onConfirm(domain.trim() || undefined);
            setDomain("");
          }}
          className="px-3 py-1.5 rounded-lg text-sm bg-[var(--accent)] text-white"
        >
          Confirm deploy
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setConfirming(false);
          }}
          className="px-2 py-1.5 text-sm text-[var(--muted)] hover:text-[var(--text)]"
        >
          cancel
        </button>
      </span>
    );
  }
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        setConfirming(true);
      }}
      disabled={busy || disabled}
      title={disabled ? "Generate a preview first" : "Deploy this site live"}
      className="px-3 py-1.5 rounded-lg text-sm border border-[var(--border)] bg-[var(--panel)] hover:border-[var(--accent)] disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {busy ? "Deploying…" : "Deploy site"}
    </button>
  );
}

function Field({
  label,
  value,
  href,
  mono,
}: {
  label: string;
  value: string | null;
  href?: string;
  mono?: boolean;
}) {
  return (
    <>
      <span className="text-[var(--muted)]">{label}</span>
      <span className={mono ? "font-mono text-xs truncate" : "truncate"}>
        {value ? (
          href ? (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-[var(--accent)] underline"
              onClick={(e) => e.stopPropagation()}
            >
              {value}
            </a>
          ) : (
            value
          )
        ) : (
          <span className="text-[var(--muted)]">—</span>
        )}
      </span>
    </>
  );
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
