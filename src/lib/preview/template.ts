// Build a distinctive, mobile-responsive single-page site from data we already
// have (name, category, reviews, address). One self-contained HTML string with
// inline CSS — ready to screenshot or deploy. The HERO is the artifact that ends
// up in outreach (render.ts screenshots above-the-fold), so each LAYOUT archetype
// gives the hero a genuinely different composition, and a per-business seed varies
// alignment / mesh / accent so a whole sweep of one category never looks cloned.
import type { NormalizedPlaceDetails } from "@/lib/leadSource/types";
import { pickTheme, GOOGLE_FONTS_HREF, type Theme, type Layout } from "./theme";
import { detectLocale, getStrings, type Locale, type LocaleStrings } from "./i18n";
import { cleanDisplayName } from "./brand";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Deterministic per-business seed so variation is stable across regenerations.
function seedFrom(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function pick<T>(arr: T[], seed: number, salt = 0): T {
  return arr[(seed + salt) % arr.length];
}

function neighborhood(address?: string): string | null {
  if (!address) return null;
  const part = address.split(",")[0]?.trim();
  return part && part.length <= 40 ? part : null;
}

interface Ctx {
  theme: Theme;
  t: LocaleStrings;
  seed: number;
  accent: string;
  name: string;
  rawName: string;
  label: string;
  area: string | null;
  tagline: string;
  eyebrow: string;
  ratingLine: string | null;
  rating: string | null;
  reviewCount: number;
  monogram: string;
  services: { title: string; blurb: string }[];
  testimonials: string[];
  address?: string;
  phone?: string;
  hours: string[]; // real weekday opening-hours lines, when available
  heroImg?: string; // data URI of the lead photo, when available
  gallery: string[]; // data URIs of the remaining photos
  mapImg?: string; // data URI of the location static map, when available
}

export function generateSiteHtml(
  place: NormalizedPlaceDetails,
  searchHint = "",
  photos: string[] = [],
  mapUri: string | null = null,
): string {
  const theme = pickTheme(place.categories, searchHint);
  const locale: Locale = detectLocale(place);
  const t = getStrings(locale);
  const seed = seedFrom(place.placeId || place.name);
  const accent = pick(theme.accents, seed, 0);
  const area = neighborhood(place.address);
  const rawName = cleanDisplayName(place.name);
  const name = esc(rawName);
  // Localized human label for this theme (e.g. "salon" → "kavarna"); used in copy.
  const label = t.label[theme.key] ?? theme.label;
  const services = t.services[theme.key] ?? t.services.default;
  const ratingLine =
    place.rating && place.reviewCount
      ? t.ratingLine(place.rating.toFixed(1), place.reviewCount)
      : null;

  const heroIdx = photos.length ? seed % photos.length : 0;
  const heroImg = photos[heroIdx];
  const gallery = photos.filter((_, i) => i !== heroIdx);

  const ctx: Ctx = {
    theme,
    t,
    seed,
    accent,
    name,
    rawName,
    label,
    area: area ? esc(area) : null,
    tagline: esc(pick(t.taglines, seed, 1)(label, area)),
    eyebrow: esc(area ?? pick(t.eyebrows, seed, 2)),
    ratingLine: ratingLine ? esc(ratingLine) : null,
    rating: place.rating ? place.rating.toFixed(1) : null,
    reviewCount: place.reviewCount,
    monogram: esc((rawName.trim()[0] ?? "•").toUpperCase()),
    services,
    testimonials: place.reviewSnippets.slice(0, 3).map((t) => esc(t)),
    address: place.address ? esc(place.address) : undefined,
    phone: place.phone ? esc(place.phone) : undefined,
    hours: (place.openingHours ?? []).map((h) => esc(h)),
    heroImg,
    gallery,
    mapImg: mapUri ?? undefined,
  };

  const seedClass = `seed-${["a", "b", "c"][seed % 3]}`;
  const photoClass = heroImg ? " has-photo" : "";
  // A real photo always wins: it converts far better than a typographic hero.
  const hero = heroImg ? heroPhoto(ctx) : HERO_BUILDERS[theme.layout](ctx);

  return `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${name}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="${GOOGLE_FONTS_HREF}" />
<style>${buildCss(theme, accent)}</style>
</head>
<body class="layout-${theme.layout} ${seedClass}${photoClass}">
  ${nav(ctx)}
  ${hero}
  ${sections(ctx)}
  ${revealScript()}
</body>
</html>`;
}

// ── Shared chrome ──────────────────────────────────────────────────────────

function nav(c: Ctx): string {
  return `<nav><div class="wrap">
    <span class="brand">${c.name}</span>
    <span class="navlinks">
      <a href="#services">${c.t.navServices}</a><a href="#about">${c.t.navAbout}</a>
      <a href="#reviews">${c.t.navReviews}</a><a class="navcta" href="#contact">${c.t.navBook}</a>
    </span>
  </div></nav>`;
}

function ratingChip(c: Ctx): string {
  if (!c.rating) return "";
  return `<span class="chip"><span class="stars">★</span>${c.rating}${
    c.reviewCount ? ` · ${c.reviewCount} ${c.t.reviewsWord}` : ""
  }</span>`;
}

// ── Hero builders (one per layout archetype) ───────────────────────────────

type HeroBuilder = (c: Ctx) => string;

// Image-led hero — used whenever the business has real photos. A dark scrim over
// the photo keeps text legible across any image, while the brand accent + fonts
// still carry the theme. This is the version that actually sells the mockup.
const heroPhoto: HeroBuilder = (c) => `
  <header class="hero">
    <div class="hero-bg" style="background-image:url('${c.heroImg}')"></div>
    <div class="scrim"></div>
    <div class="wrap hero-inner">
      <span class="eyebrow">${c.label.toUpperCase()} · ${c.eyebrow}</span>
      <h1>${c.name}</h1>
      <p class="lede">${c.tagline}</p>
      <div class="cta-row">
        <a class="btn" href="#contact">${c.t.bookNow}</a>
        ${c.rating ? `<span class="chip"><span class="stars">★</span>${c.rating}${c.reviewCount ? ` · ${c.reviewCount} ${c.t.reviewsWord}` : ""}</span>` : ""}
      </div>
    </div>
  </header>`;

const heroBold: HeroBuilder = (c) => `
  <header class="hero">
    <div class="mesh"></div>
    <span class="ghost" aria-hidden="true">${c.monogram}</span>
    <div class="wrap hero-inner">
      <span class="eyebrow">${c.label.toUpperCase()} · ${c.eyebrow}</span>
      <h1>${c.name}</h1>
      <p class="lede">${c.tagline}</p>
      <div class="cta-row">
        <a class="btn" href="#contact">${c.t.bookNow}</a>
        <a class="btn-ghost" href="#services">${c.t.seeServices}</a>
      </div>
      <div class="statbar">
        ${c.rating ? `<div class="stat"><b>${c.rating}★</b><span>${c.reviewCount} ${c.t.reviewsWord}</span></div>` : ""}
        <div class="stat"><b>${c.t.local}</b><span>${c.area ?? c.t.independent}</span></div>
        <div class="stat"><b>${c.t.sameDay}</b><span>${c.t.fastResponse}</span></div>
      </div>
    </div>
  </header>`;

const heroEditorial: HeroBuilder = (c) => `
  <header class="hero">
    <span class="ghost" aria-hidden="true">${c.monogram}</span>
    <div class="wrap hero-inner">
      <div class="hero-main">
        <span class="kicker">${c.eyebrow} — ${c.label}</span>
        <h1>${c.name}</h1>
        <div class="rule"></div>
        <p class="lede">${c.tagline}</p>
        <a class="btn" href="#contact">${c.t.makeBooking}</a>
      </div>
      <aside class="hero-meta">
        ${c.rating ? `<div class="meta-row"><span class="meta-k">${c.t.rated}</span><span class="meta-v">${c.rating} ★</span></div>` : ""}
        ${c.reviewCount ? `<div class="meta-row"><span class="meta-k">${c.t.reviews}</span><span class="meta-v">${c.reviewCount}</span></div>` : ""}
        ${c.area ? `<div class="meta-row"><span class="meta-k">${c.t.foundIn}</span><span class="meta-v">${c.area}</span></div>` : ""}
        <div class="meta-row"><span class="meta-k">${c.t.booking}</span><span class="meta-v">${c.t.open}</span></div>
      </aside>
    </div>
  </header>`;

const heroWarm: HeroBuilder = (c) => `
  <header class="hero">
    <div class="glow"></div>
    <div class="wrap hero-inner">
      ${ratingChip(c)}
      <h1>${c.name}</h1>
      <p class="lede">${c.tagline}</p>
      <div class="divider"><span></span>✦<span></span></div>
      <a class="btn" href="#contact">${c.t.reserveTable}</a>
    </div>
  </header>`;

const heroClinical: HeroBuilder = (c) => `
  <header class="hero">
    <div class="dots" aria-hidden="true"></div>
    <div class="wrap hero-inner">
      <div class="hero-main">
        <span class="eyebrow">${c.label} · ${c.eyebrow}</span>
        <h1>${c.name}</h1>
        <p class="lede">${c.tagline}</p>
        <div class="cta-row">
          <a class="btn" href="#contact">${c.t.bookOnline}</a>
          <a class="btn-ghost" href="#services">${c.t.ourServices}</a>
        </div>
        <div class="trust">
          ${c.rating ? `<span class="tchip">${c.t.ratedChip(c.rating)}</span>` : ""}
          <span class="tchip">${c.t.onlineBooking}</span>
          <span class="tchip">${c.t.newPatients}</span>
        </div>
      </div>
      <aside class="info-card">
        <h3>${c.t.visitUs}</h3>
        ${c.area ? `<div class="info-row"><span>${c.t.area}</span><b>${c.area}</b></div>` : ""}
        ${c.phone ? `<div class="info-row"><span>${c.t.phone}</span><b>${c.phone}</b></div>` : ""}
        ${c.rating ? `<div class="info-row"><span>${c.t.rating}</span><b>${c.rating} ★ (${c.reviewCount})</b></div>` : ""}
        ${
          c.hours.length
            ? `<div class="info-hours"><span>${c.t.hours}</span><ul>${c.hours.map((h) => `<li>${h}</li>`).join("")}</ul></div>`
            : `<div class="info-row"><span>${c.t.hours}</span><b>${c.t.byAppointment}</b></div>`
        }
        <a class="btn full" href="#contact">${c.t.requestAppointment}</a>
      </aside>
    </div>
  </header>`;

const HERO_BUILDERS: Record<Layout, HeroBuilder> = {
  bold: heroBold,
  editorial: heroEditorial,
  warm: heroWarm,
  clinical: heroClinical,
};

// ── Shared lower sections (deployed/scrolled view; not in the hero shot) ────

function gallerySection(c: Ctx): string {
  if (!c.gallery.length) return "";
  return `
  <section class="gallery"><div class="wrap">
    <div class="section-head reveal"><span class="overline">${c.t.galleryOverline}</span><h2>${c.t.aLookInside}</h2></div>
    <div class="gal-grid">
      ${c.gallery
        .map((img, i) => `<div class="gal-item reveal d${(i % 3) + 1}" style="background-image:url('${img}')"></div>`)
        .join("\n      ")}
    </div>
  </div></section>`;
}

function sections(c: Ctx): string {
  return `
  ${gallerySection(c)}
  <section id="services"><div class="wrap">
    <div class="section-head reveal"><span class="overline">${c.t.whatWeDo}</span>
      <h2>${c.t.everythingDoneWithCare}</h2></div>
    <div class="grid">
      ${c.services
        .map(
          (s, i) =>
            `<div class="card reveal d${(i % 3) + 1}"><span class="card-n">0${i + 1}</span><h3>${esc(s.title)}</h3><p>${esc(s.blurb)}</p></div>`,
        )
        .join("\n      ")}
    </div>
  </div></section>

  <section id="about" class="about"><div class="wrap">
    <div class="section-head reveal"><span class="overline">${c.t.aboutOverline}</span><h2>${c.name}</h2></div>
    <p class="lead-copy reveal">${c.t.aboutCopy(c.area, c.label, c.reviewCount)}</p>
  </div></section>

  ${
    c.testimonials.length
      ? `<section id="reviews"><div class="wrap">
    <div class="section-head reveal"><span class="overline">${c.t.reviewsOverline}</span><h2>${c.t.inTheirWords}</h2></div>
    <div class="quotes">
      ${c.testimonials
        .map((t, i) => `<figure class="quote reveal d${(i % 3) + 1}"><div class="stars">★★★★★</div><blockquote>“${t}”</blockquote></figure>`)
        .join("\n      ")}
    </div>
  </div></section>`
      : ""
  }

  <section id="contact" class="contact"><div class="wrap reveal">
    <h2>${c.t.comeSayHello}</h2>
    <div class="contact-grid">
      <div class="contact-info">
        <div class="info">
          ${c.address ? `${c.address}<br/>` : ""}${c.phone ?? ""}
        </div>
        ${
          c.hours.length
            ? `<div class="hours-list"><span class="hours-k">${c.t.hours}</span><ul>${c.hours.map((h) => `<li>${h}</li>`).join("")}</ul></div>`
            : ""
        }
        ${c.phone ? `<a class="btn" href="tel:${c.phone}">${c.t.call(c.name)}</a>` : `<a class="btn" href="#">${c.t.getInTouch}</a>`}
      </div>
      ${c.mapImg ? `<div class="contact-map"><img src="${c.mapImg}" alt="${c.t.foundIn} ${c.area ?? ""}" loading="lazy" /></div>` : ""}
    </div>
  </div></section>

  <footer>${c.t.footer(c.name, new Date().getFullYear())}</footer>`;
}

// Reveal-on-scroll: progressive enhancement. With no JS (or reduced motion) the
// `.reveal` elements are fully visible (their hidden state only exists inside the
// no-preference media query), so content never depends on this running.
function revealScript(): string {
  return `<script>
(function(){
  // Solidify the sticky nav once scrolled off the hero (always — independent of
  // motion preference), so it never sits as light-on-light over lower sections.
  function syncNav(){
    if (window.scrollY > 64) document.body.classList.add('nav-solid');
    else document.body.classList.remove('nav-solid');
  }
  syncNav();
  window.addEventListener('scroll', syncNav, { passive: true });

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var els = document.querySelectorAll('.reveal');
  if (reduce || !('IntersectionObserver' in window)) {
    for (var i = 0; i < els.length; i++) els[i].classList.add('in');
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  els.forEach(function (el) { io.observe(el); });
})();
</script>`;
}

// ── Stylesheet ─────────────────────────────────────────────────────────────

// Inline SVG grain, used as a tiling overlay for texture on the hero.
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

function buildCss(t: Theme, accent: string): string {
  return `
  :root{
    --bg:${t.bg}; --surface:${t.surface}; --surface2:${t.surface2};
    --text:${t.text}; --muted:${t.muted}; --border:${t.border};
    --accent:${accent}; --accent-text:${t.accentText};
    --hero-bg:${t.heroBg}; --hero-text:${t.heroText}; --mesh2:${t.heroMesh2};
    --nav-h:74px; --heading:${t.headingFont}; --body:${t.bodyFont};
  }
  *{margin:0;padding:0;box-sizing:border-box;}
  html{scroll-behavior:smooth;}
  body{font-family:var(--body);background:var(--bg);color:var(--text);line-height:1.6;-webkit-font-smoothing:antialiased;}
  h1,h2,h3{font-family:var(--heading);line-height:1.04;font-weight:700;letter-spacing:-0.01em;}
  .wrap{max-width:1140px;margin:0 auto;padding:0 32px;}
  a{color:inherit;text-decoration:none;}

  /* buttons */
  .btn{display:inline-block;background:var(--accent);color:var(--accent-text);padding:15px 30px;border-radius:999px;font-family:var(--body);font-weight:600;font-size:15px;box-shadow:0 10px 30px -10px color-mix(in srgb,var(--accent) 70%,transparent);transition:transform .2s;}
  .btn.full{display:block;text-align:center;margin-top:18px;}
  .btn-ghost{display:inline-flex;align-items:center;padding:15px 8px;font-weight:600;font-size:15px;color:var(--hero-text);opacity:.82;}
  .navcta{padding:9px 20px;border:1px solid color-mix(in srgb,var(--text) 22%,transparent);border-radius:999px;}

  /* nav */
  nav{position:sticky;top:0;z-index:20;height:var(--nav-h);display:flex;align-items:center;background:color-mix(in srgb,var(--hero-bg) 86%,transparent);backdrop-filter:saturate(160%) blur(10px);border-bottom:1px solid color-mix(in srgb,var(--hero-text) 9%,transparent);}
  nav .wrap{display:flex;align-items:center;justify-content:space-between;width:100%;}
  .brand{font-family:var(--heading);font-weight:700;font-size:21px;color:var(--hero-text);letter-spacing:-0.02em;}
  .navlinks{display:flex;align-items:center;gap:26px;}
  .navlinks a{color:color-mix(in srgb,var(--hero-text) 66%,transparent);font-size:13px;font-weight:500;letter-spacing:.02em;}
  .navlinks a.navcta{color:var(--hero-text);}

  /* hero shell */
  .hero{position:relative;overflow:hidden;background:var(--hero-bg);color:var(--hero-text);min-height:calc(100vh - var(--nav-h));display:flex;align-items:center;}
  .hero::after{content:"";position:absolute;inset:0;background-image:${GRAIN};opacity:.05;mix-blend-mode:overlay;pointer-events:none;}
  .hero .eyebrow,.hero .kicker{display:inline-block;text-transform:uppercase;letter-spacing:.2em;font-size:12px;font-weight:600;color:color-mix(in srgb,var(--hero-text) 64%,transparent);}
  .hero h1{color:var(--hero-text);}
  .hero .lede{color:color-mix(in srgb,var(--hero-text) 84%,transparent);}
  .ghost{position:absolute;font-family:var(--heading);font-weight:800;line-height:.7;color:color-mix(in srgb,var(--hero-text) 6%,transparent);font-size:62vh;z-index:0;pointer-events:none;user-select:none;}
  .hero-inner{position:relative;z-index:2;width:100%;}

  /* mesh / glow / dots backgrounds */
  .mesh{position:absolute;inset:-20%;z-index:0;background:
    radial-gradient(40% 50% at 22% 28%,color-mix(in srgb,var(--accent) 55%,transparent),transparent 70%),
    radial-gradient(45% 55% at 82% 18%,color-mix(in srgb,var(--mesh2) 75%,transparent),transparent 72%),
    radial-gradient(60% 60% at 70% 92%,color-mix(in srgb,var(--accent) 26%,transparent),transparent 75%);
    filter:blur(8px);}
  .glow{position:absolute;inset:0;z-index:0;background:
    radial-gradient(46% 52% at 50% 40%,color-mix(in srgb,var(--accent) 32%,transparent),transparent 70%),
    radial-gradient(40% 40% at 78% 80%,color-mix(in srgb,var(--mesh2) 60%,transparent),transparent 72%);}
  .dots{position:absolute;inset:0;z-index:0;opacity:.5;background-image:radial-gradient(color-mix(in srgb,var(--text) 12%,transparent) 1.3px,transparent 1.3px);background-size:26px 26px;-webkit-mask-image:linear-gradient(120deg,#000,transparent 72%);mask-image:linear-gradient(120deg,#000,transparent 72%);}

  /* seed-driven mesh repositioning so same-category previews differ */
  .seed-b .mesh{background-position:60% 10%,10% 70%,90% 40%;}
  .seed-c .mesh{transform:scaleX(-1);}
  .seed-b .ghost{right:-6vw;bottom:-12vh;}
  .seed-a .ghost{left:-4vw;bottom:-14vh;}
  .seed-c .ghost{right:-2vw;top:-10vh;}

  /* BOLD layout */
  .layout-bold .hero h1{font-size:clamp(50px,8.4vw,116px);margin:20px 0 18px;max-width:14ch;}
  .layout-bold .lede{font-size:clamp(18px,2vw,23px);max-width:46ch;}
  .layout-bold.seed-b .hero-inner{text-align:center;margin:0 auto;}
  .layout-bold.seed-b .lede{margin-left:auto;margin-right:auto;}
  .cta-row{display:flex;align-items:center;gap:18px;margin-top:34px;flex-wrap:wrap;}
  .layout-bold.seed-b .cta-row{justify-content:center;}
  .statbar{display:flex;gap:40px;margin-top:52px;flex-wrap:wrap;}
  .layout-bold.seed-b .statbar{justify-content:center;}
  .stat{display:flex;flex-direction:column;gap:2px;}
  .stat b{font-family:var(--heading);font-size:26px;color:var(--hero-text);}
  .stat span{font-size:13px;color:color-mix(in srgb,var(--hero-text) 60%,transparent);}

  /* EDITORIAL layout */
  .layout-editorial .hero-inner{display:grid;grid-template-columns:1.62fr .92fr;gap:56px;align-items:center;}
  .layout-editorial .kicker{margin-bottom:22px;}
  .layout-editorial .hero h1{font-size:clamp(48px,7.6vw,104px);font-weight:600;letter-spacing:-0.02em;}
  .layout-editorial .rule{height:1px;width:84px;background:var(--accent);margin:26px 0;}
  .layout-editorial .lede{font-size:clamp(18px,1.9vw,22px);max-width:34ch;margin-bottom:32px;font-style:italic;color:color-mix(in srgb,var(--hero-text) 76%,transparent);}
  .hero-meta{border-left:1px solid color-mix(in srgb,var(--hero-text) 14%,transparent);padding-left:30px;display:flex;flex-direction:column;gap:20px;}
  .meta-row{display:flex;flex-direction:column;gap:3px;}
  .meta-k{text-transform:uppercase;letter-spacing:.16em;font-size:11px;color:color-mix(in srgb,var(--hero-text) 55%,transparent);}
  .meta-v{font-family:var(--heading);font-size:30px;}
  .layout-editorial.seed-c .hero-inner{grid-template-columns:.92fr 1.62fr;}
  .layout-editorial.seed-c .hero-meta{order:-1;border-left:none;border-right:1px solid color-mix(in srgb,var(--hero-text) 14%,transparent);padding-left:0;padding-right:30px;text-align:right;}

  /* WARM layout */
  .layout-warm .hero-inner{max-width:780px;margin:0 auto;text-align:center;}
  .layout-warm .hero h1{font-size:clamp(52px,8vw,108px);font-weight:400;margin:18px 0 20px;}
  .layout-warm .lede{font-size:clamp(19px,2vw,24px);max-width:40ch;margin:0 auto;}
  .chip{display:inline-flex;align-items:center;gap:8px;padding:8px 18px;border:1px solid color-mix(in srgb,var(--hero-text) 20%,transparent);border-radius:999px;font-size:13px;font-weight:600;color:color-mix(in srgb,var(--hero-text) 80%,transparent);}
  .chip .stars{color:var(--accent);}
  .divider{display:flex;align-items:center;justify-content:center;gap:16px;color:var(--accent);margin:30px 0;}
  .divider span{height:1px;width:70px;background:color-mix(in srgb,var(--hero-text) 24%,transparent);}

  /* CLINICAL layout */
  .layout-clinical .hero-inner{display:grid;grid-template-columns:1.25fr .85fr;gap:56px;align-items:center;}
  .layout-clinical .hero h1{font-size:clamp(44px,6.6vw,86px);margin:16px 0 18px;}
  .layout-clinical .lede{font-size:clamp(18px,1.9vw,22px);max-width:40ch;}
  .trust{display:flex;gap:12px;margin-top:30px;flex-wrap:wrap;}
  .tchip{padding:9px 16px;background:color-mix(in srgb,var(--accent) 12%,transparent);color:color-mix(in srgb,var(--hero-text) 88%,transparent);border-radius:10px;font-size:13px;font-weight:600;}
  .info-card{background:var(--surface);color:var(--text);border:1px solid var(--border);border-radius:22px;padding:32px;box-shadow:0 30px 60px -28px color-mix(in srgb,#000 60%,transparent);}
  .info-card h3{font-size:22px;margin-bottom:18px;}
  .info-row{display:flex;justify-content:space-between;gap:16px;padding:11px 0;border-bottom:1px solid var(--border);font-size:14px;}
  .info-row span{color:var(--muted);}
  .info-row b{font-weight:600;text-align:right;}
  .layout-clinical.seed-c .hero-inner{grid-template-columns:.85fr 1.25fr;}
  .layout-clinical.seed-c .info-card{order:-1;}

  /* lower sections */
  section{padding:96px 0;}
  .section-head{max-width:620px;margin:0 auto 52px;text-align:center;}
  .overline{display:inline-block;text-transform:uppercase;letter-spacing:.2em;font-size:12px;font-weight:600;color:var(--accent);margin-bottom:14px;}
  .section-head h2{font-size:clamp(30px,4.4vw,46px);}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;}
  .card{position:relative;background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:34px;overflow:hidden;}
  .card-n{font-family:var(--heading);font-size:14px;color:var(--accent);font-weight:700;}
  .card h3{font-size:22px;margin:10px 0 8px;}
  .card p{color:var(--muted);}
  .about{background:var(--surface2);}
  .about .wrap{max-width:760px;text-align:center;}
  .lead-copy{font-size:clamp(20px,2.4vw,26px);font-family:var(--heading);font-weight:400;line-height:1.35;color:var(--text);}
  .quotes{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:24px;}
  .quote{background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:32px;}
  .quote .stars{color:var(--accent);letter-spacing:3px;margin-bottom:14px;}
  .quote blockquote{font-size:18px;line-height:1.5;}
  .contact{background:var(--hero-bg);color:var(--hero-text);text-align:center;}
  .contact h2{color:var(--hero-text);font-size:clamp(32px,4.6vw,52px);}
  .contact .info{margin:22px 0 4px;font-size:18px;color:color-mix(in srgb,var(--hero-text) 84%,transparent);}
  .contact-grid{display:grid;grid-template-columns:1fr;gap:32px;align-items:center;justify-items:center;max-width:560px;margin:24px auto 0;}
  .contact-grid:has(.contact-map){grid-template-columns:1fr 1fr;max-width:960px;justify-items:stretch;text-align:left;}
  .contact-info{display:flex;flex-direction:column;align-items:center;gap:20px;}
  .contact-grid:has(.contact-map) .contact-info{align-items:flex-start;}
  .hours-list .hours-k{display:block;text-transform:uppercase;letter-spacing:.18em;font-size:11px;opacity:.6;margin-bottom:8px;}
  .hours-list ul{list-style:none;display:flex;flex-direction:column;gap:4px;font-size:14px;color:color-mix(in srgb,var(--hero-text) 80%,transparent);}
  .contact-map img{display:block;width:100%;height:100%;min-height:260px;object-fit:cover;border-radius:18px;border:1px solid color-mix(in srgb,var(--hero-text) 16%,transparent);box-shadow:0 30px 60px -30px rgba(0,0,0,.55);}
  /* real opening hours inside the clinical hero info-card */
  .info-hours{padding:11px 0;border-bottom:1px solid var(--border);font-size:13px;}
  .info-hours>span{display:block;color:var(--muted);margin-bottom:6px;}
  .info-hours ul{list-style:none;display:flex;flex-direction:column;gap:3px;}
  .info-hours li{color:var(--text);}
  footer{padding:40px 0;text-align:center;color:var(--muted);font-size:13px;}

  /* PHOTO hero — dark scrim + white text for legibility over any image.
     The hero is pulled up under the sticky nav (negative margin) so the photo
     fills the whole band and the transparent white-text nav sits OVER the image,
     not over the light page background above it. */
  .has-photo .hero{background:#0b0c0e;min-height:100vh;margin-top:calc(-1 * var(--nav-h));}
  .hero-bg{position:absolute;inset:0;z-index:0;background-size:cover;background-position:center;transform:scale(1.03);}
  .scrim{position:absolute;inset:0;z-index:1;background:
    linear-gradient(180deg,rgba(8,9,11,.40) 0%,rgba(8,9,11,.18) 38%,rgba(8,9,11,.92) 100%),
    radial-gradient(80% 70% at 18% 92%,color-mix(in srgb,var(--accent) 32%,transparent),transparent 70%);}
  .seed-b .scrim{background:linear-gradient(75deg,rgba(8,9,11,.92) 0%,rgba(8,9,11,.42) 52%,rgba(8,9,11,.12) 100%),radial-gradient(70% 80% at 100% 0%,color-mix(in srgb,var(--accent) 30%,transparent),transparent 68%);}
  .seed-c .scrim{background:linear-gradient(285deg,rgba(8,9,11,.92) 0%,rgba(8,9,11,.42) 52%,rgba(8,9,11,.12) 100%);}
  .has-photo .hero-inner{align-self:flex-end;padding-bottom:8vh;max-width:880px;}
  .has-photo.seed-b .hero-inner{align-self:center;}
  .has-photo .eyebrow{color:color-mix(in srgb,var(--accent) 88%,#fff);}
  .has-photo .hero h1{color:#fff;font-size:clamp(48px,7.6vw,104px);margin:16px 0 16px;text-shadow:0 2px 30px rgba(0,0,0,.35);}
  .has-photo .lede{color:rgba(255,255,255,.9);font-size:clamp(18px,2vw,24px);max-width:48ch;}
  .has-photo .chip{border-color:rgba(255,255,255,.4);color:#fff;}
  .has-photo nav{background:transparent;border-bottom:1px solid rgba(255,255,255,.14);}
  .has-photo .brand,.has-photo .navlinks a.navcta{color:#fff;}
  .has-photo .navlinks a{color:rgba(255,255,255,.72);}
  /* keep nav text legible over a bright photo (until the solid state kicks in) */
  body.has-photo:not(.nav-solid) .brand,
  body.has-photo:not(.nav-solid) .navlinks a{text-shadow:0 1px 14px rgba(0,0,0,.5);}

  /* Scrolled nav: once you leave the hero, the sticky bar gains a solid,
     theme-correct background + dark-on-light text. Without this a transparent
     white-text photo-hero nav (or a hero-tinted nav) sits invisibly over the
     light lower sections. Toggled by the inline script (body.nav-solid); these
     rules outrank the .has-photo nav rules above on specificity. */
  nav{transition:background .25s ease,border-color .25s ease,backdrop-filter .25s ease;}
  .brand,.navlinks a{transition:color .25s ease;}
  body.nav-solid nav{background:color-mix(in srgb,var(--bg) 90%,transparent);border-bottom:1px solid var(--border);}
  body.nav-solid .brand{color:var(--text);}
  body.nav-solid .navlinks a{color:var(--muted);}
  body.nav-solid .navlinks a.navcta{color:var(--text);border-color:color-mix(in srgb,var(--text) 24%,transparent);}

  /* gallery of real photos */
  .gallery{background:var(--surface2);}
  .gal-grid{display:grid;grid-template-columns:repeat(4,1fr);grid-auto-rows:200px;gap:16px;}
  .gal-item{background-size:cover;background-position:center;border-radius:16px;border:1px solid var(--border);}
  .gal-item:first-child{grid-column:span 2;grid-row:span 2;}

  /* ── Motion ──────────────────────────────────────────────────────────────
     All entrance/scroll motion lives behind no-preference so it NEVER affects
     the static hero screenshot (render.ts emulates prefers-reduced-motion:reduce,
     leaving every element at its settled, fully-visible state). The live preview
     iframe runs a normal browser, so it sees the full choreography. */
  @media(prefers-reduced-motion:no-preference){
    @keyframes heroRise{from{opacity:0;transform:translateY(28px);}to{opacity:1;transform:none;}}
    @keyframes kenburns{from{transform:scale(1.04);}to{transform:scale(1.13);}}

    nav{animation:heroRise .6s both cubic-bezier(.2,.75,.25,1);}
    .hero-inner .eyebrow,.hero-inner .kicker,.hero-inner h1,.hero-inner .lede,
    .hero-inner .rule,.hero-inner .divider,.hero-inner .chip,.hero-inner .cta-row,
    .hero-inner .btn,.hero-inner .statbar,.hero-inner .trust,
    .hero-inner .hero-meta,.hero-inner .info-card{
      animation:heroRise .85s both cubic-bezier(.2,.75,.25,1);}
    .hero-inner h1{animation-delay:.12s;}
    .hero-inner .rule,.hero-inner .divider{animation-delay:.2s;}
    .hero-inner .lede{animation-delay:.24s;}
    .hero-inner .hero-meta,.hero-inner .info-card{animation-delay:.3s;}
    .hero-inner .cta-row,.hero-inner .btn,.hero-inner .chip{animation-delay:.36s;}
    .hero-inner .statbar,.hero-inner .trust{animation-delay:.46s;}
    /* slow, infinite Ken-Burns drift on the real photo hero */
    .hero-bg{animation:kenburns 22s ease-in-out infinite alternate;transform-origin:60% 40%;}

    /* scroll-reveal for the lower sections (toggled by the inline observer) */
    .reveal{opacity:0;transform:translateY(26px);
      transition:opacity .8s cubic-bezier(.2,.7,.2,1),transform .8s cubic-bezier(.2,.7,.2,1);}
    .reveal.in{opacity:1;transform:none;}
    .reveal.d1{transition-delay:.08s;}
    .reveal.d2{transition-delay:.16s;}
    .reveal.d3{transition-delay:.24s;}
    .btn{transition:transform .2s,box-shadow .2s;}
    .btn:hover{transform:translateY(-2px);}
    .card{transition:transform .25s,box-shadow .25s,border-color .25s;}
    .card:hover{transform:translateY(-4px);box-shadow:0 24px 50px -30px color-mix(in srgb,#000 70%,transparent);border-color:color-mix(in srgb,var(--accent) 40%,var(--border));}
    .gal-item{transition:transform .4s cubic-bezier(.2,.7,.2,1);}
    .gal-item:hover{transform:scale(1.02);}
  }

  @media(max-width:880px){
    .gal-grid{grid-template-columns:repeat(2,1fr);}
    .gal-item:first-child{grid-column:span 2;}
    .hero-inner,.layout-editorial .hero-inner,.layout-clinical .hero-inner{grid-template-columns:1fr!important;}
    .hero-meta{border-left:none;padding-left:0;}
    .grid{grid-template-columns:1fr;}.navlinks{display:none;}
    .contact-grid:has(.contact-map){grid-template-columns:1fr;text-align:center;}
    .contact-grid:has(.contact-map) .contact-info{align-items:center;}
  }`;
}
