// The public portfolio. A restaurant owner who gets "Hi, I rebuilt your website"
// asks "who even are you?" before anything else — this is the page that answers
// it with work rather than claims.
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { cleanDisplayName } from "@/lib/preview/brand";
import { SiteBackdrop } from "@/components/SiteBackdrop";
import { SiteNavBar } from "@/components/SiteNavBar";
import { SiteFooter } from "@/components/SiteFooter";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Primeri spletnih strani",
  description:
    "Primeri spletnih strani, ki smo jih pripravili za lokalna podjetja — frizerski saloni, restavracije, zobozdravniki in drugi.",
};

const SHELL = "mx-auto w-full max-w-[1180px] px-6 lg:px-10";

/**
 * The industry label under each card. searchRun.query is the discovery term
 * ("frizerski salon Ljubljana"), so drop the trailing region to leave the trade.
 */
function industryLabel(query: string | undefined): string | null {
  if (!query) return null;
  const trimmed = query.trim();
  if (!trimmed) return null;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export default async function ExamplesPage() {
  const leads = await prisma.lead.findMany({
    where: {
      showcase: true,
      previewHtmlPath: { not: null },
      previewImagePath: { not: null },
    },
    include: { searchRun: true },
    orderBy: { score: "desc" },
  });

  return (
    <div className="relative">
      <SiteBackdrop />
      <SiteNavBar />

      <main>
        <section className={`${SHELL} pt-20 pb-16 sm:pt-28 sm:pb-20`}>
          <div className="mx-auto max-w-3xl text-center">
            <div className="text-[13px] font-medium uppercase tracking-[0.14em] text-[var(--accent)]">
              Primeri
            </div>
            <h1 className="mt-4 text-[clamp(2.25rem,5vw,3.75rem)] font-semibold leading-[1.05] tracking-[-0.03em]">
              Strani, ki sem jih že pripravil
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[var(--muted)]">
              Vsaka od teh strani je bila pripravljena za resnično lokalno podjetje —
              na podlagi njihovih fotografij, ocen in podatkov. Kliknite katero koli
              in si jo oglejte v živo.
            </p>
          </div>
        </section>

        <section className={`${SHELL} pb-24 sm:pb-32`}>
          {leads.length === 0 ? (
            <p className="text-center text-[var(--muted)]">Primeri bodo objavljeni kmalu.</p>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {leads.map((lead) => {
                const label = industryLabel(lead.searchRun?.query ?? undefined);
                return (
                  <a
                    key={lead.id}
                    // ?src=examples tells the preview route this is portfolio
                    // traffic: don't count the view against the lead, and show a
                    // generic CTA rather than that business's own interest button.
                    href={`/p/${lead.id}?src=examples`}
                    className="group block overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel)] transition-all duration-300 hover:-translate-y-1 hover:border-[var(--muted)]/50"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden bg-[var(--panel-2)]">
                      <Image
                        src={lead.previewImagePath!}
                        alt={`Spletna stran za ${cleanDisplayName(lead.name)}`}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        // Screenshots are tall; anchor to the top so each card shows
                        // the hero rather than a slice of the middle of the page.
                        className="object-cover object-top transition-transform duration-700 group-hover:scale-[1.04]"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3 px-5 py-4">
                      <div className="min-w-0">
                        <div className="truncate text-[15px] font-medium">
                          {cleanDisplayName(lead.name)}
                        </div>
                        {label && (
                          <div className="mt-0.5 truncate text-[13px] text-[var(--muted)]">
                            {label}
                          </div>
                        )}
                      </div>
                      <span className="shrink-0 text-[var(--muted)] transition-colors group-hover:text-[var(--accent)]">
                        →
                      </span>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </section>

        <section className="border-t border-[var(--border)]">
          <div className={`${SHELL} py-24 sm:py-32`}>
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-[clamp(2rem,4vw,3.25rem)] font-semibold leading-[1.05] tracking-[-0.03em]">
                Želite takšno stran za svoje podjetje?
              </h2>
              <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-[var(--muted)]">
                Pripravim jo brezplačno in vnaprej. Plačate šele, če vam je všeč.
              </p>
              <Link
                href="/#kontakt"
                className="mt-10 inline-block rounded-xl bg-white px-7 py-3.5 text-[15px] font-medium text-[#0b0e14] transition-opacity hover:opacity-90"
              >
                Želim predlog
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
