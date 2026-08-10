import Link from "next/link";
import { env } from "@/lib/env";
import { BRAND } from "@/lib/brand";
import { AvenyoLogo } from "@/components/brand/Logo";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-[var(--border)]">
      <div className="mx-auto w-full max-w-[1180px] px-6 py-14 lg:px-10">
        <div className="flex flex-col gap-10 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-xs">
            <AvenyoLogo size={28} />
            <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">
              Sodobne spletne strani za lokalna podjetja. Predlog pripravim vnaprej
              in brezplačno.
            </p>
          </div>

          <div className="flex gap-16 text-sm">
            <div>
              <div className="text-[var(--muted)]">Stran</div>
              <div className="mt-4 flex flex-col gap-3">
                <Link href="/examples" className="transition-colors hover:text-[var(--accent)]">
                  Primeri
                </Link>
                <Link href="/#cena" className="transition-colors hover:text-[var(--accent)]">
                  Cena
                </Link>
                <Link href="/#vprasanja" className="transition-colors hover:text-[var(--accent)]">
                  Vprašanja
                </Link>
              </div>
            </div>
            {/* Only rendered when there is something to put in it — an empty
                "Kontakt" heading is worse than no column. */}
            {(env.ownerEmail || env.ownerPhone) && (
              <div>
                <div className="text-[var(--muted)]">Kontakt</div>
                <div className="mt-4 flex flex-col gap-3">
                  {env.ownerEmail && (
                    <a
                      href={`mailto:${env.ownerEmail}`}
                      className="transition-colors hover:text-[var(--accent)]"
                    >
                      {env.ownerEmail}
                    </a>
                  )}
                  {env.ownerPhone && (
                    <a
                      href={`tel:${env.ownerPhone.replace(/\s+/g, "")}`}
                      className="transition-colors hover:text-[var(--accent)]"
                    >
                      {env.ownerPhone}
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-14 border-t border-[var(--border)] pt-6 text-sm text-[var(--muted)]">
          {/* The brand owns the line; the operator's own name only joins it when
              configured, since that is the name on the invoice. */}
          © {year} {BRAND.name}
          {env.ownerName && ` · ${env.ownerName}`}
        </div>
      </div>
    </footer>
  );
}
