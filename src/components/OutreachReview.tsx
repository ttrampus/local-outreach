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
  followups?: { id: string; step: number; subject: string | null; body: string }[];
  lead: {
    id: string;
    name: string;
    tier: string;
    website: string | null;
    previewImagePath: string | null;
    previewMobileImagePath: string | null;
    deployedUrl: string | null;
    status: string;
  };
}

/**
 * The last thing between a generated site and a real business owner's inbox.
 *
 * Thirty seconds per lead, and it catches the failures that cost the most: a
 * wrong phone number, a hallucinated service, a hero that collapses on a phone.
 * None of those show up as errors anywhere — the send just quietly burns the
 * one first impression that prospect will ever give.
 */
const CHECKLIST = [
  { key: "name", label: "Business name is correct" },
  { key: "phone", label: "Phone number is correct" },
  { key: "address", label: "Address is correct" },
  { key: "hours", label: "Opening hours are correct" },
  { key: "logo", label: "Logo / branding looks okay" },
  { key: "facts", label: "No invented services, awards or claims" },
  { key: "mobile", label: "Looks right on mobile" },
  { key: "form", label: "Contact form works" },
  { key: "loads", label: "Preview page loads" },
] as const;

/**
 * The channels the send path can actually act on — these strings are what
 * `pickChannel` produces and what `deliverOutreach` switches over, so the dropdown
 * can never offer something that silently does nothing. WhatsApp is deliberately
 * absent: cold WhatsApp messaging breaches WhatsApp Business policy.
 */
const CHANNELS = [
  { value: "email", label: "email", hint: "Delivered by the app when SMTP is set, else opens Gmail." },
  { value: "sms", label: "sms", hint: "Delivered by the app when Twilio is set, else opens your messaging app." },
  { value: "facebook", label: "facebook DM", hint: "Opens the Messenger thread; the message is copied for you to paste." },
  { value: "instagram", label: "instagram DM", hint: "Opens the Instagram thread; the message is copied for you to paste." },
  { value: "phone", label: "phone call", hint: "Opens your dialer and logs the touch — the call is yours to make." },
  { value: "manual", label: "manual", hint: "No automatic delivery. Use “Sent by hand” after you've made contact." },
];

// Printable ASCII + newlines + the accented characters GSM-7 encodes directly.
// Anything else (an em dash, a €, Slovene č/š/ž) forces UCS-2. Written with
// escapes rather than a literal range so no control byte ends up in the source.
const GSM7 = /^[\n\r\x20-\x7E£¥èéùìòÇØøÅåÆæßÉ¤¡ÄÖÑÜ§¿äöñüà]*$/;

/**
 * Roughly what a carrier will bill for this text. A draft written AS an SMS is
 * short by construction, but switching an email-length draft over to SMS by hand
 * quietly turns one message into five — visible here before it's sent, not after.
 * Non-GSM-7 characters force UCS-2, which cuts a segment from 160 characters to
 * 70; our own drafts contain an em dash and a €, so that is the common case.
 */
function smsSegments(body: string): { chars: number; segments: number; unicode: boolean } {
  const unicode = !GSM7.test(body);
  const single = unicode ? 70 : 160;
  const multi = unicode ? 67 : 153;
  const chars = body.length;
  const segments = chars <= single ? Math.max(1, Math.ceil(chars / single)) : Math.ceil(chars / multi);
  return { chars, segments, unicode };
}

