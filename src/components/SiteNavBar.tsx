"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AvenyoLogo } from "@/components/brand/Logo";

const LINKS = [
  { href: "/examples", label: "Primeri" },
  { href: "/#kako", label: "Kako poteka" },
  { href: "/#cena", label: "Cena" },
  { href: "/#vprasanja", label: "Vprašanja" },
];

/**
 * The public top bar.
 *
 * At the top of the page the bar itself is invisible — no background, no border,
 * no blur — so only the words sit over the hero. It only materialises once you
 * have scrolled past the fold, where it would otherwise be unreadable text
 * floating over content.
 *
 */
export function SiteNavBar() {
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 24);
    onScroll(); // honour a page loaded already scrolled (anchor link, restore)
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        stuck
          ? "border-b border-[var(--border)]/70 bg-[var(--bg)]/80 backdrop-blur-xl"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <nav className="mx-auto flex h-16 w-full max-w-[1180px] items-center gap-8 px-6 lg:px-10">
        {/* Below sm the wordmark is dropped rather than scaled down — the brand's
            floor for the lockup is 28px and there isn't room for it beside the CTA. */}
        <Link href="/" className="flex items-center">
          <span className="hidden sm:flex">
            <AvenyoLogo size={28} />
          </span>
          <span className="flex sm:hidden">
            <AvenyoLogo size={28} wordmark={false} />
          </span>
        </Link>

        <div className="ml-auto hidden items-center gap-7 text-sm text-[var(--muted)] md:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="transition-colors hover:text-[var(--text)]">
              {l.label}
            </Link>
          ))}
        </div>

        <Link
          href="/#kontakt"
          className="ml-auto rounded-lg bg-white px-4 py-2 text-sm font-medium text-[#0b0e14] transition-opacity hover:opacity-90 md:ml-0"
        >
          Želim predlog
        </Link>
      </nav>
    </header>
  );
}
