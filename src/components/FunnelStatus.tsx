// Compact funnel stepper. "deployed" is an optional opt-in branch shown only once
// reached, so the main line reads discovered → preview → drafted → approved → sent.
const STAGES = [
  { key: "discovered", label: "Discovered" },
  { key: "preview_ready", label: "Preview" },
  { key: "drafted", label: "Drafted" },
  { key: "approved", label: "Approved" },
  { key: "sent", label: "Sent" },
];

const ORDER = ["discovered", "preview_ready", "drafted", "approved", "sent", "deployed"];

export function FunnelStatus({ status }: { status: string }) {
  const currentIdx = ORDER.indexOf(status);
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {STAGES.map((s, i) => {
        const stageIdx = ORDER.indexOf(s.key);
        const done = currentIdx >= stageIdx;
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
      {status === "deployed" && (
        <span className="ml-1 text-[11px] px-2 py-0.5 rounded-md font-medium bg-[var(--accent)] text-white">
          Deployed ✓
        </span>
      )}
    </div>
  );
}
