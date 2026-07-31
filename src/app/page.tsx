// The public marketing page. Its job is narrow and specific: a business owner
// who gets an email saying "I rebuilt your website" clicks the domain and asks
// "who even are you?" — everything here exists to answer that before asking for
// anything. Hence the order: what this is, who I am, how it works, real work,
// price, objections, contact.
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { cleanDisplayName } from "@/lib/preview/brand";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sodobna spletna stran za vaše podjetje",
  description:
    "Brezplačen predlog spletne strani za vaše podjetje. Plačate šele, če vam je všeč — 50 € na mesec, vse spremembe vključene.",
};

const STEPS = [
  {
    n: "1",
    title: "Pripravim predlog",
    body: "Na podlagi vaših fotografij, ocen in podatkov izdelam celotno spletno stran. Brezplačno in brez obveznosti — tudi če se ne odzovete.",
  },
  {
    n: "2",
    title: "Pogledate jo",
    body: "Pošljem vam povezavo. Ni prijave, ni obrazcev — samo odprete in vidite, kako bi vaša stran izgledala.",
  },
  {
    n: "3",
    title: "Če vam je všeč, gre v živo",
    body: "Stran objavim na vaši domeni v 24 urah. Če vam ni všeč, ne storite ničesar in stvar je zaključena.",
  },
  {
    n: "4",
    title: "Skrbim zanjo naprej",
    body: "Gostovanje, posodobitve in vse spremembe so vključene v mesečno ceno. Odpoved kadar koli.",
  },
];

const FAQ = [
  {
    q: "Zakaj je predlog brezplačen? V čem je kljub?",
    a: "Kljuke ni. Stran izdelam vnaprej, ker je to najhitrejši način, da vidite, o čem govorim — opisovanje po telefonu ne deluje. Če vam ni všeč, nič ne plačate in nič ne dolgujete. Večina ljudi ne odgovori in to je povsem v redu.",
  },
  {
    q: "Kaj pa, če spletno stran že imam?",
    a: "Potem primerjajte. Predlog vam pošljem ne glede na to — če je vaša obstoječa stran boljša, mi to povejte in ne bom več pisal.",
  },
  {
    q: "Kdo je lastnik strani in domene?",
    a: "Vi. Domena je vaša, vsebina je vaša. Če odpoveste, vam datoteke izročim in stran lahko preselite drugam.",
  },
  {
    q: "Kaj je vključeno v 50 € na mesec?",
    a: "Gostovanje, SSL certifikat, vzdrževanje in vse spremembe besedila ali fotografij. Ni stroškov postavitve in ni skritih doplačil.",
  },
  {
    q: "Ali sem vezan na pogodbo?",
    a: "Ne. Odpoveste lahko kadar koli, brez odpovednega roka in brez pojasnil.",
  },
];

