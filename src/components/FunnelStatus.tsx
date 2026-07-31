// Compact funnel stepper. The main line reads discovered → preview → drafted →
// approved → sent; everything past "sent" is shown as a trailing chip rather
// than another step, so the row stays a fixed width.
const STAGES = [
  { key: "discovered", label: "Discovered" },
  { key: "preview_ready", label: "Preview" },
  { key: "drafted", label: "Drafted" },
  { key: "approved", label: "Approved" },
  { key: "sent", label: "Sent" },
];

// Every forward status, in order. Statuses beyond "sent" must be listed even
// though they have no step of their own: indexOf drives how much of the row is
// filled in, so omitting them made the leads FURTHEST down the funnel — the
// interested ones, the customers — render as an entirely grey stepper.
const ORDER = [
  "discovered",
  "preview_ready",
  "drafted",
  "approved",
  "sent",
  "interested",
  "customer",
  "deployed",
];

/** Terminal chips shown after the row once reached. `lost` is an exit, not a stage. */
const CHIPS: Record<string, { label: string; muted?: boolean }> = {
  interested: { label: "Interested ✓" },
  customer: { label: "Customer ✓" },
  deployed: { label: "Deployed ✓" },
  lost: { label: "Lost", muted: true },
};

export function FunnelStatus({ status }: { status: string }) {
  // "lost" can happen from any stage, so it has no position on the line — the
  // row greys out entirely and the chip carries the meaning. An unrecognised
  // status clamps to the first stage rather than falling through to all-grey,
  // which would otherwise look identical to a brand new lead.
  const isLost = status === "lost";
  const currentIdx = isLost ? -1 : Math.max(0, ORDER.indexOf(status));
  const chip = CHIPS[status];

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {STAGES.map((s, i) => {
        const stageIdx = ORDER.indexOf(s.key);
        const done = !isLost && currentIdx >= stageIdx;
        const active = status === s.key;
        return (
          <div key={s.key} className="flex items-center gap-1">
            <span
              className={`text-[11px] px-2 py-0.5 rounded-md font-medium ${
                active
                  ? "bg-[var(--accent)] text-white"
                  : done
                    ? "text-[var(--text)]"
                    : "text-[var(--muted)]"
              }`}
              style={done && !active ? { background: "var(--panel-2)" } : undefined}
            >
              {s.label}
            </span>
            {i < STAGES.length - 1 && (
              <span className={done ? "text-[var(--accent)]" : "text-[var(--border)]"}>›</span>
            )}
          </div>
        );
      })}
      {chip && (
        <span
          className={`ml-1 text-[11px] px-2 py-0.5 rounded-md font-medium ${
            chip.muted
              ? "text-[var(--muted)] bg-[var(--panel-2)]"
              : "bg-[var(--accent)] text-white"
          }`}
        >
          {chip.label}
        </span>
      )}
    </div>
  );
}
