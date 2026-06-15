const STYLES: Record<string, { color: string; bg: string; label: string }> = {
  HOT: { color: "var(--hot)", bg: "var(--hot-bg)", label: "HOT" },
  WARM: { color: "var(--warm)", bg: "var(--warm-bg)", label: "WARM" },
  COLD: { color: "var(--cold)", bg: "var(--cold-bg)", label: "COLD" },
};

export function TierBadge({ tier }: { tier: string }) {
  const s = STYLES[tier] ?? STYLES.COLD;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold tracking-wide"
      style={{ color: s.color, background: s.bg }}
    >
      {s.label}
    </span>
  );
}
