// The public portfolio. A restaurant owner who gets "Hi, I rebuilt your website"
// asks "who even are you?" before anything else — this is the page that answers
// it with work rather than claims.
import type { Metadata } from "next";
import { readFile } from "node:fs/promises";
import path from "node:path";
import Image from "next/image";
import Link from "next/link";
import { SiteBackdrop } from "@/components/SiteBackdrop";
import { SiteNavBar } from "@/components/SiteNavBar";
import { SiteFooter } from "@/components/SiteFooter";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Nekaj primerov strani",
  description:
    "Primeri spletnih strani na naših predlogah — frizerski saloni, restavracije, zobozdravniki in drugi.",
};

const SHELL = "mx-auto w-full max-w-[1180px] px-6 lg:px-10";

interface Example {
  slug: string;
  name: string;
  type: string;
}

/**
 * The examples are invented businesses built by scripts/build-showcase-sites.mjs.
 *
 * This page used to list real prospects' previews (Lead.showcase), which put
 * real businesses' names, photos and Google reviews on our public portfolio
 * without their say-so. It now reads the same generated manifest as the
 * marketing page, so there is one set of examples and none of them is anyone.
 */
async function loadExamples(): Promise<Example[]> {
  try {
    const raw = await readFile(path.join(process.cwd(), "public", "site", "work", "manifest.json"), "utf8");
    return JSON.parse(raw) as Example[];
  } catch {
    return [];
  }
}

export default async function ExamplesPage() {
  const examples = await loadExamples();

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
              Nekaj primerov strani
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[var(--muted)]">
              Primeri, zgrajeni na naših predlogah. Podjetja so izmišljena, fotografije
              so iz fotobanke. Vaša stran dobi vaše ime, vaše podatke in vaše fotografije.
              Kliknite katero koli in si jo oglejte.
            </p>
          </div>
        </section>

        <section className={`${SHELL} pb-24 sm:pb-32`}>
          {examples.length === 0 ? (
            <p className="text-center text-[var(--muted)]">Primeri bodo objavljeni kmalu.</p>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {examples.map((ex) => (
                <a
                  key={ex.slug}
                  href={`/site/work/${ex.slug}.html`}
                  target="_blank"
                  rel="noopener"
                  className="group block overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel)] transition-all duration-300 hover:-translate-y-1 hover:border-[var(--muted)]/50"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-[var(--panel-2)]">
                    <Image
                      src={`/site/work/${ex.slug}.webp`}
                      alt={`${ex.name} — primer strani`}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      // Screenshots are full-page and tall; anchor to the top so each
                      // card shows the hero rather than a slice of the middle.
                      className="object-cover object-top transition-transform duration-700 group-hover:scale-[1.04]"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 px-5 py-4">
                    <div className="min-w-0">
                      <div className="truncate text-[15px] font-medium">{ex.name}</div>
                      <div className="mt-0.5 truncate text-[13px] text-[var(--muted)]">{ex.type}</div>
                    </div>
                    <span className="shrink-0 text-[var(--muted)] transition-colors group-hover:text-[var(--accent)]">
                      →
                    </span>
                  </div>
                </a>
              ))}
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
                href="/#contact"
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
