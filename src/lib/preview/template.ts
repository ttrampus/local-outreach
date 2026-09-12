// Build a distinctive, mobile-responsive single-page site from data we already
// have (name, category, reviews, address). One self-contained HTML string with
// inline CSS — ready to screenshot or deploy. The HERO is the artifact that ends
// up in outreach (render.ts screenshots above-the-fold), so each LAYOUT archetype
// gives the hero a genuinely different composition, and a per-business seed varies
// alignment / mesh / accent so a whole sweep of one category never looks cloned.
import type { NormalizedPlaceDetails } from "@/lib/leadSource/types";
import { pickTheme, GOOGLE_FONTS_HREF, type Theme } from "./theme";
import { DESIGNS, type DesignId } from "./designs";
import { detectLocale, getStrings, type Locale, type LocaleStrings } from "./i18n";
import { cleanDisplayName } from "./brand";
import { paletteFor, pickAxis, readableOn, type Palette } from "./designTokens";
import { CONTACT_FORM_TOKEN } from "./contactForm";

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

/**
 * The town or city from a Google formatted address, for copy like "in Ljubljana".
 *
 * This used to take the FIRST comma-part, which is the street line — so every
 * page read "we proudly serve Rimska cesta 14 and the surrounding area" and
 * printed a street address in the eyebrow where a place name belongs. Google
 * formats as "street, POSTCODE City, Country", so the locality is the part
 * before the country, minus its postcode.
 */
/** Capitalise the first letter, leaving the rest of the string alone. */
function sentenceCase(s: string): string {
  return s ? s.charAt(0).toLocaleUpperCase() + s.slice(1) : s;
}

function locality(address?: string): string | null {
  if (!address) return null;
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const city = (parts.length >= 3 ? parts[parts.length - 2] : parts[1])
    .replace(/^\d[\d\s-]*/, "") // drop a leading postcode
    .trim();
  return city && city.length <= 40 ? city : null;
}

/**
 * Hero archetypes. Every one of these renders BOTH with and without a photo —
 * previously a single `heroPhoto` builder pre-empted all of them whenever the
 * business had photography, which is nearly always, so the four archetypes only
 * ever rendered for photo-less businesses and every real template site came out
 * as the same dark-scrim photo hero.
 */
export type Archetype =
  | "bold"
  | "editorial"
  | "warm"
  | "clinical"
  | "bleed"
  | "frame"
  | "horizon";

const ARCHETYPES: Archetype[] = [
  "bold",
  "editorial",
  "warm",
  "clinical",
  "bleed",
  "frame",
  "horizon",
];

