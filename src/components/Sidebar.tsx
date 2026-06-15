"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Leads", icon: "◧" },
  { href: "/search", label: "Discovery", icon: "⌕" },
  { href: "/outreach", label: "Outreach", icon: "✎" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 border-r border-[var(--border)] bg-[var(--panel)] flex flex-col">
      <div className="px-5 py-5 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <span className="grid place-items-center w-8 h-8 rounded-lg bg-[var(--accent)] text-white font-bold">
            ◆
          </span>
          <div className="leading-tight">
            <div className="font-semibold text-sm">Outreach Console</div>
            <div className="text-[11px] text-[var(--muted)]">local-business pipeline</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {NAV.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? "bg-[var(--accent-soft)] text-white"
                  : "text-[var(--muted)] hover:bg-[var(--panel-2)] hover:text-[var(--text)]"
              }`}
            >
              <span className="w-4 text-center">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 text-[11px] leading-relaxed text-[var(--muted)] border-t border-[var(--border)]">
        Manual-send by design. You approve and send every message yourself.
      </div>
    </aside>
  );
}
