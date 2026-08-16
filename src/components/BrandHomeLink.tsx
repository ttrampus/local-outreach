"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The logo, wrapped so it always means "take me to the top of the homepage".
 *
 * A bare <Link href="/"> only does that from another page: clicking it while
 * already on `/` is a navigation to the URL you are on, which the router treats
 * as a no-op and leaves you halfway down the page — and worse, if you arrived
 * via `/#cena` the hash is still in the address bar, so a reload drops you back
 * at the pricing section. Handle the same-page case ourselves: drop the hash and
 * scroll up.
 */
export function BrandHomeLink({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <Link
      href="/"
      aria-label="Na vrh strani"
      className={className}
      onClick={(e) => {
        if (pathname !== "/") return; // let the router do a real navigation
        e.preventDefault();
        window.history.replaceState(null, "", "/");
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
      }}
    >
      {children}
    </Link>
  );
}