/** What the contact field means, per channel — it isn't always an address. */
const CONTACT_PLACEHOLDER: Record<string, string> = {
  email: "name@business.com",
  sms: "+386 1 234 5678",
  facebook: "https://m.me/<page>",
  instagram: "https://ig.me/m/<user>",
  phone: "+386 1 234 5678",
  manual: "how you'll reach them",
};

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
  const [note, setNote] = useState<string | null>(null);
  const [confirmSend, setConfirmSend] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const allChecked = CHECKLIST.every((c) => checked[c.key]);

  function toggleCheck(key: string) {
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const sent = item.status === "sent";
  const dirty =
    subject !== (item.subject ?? "") ||
    body !== item.body ||
    contact !== (item.contact ?? "") ||
    channel !== item.channel;

  async function patch(payload: Record<string, unknown>, action: string) {
    setBusy(action);
    setError(null);
    setNote(null);
    try {
      const res = await fetch(`/api/outreach/${item.leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      if (action === "save") {
        setSavedAt(Date.now());
      } else {
        // Assisted send: the app opened Gmail / the messaging app / the DM thread /
        // the dialer, and the operator finishes it. Messenger and Instagram links
        // can't carry a body, so the text goes to the clipboard first — do the copy
        // before window.open, while we're still in the click's user gesture.
        const d = data.delivery;
        if (d?.copyBody) {
          try {
            await navigator.clipboard.writeText(d.copyBody);
          } catch {
            /* clipboard blocked (no permission / insecure origin) — the body is
               still on screen to copy by hand, so this isn't worth failing over */
          }
        }
        if (d?.method === "manual" && d?.composeUrl) {
          window.open(d.composeUrl, "_blank", "noopener");
        }
        if (d?.note) setNote(d.note);
        onChanged();
      }
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
            {CHANNELS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
            {/* A record drafted on a channel we no longer offer still has to show
                its real value rather than silently reading as the first option. */}
            {!CHANNELS.some((c) => c.value === channel) && (
              <option value={channel}>{channel}</option>
            )}
          </select>
          <input
            value={contact}
            disabled={sent}
            onChange={(e) => setContact(e.target.value)}
            placeholder={CONTACT_PLACEHOLDER[channel] ?? "contact"}
            className="flex-1 bg-[var(--panel-2)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm disabled:opacity-60"
          />
        </div>

        {!sent && (
          <p className="text-[11px] text-[var(--muted)] -mt-1">
            {CHANNELS.find((c) => c.value === channel)?.hint ??
              "Unknown channel — pick one that can actually be delivered."}
          </p>
        )}

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

        {channel === "sms" && !sent && (
          <p
            // A purpose-written SMS lands at 3-4 segments once the € and the em
            // dash force UCS-2, so only flag what's clearly an email in disguise.
            className={`text-[11px] -mt-1 ${
              smsSegments(body).segments > 5 ? "text-[var(--hot)]" : "text-[var(--muted)]"
            }`}
          >
            {smsSegments(body).chars} characters ·{" "}
            {smsSegments(body).segments} SMS segment
            {smsSegments(body).segments === 1 ? "" : "s"}
            {smsSegments(body).unicode ? " (unicode — 70 chars per segment)" : ""}
            {smsSegments(body).segments > 5
              ? " — that's an email, not a text. Regenerate the draft to get the short SMS version."
              : ""}
          </p>
        )}

        {sent ? (
          <p className="text-[11px] text-[var(--muted)]">
            Marked sent{item.sentAt ? ` on ${new Date(item.sentAt).toLocaleString()}` : ""}. You
            sent this yourself via {item.channel}.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {item.status === "draft" && (
              <div className="w-full rounded-lg border border-[var(--border)] bg-[var(--panel-2)] p-4 mb-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">Before you send</span>
                  <span className="text-[11px] text-[var(--muted)]">
                    {CHECKLIST.filter((c) => checked[c.key]).length} / {CHECKLIST.length}
                  </span>
                </div>

                <div className="mt-1 flex flex-wrap gap-3 text-[11px]">
                  {/* Same tab: both are things you check and come straight back
                      from. Back normally restores this queue from bfcache with
                      the checklist still ticked, but that is the browser's call,
                      not a guarantee — if a tick ever comes back cleared, that is
                      why, and the fix is to persist `checked` rather than to go
                      back to opening a second tab. */}
                  {item.lead.previewImagePath && (
                    <a
                      href={`/p/${item.leadId}`}
                      className="text-[var(--accent)] hover:underline"
                    >
                      open the live preview
                    </a>
                  )}
                  {item.lead.previewMobileImagePath && (
                    <a
                      href={item.lead.previewMobileImagePath}
                      className="text-[var(--accent)] hover:underline"
                    >
                      phone screenshot
                    </a>
                  )}
                </div>

                <div className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                  {CHECKLIST.map((c) => (
                    <label
                      key={c.key}
                      className="flex items-center gap-2 text-[13px] cursor-pointer select-none text-[var(--muted)] hover:text-[var(--text)]"
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(checked[c.key])}
                        onChange={() => toggleCheck(c.key)}
                        className="accent-[var(--accent)]"
                      />
                      {c.label}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => patch({ subject, body, channel, contact: contact || null }, "save")}
              disabled={busy !== null || !dirty}
              className="px-3 py-1.5 rounded-lg text-sm border border-[var(--border)] bg-[var(--panel-2)] hover:border-[var(--accent)] disabled:opacity-40"
            >
              {busy === "save" ? "Saving…" : savedAt && !dirty ? "Saved ✓" : "Save edits"}
            </button>

            {item.status === "draft" ? (
              <button
                onClick={() =>
                  patch(
                    {
                      subject,
                      body,
                      channel,
                      contact: contact || null,
                      action: "approve",
                      reviewed: true,
                    },
                    "approve",
                  )
                }
                disabled={busy !== null || !allChecked}
                title={allChecked ? undefined : "Complete the checklist above first"}
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
                      Send now via {channel}?
                    </span>
                    <button
                      onClick={() => {
                        setConfirmSend(false);
                        patch({ action: "send" }, "send");
                      }}
                      disabled={busy !== null || channel === "manual"}
                      title={
                        channel === "manual"
                          ? "Nothing to deliver on the manual channel — use “Sent by hand”."
                          : undefined
                      }
                      className="px-3 py-1.5 rounded-lg text-sm bg-[#16a34a] text-white disabled:opacity-40"
                    >
                      {busy === "send" ? "Sending…" : "Send"}
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
                {/* The honest way to log a touch made outside the app — so the
                    funnel never advances on a send that didn't happen. */}
                <button
                  onClick={() => patch({ action: "mark-sent" }, "mark-sent")}
                  disabled={busy !== null}
                  title="I already contacted them myself — just record it"
                  className="px-3 py-1.5 rounded-lg text-sm border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-40"
                >
                  {busy === "mark-sent" ? "Recording…" : "Sent by hand"}
                </button>
              </>
            )}
            {dirty && (
              <span className="text-[11px] text-[var(--muted)]">unsaved changes</span>
            )}
          </div>
        )}
        {error && <p className="text-sm text-[var(--hot)]">{error}</p>}
        {note && <p className="text-[13px] text-[var(--muted)]">{note}</p>}

        {item.followups && item.followups.length > 0 && (
          <details className="rounded-lg border border-[var(--border)] bg-[var(--panel-2)]/40">
            <summary className="cursor-pointer select-none px-3 py-2 text-[13px] text-[var(--muted)]">
              {item.followups.length} follow-up{item.followups.length === 1 ? "" : "s"} ready —
              send if there&apos;s no reply
            </summary>
            <div className="px-3 pb-3 space-y-3">
              {item.followups.map((f) => (
                <Followup key={f.id} index={f.step} subject={f.subject} body={f.body} />
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

function Followup({
  index,
  subject,
  body,
}: {
  index: number;
  subject: string | null;
  body: string;
}) {
  const [copied, setCopied] = useState(false);
  const text = subject ? `${subject}\n\n${body}` : body;
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-3">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[11px] font-medium text-[var(--muted)]">Follow-up {index}</span>
        <button
          onClick={() => {
            navigator.clipboard?.writeText(text).then(
              () => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              },
              () => {},
            );
          }}
          className="ml-auto text-[11px] px-2 py-0.5 rounded border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
      {subject && <div className="text-[12px] text-[var(--muted)] mb-1">{subject}</div>}
      <p className="text-[13px] leading-relaxed whitespace-pre-wrap text-[var(--text)]">{body}</p>
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
