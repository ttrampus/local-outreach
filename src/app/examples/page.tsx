// The public portfolio. A restaurant owner who gets "Hi, I rebuilt your website"
// asks "who even are you?" before anything else — this is the page that answers
// it with work rather than claims.
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { cleanDisplayName } from "@/lib/preview/brand";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Primeri spletnih strani",
  description:
    "Primeri spletnih strani, ki smo jih pripravili za lokalna podjetja — frizerski saloni, restavracije, zobozdravniki in drugi.",
};

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
    <main className="max-w-6xl mx-auto px-6 py-16 sm:py-24">
      <header className="max-w-2xl">
        <Link href="/" className="text-sm text-[var(--muted)] hover:text-[var(--text)]">
          ← Nazaj
        </Link>
        <h1 className="mt-6 text-3xl sm:text-4xl font-semibold tracking-tight">
          Primeri našega dela
        </h1>
        <p className="mt-4 text-[var(--muted)] leading-relaxed">
          Vsaka od teh strani je bila pripravljena za resnično lokalno podjetje —
          na podlagi njihovih fotografij, ocen in podatkov. Kliknite katero koli
          in si jo oglejte v živo.
        </p>
      </header>

      {leads.length === 0 ? (
        <p className="mt-16 text-[var(--muted)]">Primeri bodo objavljeni kmalu.</p>
      ) : (
        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {leads.map((lead) => {
            const label = industryLabel(lead.searchRun?.query ?? undefined);
            return (
              <a
                key={lead.id}
                // ?src=examples tells the preview route this is portfolio
                // traffic: don't count the view against the lead, and show a
                // generic CTA rather than that business's own interest button.
                href={`/p/${lead.id}?src=examples`}
                target="_blank"
                rel="noopener"
                className="group block rounded-xl border border-[var(--border)] bg-[var(--panel)] overflow-hidden transition-colors hover:border-[var(--accent)]"
              >
                <div className="relative aspect-[4/3] bg-[var(--panel-2)] overflow-hidden">
                  <Image
                    src={lead.previewImagePath!}
                    alt={`Spletna stran za ${cleanDisplayName(lead.name)}`}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    // Screenshots are tall; anchor to the top so each card shows
                    // the hero rather than a slice of the middle of the page.
                    className="object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                </div>
                <div className="p-4">
                  <div className="font-medium truncate">{cleanDisplayName(lead.name)}</div>
                  {label && (
                    <div className="mt-1 text-[13px] text-[var(--muted)] truncate">{label}</div>
                  )}
                </div>
              </a>
            );
          })}
        </div>
      )}

      <div className="mt-20 rounded-xl border border-[var(--border)] bg-[var(--panel)] p-8 text-center">
        <h2 className="text-xl font-semibold">Želite takšno stran za svoje podjetje?</h2>
        <p className="mt-2 text-[var(--muted)]">
          Pripravimo jo brezplačno. Plačate šele, če vam je všeč.
        </p>
        <Link
          href="/#contact"
          className="mt-6 inline-block rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white"
        >
          Pišite nam
        </Link>
      </div>
    </main>
  );
}
