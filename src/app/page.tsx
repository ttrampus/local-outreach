// The public marketing page. Its job is narrow and specific: a business owner
// who gets an email saying "I rebuilt your website" clicks the domain and asks
// "who even are you?" — everything here exists to answer that before asking for
// anything. Hence the order: what this is, real work, how it works, who I am,
// price, objections, contact.
//
// This page is itself the strongest sales argument, so its own craft matters:
// nobody buys a website from a bad-looking website.
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { cleanDisplayName } from "@/lib/preview/brand";
import { SiteBackdrop } from "@/components/SiteBackdrop";
import { SiteNavBar } from "@/components/SiteNavBar";
import { SiteFooter } from "@/components/SiteFooter";
import { ShowcaseRail } from "@/components/ShowcaseRail";
import { PRICING } from "@/lib/pricing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sodobna spletna stran za vaše podjetje",
  description: `Brezplačen predlog spletne strani za vaše podjetje. Plačate šele, če vam je všeč — izdelava ${PRICING.buildEur} €, mesečna skrb ${PRICING.careMonthlyEur} €.`,
};

// One container for every section. Previously each section repeated its own
// `max-w-5xl mx-auto px-6`, which is both narrow on a desktop viewport and the
// reason things drifted out of alignment with each other.
const SHELL = "mx-auto w-full max-w-[1180px] px-6 lg:px-10";

const STEPS = [
  {
    n: "01",
    title: "Pripravim predlog",
    body: "Na podlagi vaših fotografij, ocen in podatkov izdelam celotno spletno stran. Brezplačno in brez obveznosti — tudi če se ne odzovete.",
  },
  {
    n: "02",
    title: "Pogledate jo",
    body: "Pošljem vam povezavo. Ni prijave, ni obrazcev — samo odprete in vidite, kako bi vaša stran izgledala.",
  },
  {
    n: "03",
    title: "Če vam je všeč, gre v živo",
    body: "Stran objavim na vaši domeni v 24 urah. Če vam ni všeč, ne storite ničesar in stvar je zaključena.",
  },
  {
    n: "04",
    title: "Skrbim zanjo naprej",
    body: "Če želite, prevzamem gostovanje, posodobitve in spremembe za mesečno ceno. Ni obvezno in odpoveste lahko kadar koli.",
  },
];

// Three plans, because a prospect only ever asks one of three questions: "I just
// need a website", "I need someone to look after it", "I want it to keep getting
// better". Twelve tiers answer none of them. Numbers come from @/lib/pricing so
// the page and the outreach email can never quote different prices.
//
// Every feature line here describes an OUTCOME the customer gets, never an
// allowance they spend. See the note in @/lib/pricing: metering the work is the
// one thing that would throw away the advantage this whole business runs on.
const PLANS = [
  {
    id: "stran",
    name: "Spletna stran",
    price: `${PRICING.buildEur} €`,
    period: "enkratno",
    who: "Za podjetja, ki potrebujejo profesionalno spletno stran brez kompliciranja.",
    features: [
      "Izdelava celotne spletne strani",
      "Prilagojen dizajn in vsebina",
      "Do 10 podstrani",
      "Popolnoma prilagojeno mobilnim napravam",
      "Kontaktni obrazec s povpraševanji na vaš e-naslov",
      "Google Zemljevidi",
      "Osnovna SEO optimizacija",
      "Povezava z vašo domeno",
      "Neomejene spremembe pred objavo",
      "Stran je po plačilu vaša — datoteke dobite v roke",
    ],
    note: "Gostovanje in domena nista vključena.",
    highlight: false,
  },
  {
    id: "skrb",
    name: "Spletna stran + Skrb",
    price: `${PRICING.buildEur} € + ${PRICING.careMonthlyEur} €`,
    period: "enkratno + na mesec",
    who: "Za podjetja, ki se po objavi ne želijo več ukvarjati s stranjo.",
    features: [
      "Vse iz paketa Spletna stran",
      "Gostovanje in SSL certifikat",
      "Samodejne varnostne kopije",
      "Varnostne in tehnične posodobitve",
      "Nadzor delovanja strani",
      "Sprotne manjše spremembe vsebine in oblike",
      "Mesečno poročilo o obiskih",
      "Tehnična podpora",
      "Upravljanje domene",
      "Odpoved kadar koli",
    ],
    note: "Domeno registrirate na svoje ime; zaračunam jo po nabavni ceni.",
    highlight: true,
  },
  {
    id: "rast",
    name: "Rast",
    price: `${PRICING.growthMonthlyEur} €`,
    period: "na mesec",
    who: "Za podjetja, ki od strani pričakujejo več strank, ne le da obstaja.",
    features: [
      "Vse iz paketa Skrb",
      "Naprednejša SEO optimizacija",
      "Urejanje Google profila podjetja",
      "Nova vsebina in pristajalne strani",
      "Mesečne izboljšave strani",
      "Optimizacija hitrosti",
      "Izboljševanje konverzij",
      "Mesečni pregled rezultatov",
    ],
    note: "Ob paketu Rast je izdelava strani vključena.",
    highlight: false,
  },
];