export interface Ctx {
  theme: Theme;
  palette: Palette;
  archetype: Archetype;
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
  variant = 0,
  // Optional per-business copy/layout overrides from the "spec" engine. Every
  // field is independently optional: whatever is absent keeps the deterministic
  // default, so a partial spec degrades instead of breaking the page.
  spec?: {
    eyebrow?: string;
    tagline?: string;
    services?: { title: string; blurb: string }[];
  },
  // Opt into a full-page design by id. Omitted → the legacy hero archetypes.
  designId?: DesignId,
): string {
  const theme = pickTheme(place.categories, searchHint);
  const locale: Locale = detectLocale(place);
  const t = getStrings(locale);
  const seedKey = `${place.placeId || place.name}${variant > 0 ? `#${variant}` : ""}`;
  const seed = seedFrom(seedKey);
  // Ground colour comes from the category's palette allow-list rather than the
  // theme's single hard-coded palette, so two salons in one sweep differ.
  const palette = paletteFor(theme.palettes, seedKey);
  const archetype = pickAxis(ARCHETYPES, seedKey, "archetype");
  const accent = palette.accent;
  const area = locality(place.address);
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
    palette,
    archetype,
    t,
    seed,
    accent,
    name,
    rawName,
    label,
    area: area ? esc(area) : null,
    // The canned taglines interpolate `label`, which is lowercase ("salon") so it
    // reads correctly mid-sentence — at the start of one it needs a capital.
    tagline: esc(sentenceCase(spec?.tagline ?? pick(t.taglines, seed, 1)(label, area))),
    eyebrow: esc(spec?.eyebrow ?? area ?? pick(t.eyebrows, seed, 2)),
    ratingLine: ratingLine ? esc(ratingLine) : null,
    rating: place.rating ? place.rating.toFixed(1) : null,
    reviewCount: place.reviewCount,
    monogram: esc((rawName.trim()[0] ?? "•").toUpperCase()),
    services: spec?.services?.length
      ? spec.services.map((s) => ({ title: esc(s.title), blurb: esc(s.blurb) }))
      : services,
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

  // A full-page Design owns the whole body and brings its own CSS; the legacy
  // archetypes only vary the hero and share one body. Both still run through the
  // same token/reset base, so palettes and fonts behave identically either way.
  const design = designId ? DESIGNS[designId] : undefined;
  const body = design
    ? design.body(ctx)
    : `${nav(ctx)}
  ${HERO_BUILDERS[archetype](ctx)}
  ${sections(ctx)}`;

  return `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${name}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="${GOOGLE_FONTS_HREF}" />
<style>${buildCss(theme, palette, seedKey)}${design ? design.css() : ""}</style>
</head>
<body class="${design ? `design-${design.id}` : `layout-${archetype}`} ${seedClass} pal-${palette.mode}${photoClass}">
  ${body}
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

// ── Hero builders (one per archetype) ──────────────────────────────────────
//
// Each builder renders with OR without a photo. The old code short-circuited to
// a single image-led hero whenever photos existed, which made the archetypes
// dead code for virtually every real lead.

type HeroBuilder = (c: Ctx) => string;

/** Rating chip + CTA pair, shared by most archetypes. */
function ctaRow(c: Ctx, label = c.t.bookNow): string {
  return `<div class="cta-row">
      <a class="btn" href="#contact">${label}</a>
      ${c.rating ? ratingChip(c) : ""}
    </div>`;
}

/** BOLD — oversized type, stat bar, and (with a photo) a wide band beneath. */
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
      ${
        c.heroImg
          ? `<div class="band" style="background-image:url('${c.heroImg}')"></div>`
          : `<div class="statbar">
        ${c.rating ? `<div class="stat"><b>${c.rating}★</b><span>${c.reviewCount} ${c.t.reviewsWord}</span></div>` : ""}
        <div class="stat"><b>${c.t.local}</b><span>${c.area ?? c.t.independent}</span></div>
        <div class="stat"><b>${c.t.sameDay}</b><span>${c.t.fastResponse}</span></div>
      </div>`
      }
    </div>
  </header>`;

/** EDITORIAL — asymmetric grid; the photo becomes a tall third column. */
const heroEditorial: HeroBuilder = (c) => `
  <header class="hero">
    <span class="ghost" aria-hidden="true">${c.monogram}</span>
    <div class="wrap hero-inner${c.heroImg ? " has-col" : ""}">
      <div class="hero-main">
        <span class="kicker">${c.eyebrow} — ${c.label}</span>
        <h1>${c.name}</h1>
        <div class="rule"></div>
        <p class="lede">${c.tagline}</p>
        <a class="btn" href="#contact">${c.t.makeBooking}</a>
      </div>
      ${c.heroImg ? `<div class="hero-col" style="background-image:url('${c.heroImg}')"></div>` : ""}
      <aside class="hero-meta">
        ${c.rating ? `<div class="meta-row"><span class="meta-k">${c.t.rated}</span><span class="meta-v">${c.rating} ★</span></div>` : ""}
        ${c.reviewCount ? `<div class="meta-row"><span class="meta-k">${c.t.reviews}</span><span class="meta-v">${c.reviewCount}</span></div>` : ""}
        ${c.area ? `<div class="meta-row"><span class="meta-k">${c.t.foundIn}</span><span class="meta-v">${c.area}</span></div>` : ""}
        <div class="meta-row"><span class="meta-k">${c.t.booking}</span><span class="meta-v">${c.t.open}</span></div>
      </aside>
    </div>
  </header>`;

/** WARM — centred and symmetrical; the photo sits above as an arched panel. */
const heroWarm: HeroBuilder = (c) => `
  <header class="hero">
    <div class="glow"></div>
    <div class="wrap hero-inner">
      ${c.heroImg ? `<div class="arch" style="background-image:url('${c.heroImg}')"></div>` : ""}
      ${ratingChip(c)}
      <h1>${c.name}</h1>
      <p class="lede">${c.tagline}</p>
      <div class="divider"><span></span>✦<span></span></div>
      <a class="btn" href="#contact">${c.theme.key === "cafe" ? c.t.reserveTable : c.t.bookNow}</a>
    </div>
  </header>`;

/** CLINICAL — practical info card; the photo fills the opposite column. */
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
        ${
          c.heroImg
            ? `<div class="inline-photo" style="background-image:url('${c.heroImg}')"></div>`
            : `<div class="trust">
          ${c.rating ? `<span class="tchip">${c.t.ratedChip(c.rating)}</span>` : ""}
          <span class="tchip">${c.t.onlineBooking}</span>
          <span class="tchip">${c.t.newPatients}</span>
        </div>`
        }
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

/** BLEED — full-bleed image (or mesh field) with the copy anchored bottom-left. */
const heroBleed: HeroBuilder = (c) => `
  <header class="hero">
    ${
      c.heroImg
        ? `<div class="hero-bg" style="background-image:url('${c.heroImg}')"></div><div class="scrim"></div>`
        : `<div class="mesh"></div>`
    }
    <div class="wrap hero-inner">
      <span class="eyebrow">${c.label.toUpperCase()} · ${c.eyebrow}</span>
      <h1>${c.name}</h1>
      <p class="lede">${c.tagline}</p>
      ${ctaRow(c)}
    </div>
  </header>`;

/** FRAME — everything inset behind a wide margin; the photo is a soft panel. */
const heroFrame: HeroBuilder = (c) => `
  <header class="hero">
    <div class="frame">
      <div class="frame-inner">
        <span class="kicker">${c.label.toUpperCase()} · ${c.eyebrow}</span>
        <h1>${c.name}</h1>
        <p class="lede">${c.tagline}</p>
        ${ctaRow(c)}
        ${c.heroImg ? `<div class="panel" style="background-image:url('${c.heroImg}')"></div>` : ""}
      </div>
    </div>
  </header>`;

/** HORIZON — one hard horizontal edge: type above, photograph below. */
const heroHorizon: HeroBuilder = (c) => `
  <header class="hero">
    <div class="horizon-top">
      <div class="wrap hero-inner">
        <span class="eyebrow">${c.label.toUpperCase()} · ${c.eyebrow}</span>
        <h1>${c.name}</h1>
        <p class="lede">${c.tagline}</p>
        ${ctaRow(c)}
      </div>
    </div>
    <div class="horizon-bottom"${c.heroImg ? ` style="background-image:url('${c.heroImg}')"` : ""}></div>
  </header>`;

const HERO_BUILDERS: Record<Archetype, HeroBuilder> = {
  bold: heroBold,
  editorial: heroEditorial,
  warm: heroWarm,
  clinical: heroClinical,
  bleed: heroBleed,
  frame: heroFrame,
  horizon: heroHorizon,
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
    ${CONTACT_FORM_TOKEN}
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

  // Gallery parallax — a small counter-drift as tiles pass through the viewport.
  // transform only (never layout), rAF-throttled, and skipped entirely under
  // reduced motion so the screenshot is unaffected.
  var par = document.querySelectorAll('.gal-item');
  if (!par.length) return;
  var ticking = false;
  function drift() {
    ticking = false;
    var vh = window.innerHeight || 1;
    for (var i = 0; i < par.length; i++) {
      var r = par[i].getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) continue;
      var progress = (r.top + r.height / 2) / vh - 0.5; // -0.5 .. 0.5
      par[i].style.transform = 'translateY(' + (progress * -18).toFixed(2) + 'px)';
    }
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; window.requestAnimationFrame(drift); }
  }, { passive: true });
  drift();
})();

