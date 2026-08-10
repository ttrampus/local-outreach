"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

export interface ShowcaseItem {
  id: string;
  name: string;
  image: string;
  label: string | null;
}

const DRAG_SLOP = 6; // px of movement before a press counts as a drag, not a click

/**
 * Horizontal rail for the portfolio.
 *
 * A three-card grid could only ever show three of the showcased sites, and the
 * work is the strongest thing on the page — so this shows all of them and lets
 * the row be scrolled. Native overflow scrolling stays the substrate (so
 * trackpad, touch, shift-wheel and keyboard all behave correctly); on top of it
 * this adds the three affordances a visitor actually reaches for:
 *
 *   - a plain vertical mouse wheel scrolls the rail sideways, but only while it
 *     has somewhere to go — at either end the gesture goes back to the page, so
 *     the rail never traps a visitor scrolling past it;
 *   - press and drag, the way you'd shove a physical row of photos;
 *   - arrow keys once the rail is focused, plus the buttons.
 */
export function ShowcaseRail({ items }: { items: ShowcaseItem[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);

  const sync = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // The rail is inset with `-mx-6 px-6` so cards can bleed to the viewport edge,
    // which means at rest scrollLeft sits at the padding value (40px at lg), not 0.
    // Comparing against 0 left the "previous" arrow enabled on a rail that was
    // already at its start.
    const pad = parseFloat(getComputedStyle(el).paddingLeft) || 0;
    // 2px slack: fractional layout widths mean scrollLeft rarely hits the exact max.
    const max = el.scrollWidth - el.clientWidth;
    setAtStart(el.scrollLeft <= pad + 2);
    setAtEnd(el.scrollLeft >= max - 2);
    setProgress(max > pad ? Math.min(1, Math.max(0, (el.scrollLeft - pad) / (max - pad))) : 0);
  }, []);

  useEffect(() => {
    sync();
    const el = ref.current;
    if (!el) return;
    // Re-check on resize too: a wider viewport can remove the overflow entirely,
    // which should disable both arrows rather than leave "next" live.
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [sync]);

  // Wheel → horizontal. Registered by hand because React's onWheel is passive,
  // and a passive listener cannot preventDefault the page scroll we're replacing.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      // A trackpad's own horizontal component, or shift-wheel, already scrolls
      // the rail natively — leave those completely alone.
      if (Math.abs(e.deltaX) >= Math.abs(e.deltaY) || e.shiftKey) return;

      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) return;
      // Hand the gesture back to the page at the end it's heading for, so the
      // rail is something you scroll *through* rather than get stuck in.
      const room = e.deltaY < 0 ? el.scrollLeft : max - el.scrollLeft;
      if (room <= 1) return;

      e.preventDefault();
      el.scrollBy({ left: e.deltaY, behavior: "auto" });
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Press-and-drag. Pointer events cover mouse and pen; touch keeps native
  // scrolling (dragging it here would fight the browser's own momentum).
  const drag = useRef({ active: false, startX: 0, startLeft: 0, moved: false });

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch" || e.button !== 0) return;
    const el = ref.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    drag.current = { active: true, startX: e.clientX, startLeft: el.scrollLeft, moved: false };
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!drag.current.active || !el) return;
    const dx = e.clientX - drag.current.startX;
    if (!drag.current.moved && Math.abs(dx) < DRAG_SLOP) return;
    if (!drag.current.moved) {
      drag.current.moved = true;
      // Snapping mid-drag yanks the rail out from under the cursor; it comes
      // back on release, which then settles the rail onto the nearest card.
      el.style.scrollSnapType = "none";
      // `scroll-smooth` animates even a direct scrollLeft assignment, which
      // makes the rail lag behind the cursor. Off for the duration of the drag.
      el.style.scrollBehavior = "auto";
      el.setPointerCapture(e.pointerId);
    }
    el.scrollLeft = drag.current.startLeft - dx;
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!drag.current.active || !el) return;
    drag.current.active = false;
    setDragging(false);
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    el.style.scrollSnapType = "";
    el.style.scrollBehavior = "";
  };

  // A drag that ends over a card would otherwise open that card's preview.
  const onClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (drag.current.moved) {
      e.preventDefault();
      e.stopPropagation();
      drag.current.moved = false;
    }
  };

  const nudge = useCallback((dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    // One card plus its gap, so a click always lands on a snap point.
    const card = el.querySelector("[data-card]") as HTMLElement | null;
    const step = card ? card.offsetWidth + 24 : el.clientWidth * 0.8;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  }, []);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      nudge(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      nudge(-1);
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      ref.current?.scrollTo({
        left: e.key === "Home" ? 0 : ref.current.scrollWidth,
        behavior: "smooth",
      });
    }
  };

  const canScroll = !atStart || !atEnd;

  return (
    <div className="relative">
      {canScroll && (
        <div className="mb-6 flex items-center gap-4">
          {/* Scrollbar stand-in: shows there's more here, and how much. */}
          <div className="h-px flex-1 bg-[var(--border)]">
            <div
              className="h-px bg-[var(--accent)] transition-[width,margin] duration-200"
              style={{ width: "22%", marginLeft: `${progress * 78}%` }}
            />
          </div>
          <button
            type="button"
            onClick={() => nudge(-1)}
            disabled={atStart}
            aria-label="Prejšnji primeri"
            className="grid h-10 w-10 place-items-center rounded-full border border-[var(--border)] text-[var(--muted)] transition-colors hover:border-[var(--muted)] hover:text-[var(--text)] disabled:pointer-events-none disabled:opacity-35"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => nudge(1)}
            disabled={atEnd}
            aria-label="Naslednji primeri"
            className="grid h-10 w-10 place-items-center rounded-full border border-[var(--border)] text-[var(--muted)] transition-colors hover:border-[var(--muted)] hover:text-[var(--text)] disabled:pointer-events-none disabled:opacity-35"
          >
            →
          </button>
        </div>
      )}

      <div
        ref={ref}
        onScroll={sync}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={onClickCapture}
        onKeyDown={onKeyDown}
        // Focusable so the arrow keys have somewhere to land; the group role +
        // label tell a screen reader what it just landed on.
        tabIndex={canScroll ? 0 : -1}
        role="group"
        aria-label="Primeri spletnih strani"
        className={`no-scrollbar -mx-6 flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-smooth px-6 pb-2 outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 lg:-mx-10 lg:px-10 ${
          canScroll ? (dragging ? "cursor-grabbing" : "cursor-grab") : ""
        }`}
      >
        {items.map((item) => (
          <a
            key={item.id}
            data-card
            href={`/p/${item.id}?src=examples`}
            target="_blank"
            rel="noopener"
            // The browser's own image/link dragging would pre-empt the rail drag.
            draggable={false}
            className="group block w-[300px] shrink-0 snap-start overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel)] transition-all duration-300 hover:-translate-y-1 hover:border-[var(--muted)]/50 sm:w-[360px]"
          >
            <div className="relative aspect-[4/3] overflow-hidden bg-[var(--panel-2)]">
              <Image
                src={item.image}
                alt={`Spletna stran za ${item.name}`}
                fill
                sizes="360px"
                draggable={false}
                className="select-none object-cover object-top transition-transform duration-700 group-hover:scale-[1.04]"
              />
            </div>
            <div className="flex items-center justify-between gap-3 px-5 py-4">
              <div className="min-w-0">
                <div className="truncate text-[15px] font-medium">{item.name}</div>
                {item.label && (
                  <div className="mt-0.5 truncate text-[13px] text-[var(--muted)]">
                    {item.label}
                  </div>
                )}
              </div>
              <span className="shrink-0 text-[var(--muted)] transition-colors group-hover:text-[var(--accent)]">
                →
              </span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