// The one rule that replaces the old price menu. Left column: ordinary website
// work, which is included whatever it happens to be. Right column: things that
// are a different product, not a bigger website — those get a real quote,
// because "booking system" is anything from a Calendly link to a platform.
const INCLUDED = [
  "Podstrani in razdelki",
  "Galerije in fotografije",
  "Obrazci in zemljevidi",
  "Ceniki, meniji, storitve",
  "Mnenja strank in pogosta vprašanja",
  "Animacije in prilagojena oblika",
  "Spremembe besedila in slik",
  "Osnovna SEO optimizacija",
];

const BY_QUOTE = [
  "Rezervacijski sistem z računi in plačili",
  "Spletna trgovina",
  "Portal za stranke",
  "Povezava z vašo poslovno programsko opremo",
  "Obsežna večjezična stran",
  "Spletna aplikacija po meri",
];

const FAQ = [
  {
    q: "Zakaj je predlog brezplačen? V čem je kljub?",
    a: "Kljuke ni. Stran izdelam vnaprej, ker je to najhitrejši način, da vidite, o čem govorim — opisovanje po telefonu ne deluje. Če vam ni všeč, nič ne plačate in nič ne dolgujete. Večina ljudi ne odgovori in to je povsem v redu.",
  },
  {
    q: "Kaj pa, če spletno stran že imam?",
    a: "Potem primerjajte. Predlog vam pošljem ne glede na to — če je vaša obstoječa stran boljša, mi to povejte in ne bom več pisal. Cena je enaka: nova stran je vedno nova stran, ne popravljanje stare.",
  },
  {
    q: "Koliko stanejo spremembe in dodatne podstrani?",
    a: "Nič. Preden gre stran v živo, jo popravljam, dokler ni takšna, kot si jo želite — brez štetja popravkov in brez doplačil za dodatno podstran ali razdelek. Ločeno ponudbo pripravim samo za stvari, ki niso več spletna stran, ampak svoj projekt: rezervacijski sistem s plačili, spletna trgovina, portal za stranke ali povezava z vašo poslovno programsko opremo.",
  },
  {
    q: "Kdo je lastnik strani in domene?",
    a: "Vi. Domena je registrirana na vaše ime in jo zaračunam po nabavni ceni, vsebina je vaša. Če odpoveste, vam datoteke izročim in stran lahko preselite drugam.",
  },
  {
    q: `Kaj je vključeno v ${PRICING.careMonthlyEur} € na mesec?`,
    a: "Gostovanje, SSL certifikat, varnostne kopije, varnostne posodobitve, nadzor delovanja in sprotne manjše spremembe — nove cene, drugačen delovni čas, nova fotografija, dodana storitev. Brez omejitve na minute. Izdelava strani je enkratni strošek in ni všteta v mesečno ceno.",
  },
  {
    q: "Ali moram vzeti mesečni paket?",
    a: `Ne. Stran lahko plačate enkratno (${PRICING.buildEur} €), dobite datoteke in jo gostujete, kjer želite. Mesečna skrb je za tiste, ki se s tem nočejo ukvarjati.`,
  },
  {
    q: "Ali sem vezan na pogodbo?",
    a: "Ne. Mesečno skrb odpoveste kadar koli, brez odpovednega roka in brez pojasnil. Stran ostane vaša.",
  },
  {
    q: "Kako dolgo traja, da je stran v živo?",
    a: "Predlog je narejen že preden vas kontaktiram. Ko potrdite, je stran na vaši domeni v 24 urah.",
  },
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[13px] font-medium uppercase tracking-[0.14em] text-[var(--accent)]">
      {children}
    </div>
  );
}

