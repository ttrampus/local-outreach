"use client";

import { useCallback, useEffect, useState } from "react";
import { TierBadge } from "./TierBadge";

interface OutreachItem {
  id: string;
  leadId: string;
  channel: string;
  contact: string | null;
  subject: string | null;
  body: string;
  status: string;
  sentAt: string | null;
  updatedAt: string;
  lead: {
    id: string;
    name: string;
    tier: string;
    website: string | null;
    previewImagePath: string | null;
    deployedUrl: string | null;
    status: string;
  };
}

const FILTERS = [
  { value: "", label: "All" },
  { value: "draft", label: "Drafts" },
  { value: "approved", label: "Approved" },
  { value: "sent", label: "Sent" },
];

export function OutreachReview() {
  const [items, setItems] = useState<OutreachItem[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = filter ? `?status=${filter}` : "";
      const res = await fetch(`/api/outreach${params}`);
      const data = await res.json();
      setItems(data.outreach ?? []);
      setCounts(data.counts ?? {});
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    const t = setTimeout(load, 0); // defer so setState isn't called sync in effect
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
              filter === f.value
                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-white"
                : "border-[var(--border)] bg-[var(--panel)] text-[var(--muted)] hover:text-[var(--text)]"
            }`}
          >
            {f.label}
            {f.value && (
              <span className="opacity-60 ml-1.5">{counts[f.value] ?? 0}</span>
            )}
          </button>
        ))}
      </div>

      {items.length === 0 && !loading && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] py-12 text-center text-sm text-[var(--muted)]">
          No outreach yet. Open a lead and click “Draft outreach” to start.
        </div>
      )}

      <div className="space-y-4">
        {items.map((item) => (
          <OutreachCard key={item.id} item={item} onChanged={load} />
        ))}
      </div>
    </div>
  );
}

function OutreachCard({ item, onChanged }: { item: OutreachItem; onChanged: () => void }) {
  const [subject, setSubject] = useState(item.subject ?? "");
  const [body, setBody] = useState(item.body);
  const [contact, setContact] = useState(item.contact ?? "");
  const [channel, setChannel] = useState(item.channel);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmSend, setConfirmSend] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const sent = item.status === "sent";
  const dirty =
    subject !== (item.subject ?? "") ||
    body !== item.body ||
    contact !== (item.contact ?? "") ||
    channel !== item.channel;

  async function patch(payload: Record<string, unknown>, action: string) {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/outreach/${item.leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      if (action === "save") setSavedAt(Date.now());
      else onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] overflow-hidden">
      {/* header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-[var(--border)]">
        <TierBadge tier={item.lead.tier} />
        <span className="font-medium">{item.lead.name}</span>
        <StatusPill status={item.status} />
        <span className="ml-auto text-[11px] text-[var(--muted)]">
          {safeHost(item.lead.website)}
        </span>
      </div>

      <div className="p-5 space-y-3">
        {/* channel + contact */}
        <div className="flex gap-2">
          <select
            value={channel}
            disabled={sent}
            onChange={(e) => setChannel(e.target.value)}
            className="bg-[var(--panel-2)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm disabled:opacity-60"
          >
            {["email", "whatsapp", "phone", "manual"].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            value={contact}
            disabled={sent}
            onChange={(e) => setContact(e.target.value)}
            placeholder="contact (email / phone)"
            className="flex-1 bg-[var(--panel-2)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm disabled:opacity-60"
          />
        </div>

        {channel === "email" && (
          <input
            value={subject}
            disabled={sent}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="w-full bg-[var(--panel-2)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm disabled:opacity-60"
          />
        )}

        <textarea
          value={body}
          disabled={sent}
          onChange={(e) => setBody(e.target.value)}
          rows={10}
          className="w-full bg-[var(--panel-2)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm leading-relaxed font-mono disabled:opacity-60 focus:outline-none focus:border-[var(--accent)]"
        />

        {sent ? (
          <p className="text-[11px] text-[var(--muted)]">
            Marked sent{item.sentAt ? ` on ${new Date(item.sentAt).toLocaleString()}` : ""}. You
            sent this yourself via {item.channel}.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => patch({ subject, body, channel, contact: contact || null }, "save")}
              disabled={busy !== null || !dirty}
              className="px-3 py-1.5 rounded-lg text-sm border border-[var(--border)] bg-[var(--panel-2)] hover:border-[var(--accent)] disabled:opacity-40"
            >
              {busy === "save" ? "Saving…" : savedAt && !dirty ? "Saved ✓" : "Save edits"}
            </button>

            {item.status === "draft" ? (
              <button
                onClick={() => patch({ subject, body, channel, contact: contact || null, action: "approve" }, "approve")}
                disabled={busy !== null}
                className="px-3 py-1.5 rounded-lg text-sm bg-[var(--accent)] text-white disabled:opacity-40"
              >
                {busy === "approve" ? "Approving…" : "Approve"}
              </button>
            ) : (
              <>
                <button
                  onClick={() => patch({ action: "unapprove" }, "unapprove")}
                  disabled={busy !== null}
                  className="px-3 py-1.5 rounded-lg text-sm border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-40"
                >
                  Unapprove
                </button>
                {confirmSend ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="text-[11px] text-[var(--muted)]">
                      You’re sending this yourself — confirm?
                    </span>
                    <button
                      onClick={() => {
                        setConfirmSend(false);
                        patch({ action: "send" }, "send");
                      }}
                      disabled={busy !== null}
                      className="px-3 py-1.5 rounded-lg text-sm bg-[#16a34a] text-white disabled:opacity-40"
                    >
                      Mark as sent
                    </button>
                    <button
                      onClick={() => setConfirmSend(false)}
                      className="text-sm text-[var(--muted)] hover:text-[var(--text)]"
                    >
                      cancel
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => setConfirmSend(true)}
                    disabled={busy !== null}
                    className="px-3 py-1.5 rounded-lg text-sm bg-[#16a34a] text-white disabled:opacity-40"
                  >
                    Send…
                  </button>
                )}
              </>
            )}
            {dirty && (
              <span className="text-[11px] text-[var(--muted)]">unsaved changes</span>
            )}
          </div>
        )}
        {error && <p className="text-sm text-[var(--hot)]">{error}</p>}
      </div>
    </div>
  );
}

function safeHost(url: string | null): string {
  if (!url) return "no site";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "no site";
  }
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string }> = {
    draft: { color: "var(--muted)", bg: "var(--panel-2)" },
    approved: { color: "var(--warm)", bg: "var(--warm-bg)" },
    sent: { color: "#4ade80", bg: "#0f2417" },
  };
  const s = map[status] ?? map.draft;
  return (
    <span
      className="text-[11px] px-2 py-0.5 rounded-md font-medium"
      style={{ color: s.color, background: s.bg }}
    >
      {status}
    </span>
  );
}
