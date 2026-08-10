"use client";

import { useCallback, useEffect, useState } from "react";
import { TierBadge } from "./TierBadge";

interface FollowupItem {
  id: string;
  leadId: string;
  leadName: string;
  tier: string;
  step: number;
  subject: string | null;
  body: string;
  channel: string;
  contact: string | null;
  scheduledAt: string | null;
  dueInDays: number;
  reason?: string;
}

interface Buckets {
  due: FollowupItem[];
  upcoming: FollowupItem[];
  paused: (FollowupItem & { reason: string })[];
  counts: { due: number; upcoming: number; paused: number };
}

export function FollowupsQueue() {
  const [data, setData] = useState<Buckets | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/followups");
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  if (loading && !data) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }

  const due = data?.due ?? [];
  const upcoming = data?.upcoming ?? [];
  const paused = data?.paused ?? [];

  return (
    <div className="space-y-8">
      <section>
        <SectionHeading title="Due now" count={due.length} accent />
        {due.length === 0 ? (
          <Empty>Nothing due. Follow-ups appear here once the interval passes and the prospect hasn&apos;t replied.</Empty>
        ) : (
          <div className="space-y-3">
            {due.map((f) => (
              <FollowupCard key={f.id} item={f} onChanged={load} />
            ))}
          </div>
        )}
      </section>

      {upcoming.length > 0 && (
        <section>
          <SectionHeading title="Upcoming" count={upcoming.length} />
          <div className="space-y-2">
            {upcoming.map((f) => (
              <UpcomingRow key={f.id} item={f} />
            ))}
          </div>
        </section>
      )}

      {paused.length > 0 && (
        <section>
          <SectionHeading title="Paused — prospect engaged" count={paused.length} />
          <p className="text-[12px] text-[var(--muted)] mb-2">
            These sequences stopped because the prospect replied, showed interest, or converted —
            so they&apos;re no longer nudged. Pick them up by hand.
          </p>
          <div className="space-y-2">
            {paused.map((f) => (
              <UpcomingRow key={f.id} item={f} paused />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function FollowupCard({ item, onChanged }: { item: FollowupItem; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function act(action: "send" | "mark-sent" | "skip") {
    setBusy(action);
    setError(null);
    setNote(null);
    try {
      const res = await fetch(`/api/followups/${item.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? `Request failed (${res.status})`);
      // Assisted channels: copy the body first (still inside the click gesture),
      // then open the thread / messaging app / dialer for the operator to finish.
      if (d.delivery?.copyBody) {
        try {
          await navigator.clipboard.writeText(d.delivery.copyBody);
        } catch {
          /* clipboard blocked — the body is on screen to copy by hand */
        }
      }
      if (d.delivery?.method === "manual" && d.delivery?.composeUrl) {
        window.open(d.delivery.composeUrl, "_blank", "noopener");
      }
      if (d.delivery?.note) setNote(d.delivery.note);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function markReplied() {
    setBusy("replied");
    setError(null);
    try {
      const res = await fetch(`/api/leads/${item.leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "replied" }),
      });
      if (!res.ok) throw new Error("Could not update lead");
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3 border-b border-[var(--border)]">
        <TierBadge tier={item.tier} />
        <span className="font-medium">{item.leadName}</span>
        <span className="text-[11px] px-2 py-0.5 rounded-md font-medium bg-[var(--panel-2)] text-[var(--muted)]">
          Follow-up {item.step}
        </span>
        <span className="ml-auto text-[11px] text-[var(--muted)]">
          {item.dueInDays < 0
            ? `${Math.abs(item.dueInDays)}d overdue`
            : "due today"}
          {item.contact ? ` · ${item.channel}: ${item.contact}` : ` · ${item.channel}`}
        </span>
      </div>

      <div className="p-5 space-y-3">
        {item.subject && (
          <div className="text-[12px] text-[var(--muted)]">{item.subject}</div>
        )}
        <p className="text-[13px] leading-relaxed whitespace-pre-wrap text-[var(--text)]">
          {item.body}
        </p>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            onClick={() => act("send")}
            disabled={busy !== null}
            className="px-3 py-1.5 rounded-lg text-sm bg-[#16a34a] text-white disabled:opacity-40"
          >
            {busy === "send" ? "Sending…" : "Send follow-up"}
          </button>
          <button
            onClick={() => act("mark-sent")}
            disabled={busy !== null}
            title="I already sent this myself — just record it"
            className="px-3 py-1.5 rounded-lg text-sm border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-40"
          >
            {busy === "mark-sent" ? "Recording…" : "Sent by hand"}
          </button>
          <button
            onClick={markReplied}
            disabled={busy !== null}
            className="px-3 py-1.5 rounded-lg text-sm border border-[var(--border)] bg-[var(--panel-2)] hover:border-[var(--accent)] disabled:opacity-40"
          >
            {busy === "replied" ? "…" : "They replied — pause"}
          </button>
          <button
            onClick={() => act("skip")}
            disabled={busy !== null}
            className="px-3 py-1.5 rounded-lg text-sm text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-40"
          >
            Skip this one
          </button>
        </div>
        {note && <p className="text-[12px] text-[var(--muted)]">{note}</p>}
        {error && <p className="text-sm text-[var(--hot)]">{error}</p>}
      </div>
    </div>
  );
}

function UpcomingRow({ item, paused }: { item: FollowupItem; paused?: boolean }) {
  return (
    <div
      className={`flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-4 py-2.5 ${
        paused ? "opacity-70" : ""
      }`}
    >
      <TierBadge tier={item.tier} />
      <span className="text-sm font-medium">{item.leadName}</span>
      <span className="text-[11px] text-[var(--muted)]">Follow-up {item.step}</span>
      <span className="ml-auto text-[11px] text-[var(--muted)]">
        {paused
          ? `paused · ${item.reason}`
          : item.dueInDays <= 0
            ? "due"
            : `in ${item.dueInDays}d`}
      </span>
    </div>
  );
}

function SectionHeading({ title, count, accent }: { title: string; count: number; accent?: boolean }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <h2 className="text-sm font-semibold">{title}</h2>
      <span
        className={`text-[11px] px-2 py-0.5 rounded-md font-medium ${
          accent && count > 0
            ? "bg-[var(--accent)] text-white"
            : "bg-[var(--panel-2)] text-[var(--muted)]"
        }`}
      >
        {count}
      </span>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] py-10 text-center text-sm text-[var(--muted)]">
      {children}
    </div>
  );
}