export default async function HomePage() {
  // A taste of the portfolio inline, so the strongest proof is visible without
  // a second click. The full set lives on /examples.
  const examples = await prisma.lead.findMany({
    where: {
      showcase: true,
      previewHtmlPath: { not: null },
      previewImagePath: { not: null },
    },
    orderBy: { score: "desc" },
    take: 3,
  });

  const price = env.monthlyPriceEur;
  const name = env.ownerName;

  return (
    <main>
      {/* Hero ------------------------------------------------------------- */}
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-16 sm:pt-32 sm:pb-24">
        <p className="text-sm font-medium text-[var(--accent)]">
          Brezplačen predlog — plačate šele, če vam je všeč
        </p>
        <h1 className="mt-4 text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.1] max-w-3xl">
          Sodobna spletna stran za vaše podjetje, pripravljena vnaprej.
        </h1>
        <p className="mt-6 text-lg text-[var(--muted)] leading-relaxed max-w-2xl">
          Ne pošiljam ponudb — pošiljam končano stran. Pogledate jo, in če vam je
          všeč, je v 24 urah v živo za {price} € na mesec. Vse spremembe vključene,
          odpoved kadar koli.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="#contact"
            className="rounded-lg bg-[var(--accent)] px-6 py-3 text-sm font-medium text-white"
          >
            Želim predlog za svoje podjetje
          </Link>
          <Link
            href="/examples"
            className="rounded-lg border border-[var(--border)] px-6 py-3 text-sm font-medium hover:border-[var(--accent)] transition-colors"
          >
            Poglejte primere
          </Link>
        </div>
      </section>

      {/* Who ------------------------------------------------------------- */}
      <section className="border-t border-[var(--border)]">
        <div className="max-w-5xl mx-auto px-6 py-16 sm:py-20 grid gap-10 md:grid-cols-[1fr_1.4fr]">
          <h2 className="text-2xl font-semibold tracking-tight">Kdo stoji za tem</h2>
          <div className="space-y-4 text-[var(--muted)] leading-relaxed">
            <p>
              {name && (
                <>
                  <span className="text-[var(--text)] font-medium">{name}</span>.{" "}
                </>
              )}
              Spletne strani izdelujem že več let. To ni agencija in ni prodajna
              ekipa: pišem vam jaz, stran naredim jaz, in ko me pokličete, se
              oglasim jaz.
            </p>
            <p>
              Delam z lokalnimi podjetji, ki imajo dobre ocene in resnične stranke,
              a spletno stran staro deset let ali pa je sploh nimajo. Takim
              podjetjem ena dobra stran prinese več kot kadar koli prej.
            </p>
            <p>
              Ker delam sam, sprejmem omejeno število strank hkrati — in raje
              povem vnaprej, da sem majhen, kot da se pretvarjam, da nisem.
            </p>
          </div>
        </div>
      </section>

      {/* How ------------------------------------------------------------- */}
      <section className="border-t border-[var(--border)]">
        <div className="max-w-5xl mx-auto px-6 py-16 sm:py-20">
          <h2 className="text-2xl font-semibold tracking-tight">Kako poteka</h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.n}>
                <div className="grid place-items-center w-8 h-8 rounded-lg bg-[var(--accent-soft)] text-white text-sm font-semibold">
                  {s.n}
                </div>
                <h3 className="mt-4 font-medium">{s.title}</h3>
                <p className="mt-2 text-sm text-[var(--muted)] leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Work ------------------------------------------------------------ */}
      {examples.length > 0 && (
        <section className="border-t border-[var(--border)]">
          <div className="max-w-5xl mx-auto px-6 py-16 sm:py-20">
            <div className="flex flex-wrap items-baseline justify-between gap-4">
              <h2 className="text-2xl font-semibold tracking-tight">Nekaj primerov</h2>
              <Link href="/examples" className="text-sm text-[var(--accent)] hover:underline">
                Vsi primeri →
              </Link>
            </div>
            <div className="mt-10 grid gap-6 sm:grid-cols-3">
              {examples.map((lead) => (
                <a
                  key={lead.id}
                  href={`/p/${lead.id}?src=examples`}
                  target="_blank"
                  rel="noopener"
                  className="group block rounded-xl border border-[var(--border)] overflow-hidden transition-colors hover:border-[var(--accent)]"
                >
                  <div className="relative aspect-[4/3] bg-[var(--panel-2)]">
                    <Image
                      src={lead.previewImagePath!}
                      alt={`Spletna stran za ${cleanDisplayName(lead.name)}`}
                      fill
                      sizes="(max-width: 640px) 100vw, 33vw"
                      className="object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                  </div>
                  <div className="p-3 text-sm truncate">{cleanDisplayName(lead.name)}</div>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Price ----------------------------------------------------------- */}
      <section className="border-t border-[var(--border)]">
        <div className="max-w-5xl mx-auto px-6 py-16 sm:py-20">
          <h2 className="text-2xl font-semibold tracking-tight">Cena</h2>
          <div className="mt-8 rounded-xl border border-[var(--border)] bg-[var(--panel)] p-8 max-w-md">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-semibold">{price} €</span>
              <span className="text-[var(--muted)]">/ mesec</span>
            </div>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Brez stroškov postavitve. Odpoved kadar koli.
            </p>
            <ul className="mt-6 space-y-2.5 text-sm">
              {[
                "Izdelava strani in postavitev v živo",
                "Gostovanje in SSL certifikat",
                "Vse spremembe besedila in fotografij",
                "Kontaktni obrazec, ki vam pošilja povpraševanja",
                "Prilagojeno mobilnim napravam",
              ].map((item) => (
                <li key={item} className="flex gap-2.5">
                  <span className="text-[var(--accent)]">✓</span>
                  <span className="text-[var(--muted)]">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* FAQ ------------------------------------------------------------- */}
      <section className="border-t border-[var(--border)]">
        <div className="max-w-5xl mx-auto px-6 py-16 sm:py-20">
          <h2 className="text-2xl font-semibold tracking-tight">Pogosta vprašanja</h2>
          <div className="mt-10 grid gap-8 md:grid-cols-2 max-w-4xl">
            {FAQ.map((item) => (
              <div key={item.q}>
                <h3 className="font-medium">{item.q}</h3>
                <p className="mt-2 text-sm text-[var(--muted)] leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact --------------------------------------------------------- */}
      <section id="contact" className="border-t border-[var(--border)]">
        <div className="max-w-5xl mx-auto px-6 py-16 sm:py-24">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Želite predlog za svoje podjetje?
          </h2>
          <p className="mt-4 text-[var(--muted)] leading-relaxed max-w-xl">
            Napišite mi ime podjetja. Predlog pripravim v nekaj dneh in vam pošljem
            povezavo — brez obveznosti in brez stroškov.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            {env.ownerBookingUrl && (
              <a
                href={env.ownerBookingUrl}
                target="_blank"
                rel="noopener"
                className="rounded-lg bg-[var(--accent)] px-6 py-3 text-sm font-medium text-white"
              >
                Rezervirajte klic
              </a>
            )}
            {env.ownerEmail && (
              <a
                href={`mailto:${env.ownerEmail}`}
                className="rounded-lg border border-[var(--border)] px-6 py-3 text-sm font-medium hover:border-[var(--accent)] transition-colors"
              >
                {env.ownerEmail}
              </a>
            )}
            {env.ownerPhone && (
              <a
                href={`tel:${env.ownerPhone.replace(/\s+/g, "")}`}
                className="rounded-lg border border-[var(--border)] px-6 py-3 text-sm font-medium hover:border-[var(--accent)] transition-colors"
              >
                {env.ownerPhone}
              </a>
            )}
          </div>
        </div>
      </section>

      <footer className="border-t border-[var(--border)]">
        <div className="max-w-5xl mx-auto px-6 py-8 flex flex-wrap gap-4 justify-between text-sm text-[var(--muted)]">
          <span>{name || "Spletne strani za lokalna podjetja"}</span>
          <Link href="/examples" className="hover:text-[var(--text)]">
            Primeri
          </Link>
        </div>
      </footer>
    </main>
  );
}