// ── Mobile navigation ──────────────────────────────────────────────────────
// Every archetype and every Design hides its nav links below its own collapse
// point, which left phone visitors with no navigation at all. This gives the
// links back as a sheet.
//
// It is deliberately breakpoint-free: it asks the DOM whether the page's own nav
// links are currently visible. The designs collapse at 820–900px and each of
// those points was chosen for that layout, so a constant here would either show
// a burger beside visible links or hide the nav on a width that still fits it.
(function () {
  var nav = document.querySelector('nav');
  if (!nav) return;
  /* Section links only. The wordmark ("#top") is the logo: it stays visible at
     every width, so counting it as navigation would make the visibility probe
     below conclude the nav had not collapsed. */
  var links = [].slice.call(nav.querySelectorAll('a[href^="#"]')).filter(function (a) {
    var h = a.getAttribute('href');
    return h !== '#' && h !== '#top' && h !== '#main';
  });
  if (links.length < 2) return;

  var sheet = document.createElement('div');
  sheet.className = 'lo-navsheet';
  sheet.id = 'lo-navsheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  links.forEach(function (a) {
    var c = a.cloneNode(true);
    c.removeAttribute('class');
    sheet.appendChild(c);
  });
  var tel = document.querySelector('a[href^="tel:"]');
  if (tel) {
    var t = tel.cloneNode(true);
    t.removeAttribute('class');
    t.className = 'lo-navsheet-tel';
    sheet.appendChild(t);
  }

  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'lo-navtoggle';
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-controls', 'lo-navsheet');
  btn.setAttribute('aria-label', 'Menu');
  btn.appendChild(document.createElement('span'));

  /* Several designs wrap their nav row in an inner element that carries the
     max-width and the flex layout (.at-nav-in, .no-nav-in). Appending to <nav>
     itself would drop the button outside that row, so land it on the wrapper
     when there is exactly one. */
  var host = nav;
  while (host.children.length === 1 && host.firstElementChild.tagName === 'DIV') {
    host = host.firstElementChild;
  }
  host.appendChild(btn);
  document.body.appendChild(sheet);

  function open() {
    sheet.classList.add('is-open');
    btn.setAttribute('aria-expanded', 'true');
    document.documentElement.classList.add('lo-navopen');
  }
  function close() {
    sheet.classList.remove('is-open');
    btn.setAttribute('aria-expanded', 'false');
    document.documentElement.classList.remove('lo-navopen');
  }
  /* The toggle sits inside the nav, below the sheet in paint order, and several
     designs give that nav a backdrop-filter — which makes it the containing
     block for anything fixed inside it, so raising the toggle's z-index would
     not reliably lift it above the sheet. The sheet carries its own close
     button instead. */
  var closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'lo-navsheet-close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.innerHTML = '&times;';
  closeBtn.addEventListener('click', close);
  sheet.insertBefore(closeBtn, sheet.firstChild);

  btn.addEventListener('click', function () {
    sheet.classList.contains('is-open') ? close() : open();
  });
  sheet.addEventListener('click', function (e) { if (e.target.closest('a')) close(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });

  function sync() {
    var visible = links.filter(function (a) {
      return a.offsetParent !== null && a.getBoundingClientRect().width > 0;
    }).length;
    btn.classList.toggle('is-on', visible < 2);
    if (visible >= 2) close();
  }
  sync();
  var nt;
  window.addEventListener('resize', function () { clearTimeout(nt); nt = setTimeout(sync, 120); });
})();
</script>`;
}

// ── Stylesheet ─────────────────────────────────────────────────────────────

// Inline SVG grain, used as a tiling overlay for texture on the hero.
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

/**
 * Texture for the page ground, drawn per business.
 *
 * A flat fill is the single loudest "this is a generated page" signal, and it is
 * the one a prospect notices without knowing why — especially on a dark palette,
 * where an untextured ground reads as an unfinished screen. These are the same
 * treatments the AI brief specifies, written out as real CSS for the deterministic
 * path. All static: render.ts screenshots with reduced motion.
 */
function surfaceCss(seedKey: string): string {
  // Texture colour is mixed from --text, never from --border. On a light palette
  // --border sits a few points off --bg (#F2D6DC on #FDF2F4), so a grid drawn in
  // it is invisible — the texture rendered correctly and still looked like a flat
  // fill. Mixing from the ink gives one alpha that reads on light and dark alike.
  // Alpha is baked into the colour rather than stacked as an `opacity` multiplier,
  // and masks only soften the extremes instead of erasing the middle of the page.
  const ink = (pct: number) => `color-mix(in srgb,var(--text) ${pct}%,transparent)`;
  const treatments: Record<string, string> = {
    "blueprint-grid": `
  body::before{content:"";position:fixed;inset:0;pointer-events:none;z-index:0;
    background-image:linear-gradient(${ink(9)} 1px,transparent 1px),
      linear-gradient(90deg,${ink(9)} 1px,transparent 1px);
    background-size:72px 72px;
    -webkit-mask-image:linear-gradient(180deg,#000 60%,transparent);
    mask-image:linear-gradient(180deg,#000 60%,transparent);}`,
    "dot-matrix": `
  body::before{content:"";position:fixed;inset:0;pointer-events:none;z-index:0;
    background-image:radial-gradient(${ink(16)} 1.4px,transparent 1.4px);
    background-size:26px 26px;
    -webkit-mask-image:linear-gradient(180deg,#000 65%,transparent);
    mask-image:linear-gradient(180deg,#000 65%,transparent);}`,
    "film-grain": `
  body::after{content:"";position:fixed;inset:0;pointer-events:none;z-index:0;opacity:.09;
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");}`,
    // "aurora-mesh" (three soft radial colour blobs) was removed deliberately.
    // It is the single most recognisable "AI-generated site" tell — the same
    // purple/pink smudge behind the headline that every generated landing page
    // has — and it made real businesses' pages look templated. Texture here
    // should come from structure (grids, rules, grain), never from coloured haze.
    "editorial-rule": `
  body::before{content:"";position:fixed;inset:0;pointer-events:none;z-index:0;
    background-image:linear-gradient(90deg,${ink(7)} 1px,transparent 1px);
    background-size:calc(100% / 3) 100%;
    -webkit-mask-image:linear-gradient(180deg,#000 55%,transparent);
    mask-image:linear-gradient(180deg,#000 55%,transparent);}`,
    "hairline-rules": `
  body::before{content:"";position:fixed;inset:0;pointer-events:none;z-index:0;
    background-image:repeating-linear-gradient(180deg,${ink(8)} 0 1px,transparent 1px 96px);
    -webkit-mask-image:linear-gradient(180deg,#000 70%,transparent);
    mask-image:linear-gradient(180deg,#000 70%,transparent);}`,
  };
  const id = pickAxis(Object.keys(treatments), seedKey, "surface");
  // Sections paint their own ground, so they must sit above the fixed texture layer.
  return `${treatments[id]}
  nav,header,section,footer,.hero,main{position:relative;z-index:1;}`;
}

function buildCss(t: Theme, p: Palette, seedKey: string): string {
  // Colours come from the seeded palette; the theme still supplies typography and
  // the category-appropriate copy. `surface2` is derived so a palette only has to
  // declare the tokens that are genuinely independent.
  const surface2 = `color-mix(in srgb, ${p.surface} 72%, ${p.bg})`;
  return `
  :root{
    --bg:${p.bg}; --surface:${p.surface}; --surface2:${surface2};
    --text:${p.ink}; --muted:${p.muted}; --border:${p.border};
    --accent:${p.accent}; --accent-text:${readableOn(p.accent)};
    /* unmodified accent, kept so scopes that invert the ground (the bleed hero)
       can derive a light-safe variant without a self-referential var() */
    --accent-base:${p.accent}; --accent2:${p.accent2};
    --hero-bg:${p.bg}; --hero-text:${p.ink}; --mesh2:${p.accent2};
    --nav-h:74px; --heading:${t.headingFont}; --body:${t.bodyFont};
  }
  *{margin:0;padding:0;box-sizing:border-box;}
  html{scroll-behavior:smooth;}
  body{font-family:var(--body);background:var(--bg);color:var(--text);line-height:1.6;-webkit-font-smoothing:antialiased;}
${surfaceCss(seedKey)}
  h1,h2,h3{font-family:var(--heading);line-height:1.04;font-weight:700;letter-spacing:-0.01em;}
  .wrap{max-width:1140px;margin:0 auto;padding:0 clamp(18px,4vw,32px);}
  a{color:inherit;text-decoration:none;}

  /* ── Responsive foundation ───────────────────────────────────────────────
     Every string on these pages is a real business's data, so the layout has to
     hold for a 60-character name, an address with nothing to break on, twelve
     services or one. These are the guards that make that true for every
     archetype and every Design at once; :where() keeps them at zero specificity
     so any design still overrides them by stating the rule normally. */
  /* clip, not hidden — hidden would make these elements scroll containers and
     kill the sticky/fixed navs every design relies on. */
  html{overflow-x:clip;}
  body{overflow-x:clip;max-width:100%;}
  :where(img,svg,video,canvas,iframe){max-width:100%;}
  :where(img,video){height:auto;}
  /* Grid and flex children default to min-width:auto, which is what lets one
     long word widen its track past the 1fr it was given. */
  :where(div,section,article,aside,header,footer,nav,main,ul,ol,li,figure,
  figcaption,p,h1,h2,h3,h4,h5,h6,blockquote,form,label,a){min-width:0;}
  :where(h1,h2,h3,h4,p,li,dt,dd,blockquote,figcaption,td,th,address){overflow-wrap:break-word;}
  /* Nav labels are fixed template words, never lead data — holding them on one
     line is what keeps "break anywhere" below from stacking a nav link into one
     character per row. The wordmark is excluded: that one IS the business name. */
  :where(nav) :where(a):not(:where(.brand,.at-mark,.ki-nav-mark,.no-mark,.ma-mark)){white-space:nowrap;}
  /* white-space inherits, so the nowrap above must not reach anything holding
     the business's own text — it would defeat the overflow-wrap rules below. */
  :where(nav) :where(h1,h2,h3,address,.contact-info,.contact-info *){white-space:normal;}
  /* Headings hold the business name, and contact lines hold addresses, emails
     and URLs — the strings with no break opportunities in them. "anywhere" also
     lowers min-content width, which is what stops them forcing a track open.
     The per-design wordmark classes are here because that is where it bites:
     header and footer both print the name at display size in a cell drawn for a
     short one. */
  :where(h1,h2,h3,.brand,.at-mark,.ki-nav-mark,.no-mark,.ma-mark,
  .contact-info,.contact-info *,address,dt,dd,
  a[href^="mailto:"],a[href^="http"]){overflow-wrap:anywhere;}
  :where(h1,h2){hyphens:auto;}
  /* Footers carry the legal business name, the address and the year in one
     inline run, which is the longest unbreakable string on the page and the last
     place anyone looks. */
  :where(footer),:where(footer) *{overflow-wrap:anywhere;}
  /* A call link comes in two shapes here. Most are a prose label built from the
     business name (t.call(name) — "Call Frizerski studio Tamara"), and those
     must be able to break an over-long word. It has to be "anywhere" and not
     "break-word": break-word does not lower the element's min-content width, so
     the button would still push its column open and overflow, which is exactly
     what it did. */
  :where(a[href^="tel:"]),:where(a[href^="tel:"]) *{overflow-wrap:anywhere;}
  /* The rest print the number and nothing else. Stated last so it wins: a bare
     number wraps at the spaces between its groups, never inside one. */
  :where(.at-link,.no-btn-ghost,.ma-bar-cta,.vi-tel,.ki-table a[href^="tel:"]){
    overflow-wrap:normal;word-break:normal;}
  /* Long headlines must not collide with the line below them once they wrap;
     the 1.04 display leading above is drawn for one or two words. */
  :where(h1){line-height:1.06;}

  /* Touch: at the width where every design has collapsed its nav, controls
     clear 44px and form fields clear the 16px iOS zoom threshold. */
  @media(max-width:900px){
    :where(.btn,.btn-ghost,.navcta,button,[role="button"]){min-height:44px;
      display:inline-flex;align-items:center;justify-content:center;}
    :where(.at-mark,.at-link,.at-nav-cta,.at-links a,.ki-nav-mark,.ki-nav-cta,
    .ki-nav-right a,.no-mark,.no-links a,.no-nav-cta,.ma-mark,.ma-links a,
    .ma-nav-cta,.vi-nav a,.vi-nav-cta){min-height:44px;display:inline-flex;
      align-items:center;}
    :where(input,select,textarea){font-size:16px;min-height:44px;}
  }

  /* ── Mobile nav sheet ────────────────────────────────────────────────────
     Shown by the runtime only once the page's own nav links have been hidden,
     so each design keeps its own collapse point. Painted from the palette
     tokens, so it belongs to whichever design it lands in. */
  .lo-navtoggle{display:none;position:relative;z-index:2;flex:none;align-items:center;
    justify-content:center;width:44px;height:44px;margin-left:auto;padding:0;border:0;
    background:none;color:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent;}
  .lo-navtoggle.is-on{display:inline-flex;}
  .lo-navtoggle span{position:relative;display:block;width:20px;height:1.5px;
    background:currentColor;transition:background .2s;}
  .lo-navtoggle span::before,.lo-navtoggle span::after{content:"";position:absolute;left:0;
    width:20px;height:1.5px;background:currentColor;transition:transform .2s,top .2s;}
  .lo-navtoggle span::before{top:-6px;}
  .lo-navtoggle span::after{top:6px;}
  .lo-navtoggle[aria-expanded="true"] span{background:transparent;}
  .lo-navtoggle[aria-expanded="true"] span::before{top:0;transform:rotate(45deg);}
  .lo-navtoggle[aria-expanded="true"] span::after{top:0;transform:rotate(-45deg);}

  .lo-navsheet{position:fixed;inset:0;z-index:90;display:flex;flex-direction:column;
    justify-content:center;gap:4px;padding:88px clamp(22px,7vw,44px) calc(32px + env(safe-area-inset-bottom));
    background:var(--bg);color:var(--text);overflow-y:auto;overscroll-behavior:contain;
    opacity:0;visibility:hidden;transform:translateY(-8px);
    transition:opacity .22s ease,transform .22s ease,visibility .22s;}
  .lo-navsheet.is-open{opacity:1;visibility:visible;transform:none;}
  .lo-navsheet a{display:block;padding:16px 0;font-family:var(--heading);
    font-size:clamp(22px,7vw,32px);line-height:1.15;letter-spacing:-0.02em;
    border-bottom:1px solid var(--border);}
  .lo-navsheet .lo-navsheet-close{position:absolute;top:16px;right:clamp(18px,5vw,40px);
    width:44px;height:44px;display:flex;align-items:center;justify-content:center;padding:0;
    border:0;background:none;color:inherit;font:300 30px/1 system-ui,sans-serif;cursor:pointer;
    opacity:.65;}
  .lo-navsheet .lo-navsheet-close:hover{opacity:1;}
  .lo-navsheet .lo-navsheet-tel{font-family:var(--body);font-size:clamp(15px,4vw,18px);
    border-bottom:0;color:var(--muted);padding-top:24px;}
  html.lo-navopen{overflow:hidden;}
  @media(min-width:901px){.lo-navsheet{display:none;}}

  /* buttons */
  .btn{display:inline-block;background:var(--accent);color:var(--accent-text);padding:15px 30px;border-radius:999px;font-family:var(--body);font-weight:600;font-size:15px;box-shadow:0 10px 30px -10px color-mix(in srgb,var(--accent) 70%,transparent);transition:transform .2s;}
  .btn.full{display:block;text-align:center;margin-top:18px;}
  .btn-ghost{display:inline-flex;align-items:center;padding:15px 8px;font-weight:600;font-size:15px;color:var(--hero-text);opacity:.82;}
  .navcta{padding:9px 20px;border:1px solid color-mix(in srgb,var(--text) 22%,transparent);border-radius:999px;}

  /* nav */
  /* Scoped to the legacy archetypes. A full-page Design ships its own nav, and
     this bare element selector was leaking into it — a grey sticky bar with a
     backdrop-filter appearing behind every design's own navigation. */
  body[class*="layout-"] nav{position:sticky;top:0;z-index:20;height:var(--nav-h);display:flex;align-items:center;background:color-mix(in srgb,var(--hero-bg) 86%,transparent);backdrop-filter:saturate(160%) blur(10px);border-bottom:1px solid color-mix(in srgb,var(--hero-text) 9%,transparent);}
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
  /* These were blurred multi-stop radial blobs — the "AI gradient smudge" behind
     the headline. Structure reads as design; coloured haze reads as a generated
     page, so both are now hard-edged geometry in the palette's own colours. */
  .mesh{position:absolute;inset:0;z-index:0;overflow:hidden;
    background:linear-gradient(160deg,color-mix(in srgb,var(--accent) 14%,var(--bg)) 0%,var(--bg) 58%);}
  .mesh::after{content:"";position:absolute;right:-8%;top:-18%;width:46%;aspect-ratio:1;
    border-radius:50%;border:1px solid color-mix(in srgb,var(--accent) 34%,transparent);}
  .glow{position:absolute;inset:0;z-index:0;overflow:hidden;
    background:linear-gradient(180deg,var(--bg) 0%,color-mix(in srgb,var(--accent) 10%,var(--bg)) 100%);}
  .glow::after{content:"";position:absolute;left:50%;top:50%;translate:-50% -50%;
    width:min(64vw,720px);aspect-ratio:1;border-radius:50%;
    border:1px solid color-mix(in srgb,var(--accent) 24%,transparent);}
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

  /* BLEED archetype — dark scrim + white text for legibility over any image.
     The hero is pulled up under the sticky nav (negative margin) so the photo
     fills the whole band and the transparent white-text nav sits OVER the image,
     not over the light page background above it.
     Scoped to .layout-bleed: the other archetypes place photography inside their
     own composition and keep the palette's own ink colour. */
  .layout-bleed.has-photo .hero{background:#0b0c0e;min-height:100vh;margin-top:calc(-1 * var(--nav-h));}
  /* A light palette's accent is tuned for a pale ground and goes muddy on the
     dark scrim, so this archetype lightens it and flips the on-accent text.
     Dark palettes already have bright accents and are left alone. */
  .layout-bleed.has-photo.pal-light{
    --accent:color-mix(in srgb,var(--accent-base) 40%,#fff);--accent-text:#0B0B0B;}
  .hero-bg{position:absolute;inset:0;z-index:0;background-size:cover;background-position:center;transform:scale(1.03);}
  .scrim{position:absolute;inset:0;z-index:1;background:
    linear-gradient(180deg,rgba(8,9,11,.40) 0%,rgba(8,9,11,.18) 38%,rgba(8,9,11,.92) 100%),
    radial-gradient(80% 70% at 18% 92%,color-mix(in srgb,var(--accent) 32%,transparent),transparent 70%);}
  .seed-b .scrim{background:linear-gradient(75deg,rgba(8,9,11,.92) 0%,rgba(8,9,11,.42) 52%,rgba(8,9,11,.12) 100%),radial-gradient(70% 80% at 100% 0%,color-mix(in srgb,var(--accent) 30%,transparent),transparent 68%);}
  .seed-c .scrim{background:linear-gradient(285deg,rgba(8,9,11,.92) 0%,rgba(8,9,11,.42) 52%,rgba(8,9,11,.12) 100%);}
  .layout-bleed.has-photo .hero-inner{align-self:flex-end;padding-bottom:8vh;max-width:880px;}
  .layout-bleed.has-photo.seed-b .hero-inner{align-self:center;}
  .layout-bleed.has-photo .eyebrow{color:color-mix(in srgb,var(--accent) 88%,#fff);}
  .layout-bleed.has-photo .hero h1{color:#fff;font-size:clamp(48px,7.6vw,104px);margin:16px 0 16px;text-shadow:0 2px 30px rgba(0,0,0,.35);}
  .layout-bleed.has-photo .lede{color:rgba(255,255,255,.9);font-size:clamp(18px,2vw,24px);max-width:48ch;}
  .layout-bleed.has-photo .chip{border-color:rgba(255,255,255,.4);color:#fff;}
  .layout-bleed.has-photo nav{background:transparent;border-bottom:1px solid rgba(255,255,255,.14);}
  .layout-bleed.has-photo .brand,.layout-bleed.has-photo .navlinks a.navcta{color:#fff;}
  .layout-bleed.has-photo .navlinks a{color:rgba(255,255,255,.72);}
  /* keep nav text legible over a bright photo (until the solid state kicks in) */
  body.layout-bleed.has-photo:not(.nav-solid) .brand,
  body.layout-bleed.has-photo:not(.nav-solid) .navlinks a{text-shadow:0 1px 14px rgba(0,0,0,.5);}
  /* BLEED without a photo still needs a legible field. */
  .layout-bleed:not(.has-photo) .hero h1{font-size:clamp(50px,8vw,112px);margin:18px 0 16px;max-width:15ch;}
  .layout-bleed:not(.has-photo) .hero-inner{align-self:flex-end;padding-bottom:10vh;}

  /* Per-archetype photo treatments — each composition holds its image its own way. */
  .band{margin-top:44px;height:min(38vh,340px);border-radius:20px;border:1px solid var(--border);
    background-size:cover;background-position:center;box-shadow:0 40px 80px -50px rgba(0,0,0,.7);}
  .hero-col{border-radius:22px;border:1px solid var(--border);min-height:min(62vh,540px);
    background-size:cover;background-position:center;box-shadow:0 40px 80px -50px rgba(0,0,0,.6);}
  .layout-editorial .hero-inner.has-col{grid-template-columns:1.3fr .78fr .72fr;gap:40px;}
  .arch{width:min(360px,64%);height:min(34vh,300px);margin:0 auto 28px;border-radius:999px 999px 22px 22px;
    background-size:cover;background-position:center;border:1px solid var(--border);
    box-shadow:0 40px 70px -44px rgba(0,0,0,.6);}
  .inline-photo{margin-top:30px;height:min(30vh,260px);border-radius:18px;border:1px solid var(--border);
    background-size:cover;background-position:center;}

  /* FRAME archetype — a wide margin of page colour around an inset card. */
  .layout-frame .hero{padding:clamp(18px,3.4vw,52px);align-items:stretch;}
  .frame{flex:1;display:flex;align-items:center;border:1px solid var(--border);border-radius:28px;
    background:var(--surface);padding:clamp(28px,4.4vw,72px);overflow:hidden;
    box-shadow:0 50px 100px -60px rgba(0,0,0,.55);}
  .frame-inner{width:100%;max-width:900px;margin:0 auto;}
  .layout-frame .hero h1{font-size:clamp(42px,6.4vw,92px);margin:16px 0 16px;}
  .layout-frame .lede{font-size:clamp(18px,1.9vw,23px);max-width:46ch;}
  .panel{margin-top:38px;height:min(34vh,300px);border-radius:20px;background-size:cover;
    background-position:center;border:1px solid var(--border);}

  /* HORIZON archetype — one hard edge across the full width. */
  .layout-horizon .hero{display:block;padding:0;min-height:calc(100vh - var(--nav-h));}
  .horizon-top{background:var(--bg);padding:clamp(48px,8vh,110px) 0 clamp(38px,6vh,72px);
    border-bottom:2px solid var(--accent);}
  .layout-horizon .hero h1{font-size:clamp(44px,7vw,100px);margin:16px 0 16px;max-width:16ch;}
  .layout-horizon .lede{font-size:clamp(18px,2vw,23px);max-width:46ch;}
  .horizon-bottom{height:min(46vh,420px);background-size:cover;background-position:center;
    background-color:color-mix(in srgb,var(--accent) 22%,var(--surface));}

  /* Scrolled nav: once you leave the hero, the sticky bar gains a solid,
     theme-correct background + dark-on-light text. Without this a transparent
     white-text photo-hero nav (or a hero-tinted nav) sits invisibly over the
     light lower sections. Toggled by the inline script (body.nav-solid); these
     rules outrank the .has-photo nav rules above on specificity. */
  body[class*="layout-"] nav{transition:background .25s ease,border-color .25s ease,backdrop-filter .25s ease;}
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

    @keyframes maskUp{from{clip-path:inset(0 0 100% 0);transform:translateY(14px);}
                      to{clip-path:inset(0 0 -12% 0);transform:none;}}
    @keyframes panelIn{from{opacity:0;transform:translateY(34px) scale(.985);}to{opacity:1;transform:none;}}
    @keyframes ruleDraw{from{transform:scaleX(0);}to{transform:scaleX(1);}}

    nav{animation:heroRise .6s both cubic-bezier(.2,.75,.25,1);}
    .hero-inner .eyebrow,.hero-inner .kicker,.hero-inner .lede,
    .hero-inner .divider,.hero-inner .chip,.hero-inner .cta-row,
    .hero-inner .btn,.hero-inner .statbar,.hero-inner .trust,
    .hero-inner .hero-meta,.hero-inner .info-card{
      animation:heroRise .85s both cubic-bezier(.2,.75,.25,1);}
    /* the headline gets a mask wipe rather than a plain rise — it reads as
       designed motion instead of a generic fade */
    .hero h1{animation:maskUp .78s .1s both cubic-bezier(.16,1,.3,1);}
    .hero .rule{transform-origin:left center;animation:ruleDraw .6s .22s both ease-in-out;}
    .hero-inner .divider{animation-delay:.2s;}
    .hero-inner .lede{animation-delay:.26s;}
    .hero-inner .hero-meta,.hero-inner .info-card{animation-delay:.32s;}
    .hero-inner .cta-row,.hero-inner .btn,.hero-inner .chip{animation-delay:.38s;}
    .hero-inner .statbar,.hero-inner .trust{animation-delay:.48s;}
    /* every archetype's photo element settles in after the copy */
    .band,.hero-col,.arch,.inline-photo,.panel,.horizon-bottom{
      animation:panelIn .95s .34s both cubic-bezier(.16,1,.3,1);}
    .frame{animation:panelIn 1s both cubic-bezier(.16,1,.3,1);}
    /* slow, infinite Ken-Burns drift on the full-bleed photo hero */
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
    /* accent underline sweeping in from the left on nav + footer links */
    .navlinks a:not(.navcta){position:relative;}
    .navlinks a:not(.navcta)::after{content:"";position:absolute;left:0;right:0;bottom:-6px;height:1.5px;
      background:var(--accent);transform:scaleX(0);transform-origin:left center;transition:transform .22s ease-out;}
    .navlinks a:not(.navcta):hover::after{transform:scaleX(1);}
    /* gentle parallax drift, driven by the inline script's --par variable */
    .gal-item,.contact-map img{will-change:transform;}
  }

  /* Tablet portrait: the four-up gallery is too fine-grained to read here, but
     the page is still wide enough for two of everything else. */
  @media(max-width:1024px){
    .gal-grid{grid-template-columns:repeat(3,1fr);grid-auto-rows:170px;}
  }

  @media(max-width:880px){
    .gal-grid{grid-template-columns:repeat(2,1fr);}
    .gal-item:first-child{grid-column:span 2;}
    .hero-inner,.layout-editorial .hero-inner,.layout-editorial .hero-inner.has-col,
    .layout-clinical .hero-inner{grid-template-columns:1fr!important;}
    .hero-col{min-height:min(38vh,320px);}
    .layout-frame .hero{padding:16px;}
    .frame{padding:28px 22px;}
    .horizon-bottom{height:min(34vh,280px);}
    .hero-meta{border-left:none;padding-left:0;}
    .grid{grid-template-columns:1fr;}.navlinks{display:none;}
    .contact-grid:has(.contact-map){grid-template-columns:1fr;text-align:center;}
    .contact-grid:has(.contact-map) .contact-info{align-items:center;}
    /* The hero is drawn as a full viewport on desktop. On a phone that is a lot
       of empty ground above the first real content, so it sizes to its content
       with a floor instead. */
    .hero{min-height:auto;padding-block:clamp(56px,12vh,96px);}
    .ghost{font-size:34vh;}
  }

  /* Small phones. A two-up gallery of 200px rows leaves tiles under 140px wide;
     one column reads as a deliberate stack rather than a broken grid. */
  @media(max-width:430px){
    .gal-grid{grid-template-columns:1fr;grid-auto-rows:200px;}
    .gal-item:first-child{grid-column:span 1;grid-row:span 1;}
    .btn{padding:15px 22px;font-size:14px;}
    .statbar{flex-wrap:wrap;gap:14px;}
    .ghost{display:none;}
  }`;
}