export default async function HomePage() {
  // The whole portfolio, not a slice of three: the work is the strongest thing
  // on this page, and the rail below can scroll however many there are.
  const examples = await prisma.lead.findMany({
    where: {
      showcase: true,
      previewHtmlPath: { not: null },
      previewImagePath: { not: null },
    },
    include: { searchRun: true },
    orderBy: { score: "desc" },
  });

  const railItems = examples.map((lead) => ({
    id: lead.id,
    name: cleanDisplayName(lead.name),
    image: lead.previewImagePath!,
    label: lead.searchRun?.query
      ? lead.searchRun.query.trim().charAt(0).toUpperCase() + lead.searchRun.query.trim().slice(1)
      : null,
  }));

  const name = env.ownerName;

  return (
    <div className="relative">
      <SiteBackdrop />
      <SiteNavBar />

      <main>
        {/* Hero ----------------------------------------------------------- */}
        <section className={`${SHELL} pt-24 pb-20 sm:pt-36 sm:pb-28`}>
          <div className="mx-auto max-w-4xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--panel)]/60 px-4 py-1.5 text-sm text-[var(--muted)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
              Brezplačen predlog — plačate šele, če vam je všeč
            </div>

            <h1 className="mt-8 text-[clamp(2.75rem,6vw,4.75rem)] font-semibold leading-[1.02] tracking-[-0.03em]">
              Sodobna spletna stran{" "}
              <span className="text-[var(--muted)]">za vaše podjetje.</span>
            </h1>

            <p className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-[var(--muted)] sm:text-xl">
              Ne pošiljam ponudb — pošiljam končano stran. Pogledate jo, in če vam je
              všeč, je v 24 urah v živo za {PRICING.buildEur} €. Za{" "}
              {PRICING.careMonthlyEur} € na mesec zanjo skrbim naprej.
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="#kontakt"
                className="rounded-xl bg-white px-7 py-3.5 text-[15px] font-medium text-[#0b0e14] transition-opacity hover:opacity-90"
              >
                Želim predlog za svoje podjetje
              </Link>
              <Link
                href="/examples"
                className="rounded-xl border border-[var(--border)] px-7 py-3.5 text-[15px] font-medium transition-colors hover:border-[var(--muted)]"
              >
                Poglejte primere
              </Link>
            </div>

            <p className="mt-6 text-sm text-[var(--muted)]">
              Predlog je brezplačen · Brez pogodbe · Mesečno skrb odpoveste kadar koli
            </p>
          </div>
        </section>

        {/* Work ----------------------------------------------------------- */}
        {railItems.length > 0 && (
          <section className={`${SHELL} pb-24 sm:pb-32`}>
            <ShowcaseRail items={railItems} />

            <div className="mt-8 text-center">
              <Link
                href="/examples"
                className="text-[15px] text-[var(--muted)] transition-colors hover:text-[var(--text)]"
              >
                Poglejte vse primere →
              </Link>
            </div>
          </section>
        )}

        {/* How ------------------------------------------------------------ */}
        <section id="kako" className="scroll-mt-20 border-t border-[var(--border)]">
          <div className={`${SHELL} py-24 sm:py-32`}>
            <div className="max-w-2xl">
              <Eyebrow>Kako poteka</Eyebrow>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
                Štirje koraki, brez sestankov
              </h2>
            </div>

            {/* gap-px over a border-coloured background draws the hairline grid
                between cells without doubling borders at the seams. */}
            <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--border)] sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s) => (
                <div key={s.n} className="bg-[var(--bg)] p-7">
                  <div className="font-mono text-sm text-[var(--accent)]">{s.n}</div>
                  <h3 className="mt-5 text-lg font-medium tracking-tight">{s.title}</h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-[var(--muted)]">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Who ------------------------------------------------------------ */}
        <section className="border-t border-[var(--border)]">
          <div className={`${SHELL} py-24 sm:py-32`}>
            <div className="grid gap-14 lg:grid-cols-[0.8fr_1.2fr]">
              <div>
                <Eyebrow>Kdo stoji za tem</Eyebrow>
                <h2 className="mt-4 text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
                  Ena oseba, ne agencija
                </h2>
              </div>
              <div className="space-y-5 text-lg leading-relaxed text-[var(--muted)]">
                <p>
                  {name && <span className="font-medium text-[var(--text)]">{name}. </span>}
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
          </div>
        </section>

        {/* Price ---------------------------------------------------------- */}
        <section id="cena" className="scroll-mt-20 border-t border-[var(--border)]">
          <div className={`${SHELL} py-24 sm:py-32`}>
            <div className="mx-auto max-w-2xl text-center">
              <Eyebrow>Cena</Eyebrow>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
                Tri možnosti, brez drobnega tiska
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-[var(--muted)]">
                Potrebujete samo novo stran? Ali naj zanjo tudi skrbim? Ali naj jo iz
                meseca v mesec izboljšujem? Vsak paket odgovarja na eno vprašanje.
              </p>
            </div>

            <div className="mt-14 grid items-start gap-6 lg:grid-cols-3">
              {PLANS.map((plan) => (
                <div
                  key={plan.id}
                  className={`relative flex h-full flex-col rounded-2xl border bg-[var(--panel)] p-8 ${
                    plan.highlight
                      ? "border-[var(--accent)]/60 ring-1 ring-[var(--accent)]/20 lg:-mt-4"
                      : "border-[var(--border)]"
                  }`}
                >
                  {plan.highlight && (
                    <div className="absolute -top-3 left-8 rounded-full bg-[var(--accent)] px-3 py-1 text-[12px] font-medium uppercase tracking-[0.1em] text-white">
                      Najbolj pogosto
                    </div>
                  )}

                  <h3 className="text-lg font-medium tracking-tight">{plan.name}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-[var(--muted)]">{plan.who}</p>

                  <div className="mt-7 flex flex-wrap items-baseline gap-x-2">
                    <span className="text-4xl font-semibold tracking-[-0.03em]">{plan.price}</span>
                    <span className="text-[15px] text-[var(--muted)]">{plan.period}</span>
                  </div>

                  <Link
                    href="#kontakt"
                    className={`mt-7 block rounded-xl px-6 py-3 text-center text-[15px] font-medium transition-opacity ${
                      plan.highlight
                        ? "bg-white text-[#0b0e14] hover:opacity-90"
                        : "border border-[var(--border)] transition-colors hover:border-[var(--muted)]"
                    }`}
                  >
                    Želim brezplačen predlog
                  </Link>

                  <ul className="mt-8 space-y-3.5">
                    {plan.features.map((f) => (
                      <li key={f} className="flex gap-3 text-[15px]">
                        <span className="mt-0.5 text-[var(--accent)]">✓</span>
                        <span className="text-[var(--muted)]">{f}</span>
                      </li>
                    ))}
                  </ul>

                  {plan.note && (
                    <p className="mt-6 text-[13px] text-[var(--muted)]">{plan.note}</p>
                  )}
                </div>
              ))}
            </div>

            {/* The single strongest thing about this offer: the demo isn't a demo.
                It sits directly under the prices, where the hesitation happens. */}
            <div className="mx-auto mt-14 max-w-3xl rounded-2xl border border-[var(--border)] bg-[var(--panel)]/50 p-8 text-center">
              <p className="text-lg leading-relaxed">
                Predlog, ki ste ga prejeli,{" "}
                <span className="text-[var(--muted)]">
                  ni prodajni demo. Če se odločite za sodelovanje, postane vaša spletna
                  stran — cena predloga je vključena v ceno projekta.
                </span>
              </p>
            </div>

            {/* What used to be a price list of add-ons. A menu that puts a number
                next to "extra page" teaches the customer to count before asking,
                which is exactly the wrong instinct to train when another page costs
                almost nothing to build. Two columns instead: everything normal is
                in, and the genuinely different products get a real quote. */}
            <div className="mt-20">
              <div className="max-w-2xl">
                <Eyebrow>Obseg</Eyebrow>
                <h3 className="mt-4 text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
                  Kaj pa, če potrebujem kaj več?
                </h3>
                <p className="mt-4 text-[17px] leading-relaxed text-[var(--muted)]">
                  Vse, kar sodi na običajno spletno stran podjetja, je vključeno v
                  ceno — brez doplačil za dodatno podstran, razdelek ali spremembo.
                  Kar potrebujete, se dogovorimo vnaprej.
                </p>
              </div>

              <div className="mt-10 grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)]/50 p-8">
                  <div className="text-[15px] font-medium">Vključeno v ceno</div>
                  <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                    {INCLUDED.map((f) => (
                      <li key={f} className="flex gap-3 text-[15px]">
                        <span className="mt-0.5 text-[var(--accent)]">✓</span>
                        <span className="text-[var(--muted)]">{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-2xl border border-[var(--border)] p-8">
                  <div className="text-[15px] font-medium">Ponudba po dogovoru</div>
                  <p className="mt-2 text-[14px] leading-relaxed text-[var(--muted)]">
                    Zahtevnejše funkcionalnosti so svoj projekt in ne spletna stran z
                    dodatkom — zanje pripravim ločeno ponudbo.
                  </p>
                  <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                    {BY_QUOTE.map((f) => (
                      <li key={f} className="flex gap-3 text-[15px]">
                        <span className="mt-0.5 text-[var(--muted)]">→</span>
                        <span className="text-[var(--muted)]">{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ ------------------------------------------------------------ */}
        <section id="vprasanja" className="scroll-mt-20 border-t border-[var(--border)]">
          <div className={`${SHELL} py-24 sm:py-32`}>
            <div className="max-w-2xl">
              <Eyebrow>Pogosta vprašanja</Eyebrow>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
                Kar ljudje običajno vprašajo
              </h2>
            </div>

            <div className="mt-14 grid gap-x-16 gap-y-10 md:grid-cols-2">
              {FAQ.map((item) => (
                <div key={item.q}>
                  <h3 className="text-lg font-medium tracking-tight">{item.q}</h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-[var(--muted)]">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Contact -------------------------------------------------------- */}
        <section id="kontakt" className="scroll-mt-20 border-t border-[var(--border)]">
          <div className={`${SHELL} py-24 sm:py-32`}>
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-[clamp(2rem,4vw,3.25rem)] font-semibold leading-[1.05] tracking-[-0.03em]">
                Želite predlog za svoje podjetje?
              </h2>
              <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-[var(--muted)]">
                Napišite mi ime podjetja. Predlog pripravim v nekaj dneh in vam pošljem
                povezavo — brez obveznosti in brez stroškov.
              </p>

              {/* Every CTA here is env-driven. With OUTREACH_OWNER_* unset this
                  section renders no buttons at all — the page's whole conversion
                  path silently disappears — so say so loudly in development
                  rather than shipping a dead end. */}
              {!env.ownerBookingUrl && !env.ownerEmail && !env.ownerPhone && (
                <div className="mx-auto mt-10 max-w-xl rounded-xl border border-dashed border-[var(--hot)] p-5 text-[15px] text-[var(--hot)]">
                  Ni kontaktnih podatkov. Nastavite <code>OUTREACH_OWNER_EMAIL</code>,{" "}
                  <code>OUTREACH_OWNER_PHONE</code> ali <code>OUTREACH_OWNER_BOOKING_URL</code>{" "}
                  v <code>.env.local</code>.
                </div>
              )}

              <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
                {env.ownerBookingUrl && (
                  <a
                    href={env.ownerBookingUrl}
                    target="_blank"
                    rel="noopener"
                    className="rounded-xl bg-white px-7 py-3.5 text-[15px] font-medium text-[#0b0e14] transition-opacity hover:opacity-90"
                  >
                    Rezervirajte klic
                  </a>
                )}
                {env.ownerEmail && (
                  <a
                    href={`mailto:${env.ownerEmail}`}
                    className="rounded-xl border border-[var(--border)] px-7 py-3.5 text-[15px] font-medium transition-colors hover:border-[var(--muted)]"
                  >
                    {env.ownerEmail}
                  </a>
                )}
                {env.ownerPhone && (
                  <a
                    href={`tel:${env.ownerPhone.replace(/\s+/g, "")}`}
                    className="rounded-xl border border-[var(--border)] px-7 py-3.5 text-[15px] font-medium transition-colors hover:border-[var(--muted)]"
                  >
                    {env.ownerPhone}
                  </a>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
