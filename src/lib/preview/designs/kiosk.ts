// KIOSK — Swiss brutalist, built like a magazine cover.
//
// Where Atelier is restrained editorial, this one is loud on purpose: the name is
// set enormous in a condensed face and deliberately bleeds past both edges, the
// photograph is a panel LAYERED over that type rather than sitting behind or
// beside it, and the metadata is pinned into the four corners of the first
// screen. Overlap and crop are what separate a designed page from a stack of
// centred sections — a headline that runs off the edge reads as confident; the
// same headline safely inside the margins reads as a template.
//
// Explicitly avoided, because they are the marks of a generated page: numbered
// 01/02/03 lists, feature-card grids, icon sets, and any blurred colour gradient.
import type { Ctx } from "../template";

const CONTACT_FORM_TOKEN = "{{CONTACT_FORM}}";

/**
 * Type size for the cover headline, in vw, scaled to the name's length.
 *
 * A fixed size is wrong here: at one setting a short name leaves half the row
 * empty and a long one runs off the screen — "Salon/Off" clipped to "SALON/O",
 * which defeats the point of putting the owner's name on the page.
 *
 * The budget is ~66vw, not the full width: the cover panel occupies the right
 * ~26vw, and the name is sized to stop before it. Sizing to the full width just
 * moved the clipping from the screen edge to behind the photograph. The layering
 * still reads, because the panel runs above and below the type's baseline.
 *
 * Archivo Black caps average ≈0.75em of advance, so n characters occupy n·0.75·size.
 */
function nameVw(name: string): number {
  const n = Math.max(name.trim().length, 3);
  return Math.max(4.5, Math.min(14, 66 / (n * 0.75)));
}

export function kioskBody(c: Ctx): string {
  const shots = [c.heroImg, ...c.gallery].filter(Boolean) as string[];
  const cover = shots[0];
  const strip = shots.slice(1, 6);

  return `
<nav class="ki-nav">
  <a class="ki-nav-mark" href="#top">${c.name}</a>
  <div class="ki-nav-right">
    <a href="#services">${c.t.navServices}</a>
    <a href="#about">${c.t.navAbout}</a>
    <a href="#contact" class="ki-nav-cta">${c.t.navBook}</a>
  </div>
</nav>

<header class="ki-hero${cover ? " has-photo" : ""}" id="top">
  ${cover ? `<div class="ki-shot"><div style="background-image:url('${cover}')"></div></div>` : ""}
  <div class="ki-hero-grid">
    <div class="ki-hero-top">
      <span>${c.label}${c.area ? ` — ${c.area}` : ""}</span>
      <span>${c.ratingLine ?? ""}</span>
    </div>
    <div class="ki-hero-bottom">
      <h1 class="ki-name" style="--ki-size:${nameVw(c.rawName)}vw"><span>${c.rawName}</span></h1>
      <div class="ki-hero-foot">
        <p>${c.tagline}</p>
        <a class="ki-btn" href="#contact">${c.t.bookNow}</a>
      </div>
    </div>
  </div>
</header>

<section class="ki-services" id="services">
  <div class="ki-sec-head"><span>${c.t.whatWeDo}</span></div>
  <ul class="ki-big-list">
    ${c.services
      .map(
        (s) => `
    <li class="ki-big">
      <a href="#contact">
        <span class="ki-big-t">${s.title}</span>
        <span class="ki-big-d">${s.blurb}</span>
      </a>
    </li>`,
      )
      .join("")}
  </ul>
</section>

${
  strip.length
    ? `<section class="ki-strip" aria-label="${c.t.galleryOverline}">
  <div class="ki-strip-track">
    ${strip.map((img) => `<figure style="background-image:url('${img}')"></figure>`).join("")}
  </div>
</section>`
    : ""
}

${
  c.testimonials.length
    ? `<section class="ki-shout" id="reviews">
  <p class="ki-shout-q">${c.testimonials[0]}</p>
  <div class="ki-shout-m">${c.ratingLine ?? ""}</div>
</section>`
    : ""
}

<section class="ki-facts" id="about">
  <div class="ki-facts-in">
    <h2>${c.name}</h2>
    <p class="ki-facts-copy">${c.t.aboutCopy(c.area, c.label, c.reviewCount)}</p>
    <dl class="ki-table">
      ${c.address ? `<div><dt>${c.t.comeSayHello}</dt><dd>${c.address}</dd></div>` : ""}
      ${c.phone ? `<div><dt>${c.t.call(c.name)}</dt><dd><a href="tel:${c.phone}">${c.phone}</a></dd></div>` : ""}
      ${
        c.hours.length
          ? `<div><dt>${c.t.hours}</dt><dd>${c.hours.map((h) => `<span>${h}</span>`).join("")}</dd></div>`
          : ""
      }
    </dl>
  </div>
  ${c.mapImg ? `<div class="ki-map"><img src="${c.mapImg}" alt="" loading="lazy" /></div>` : ""}
</section>

<section class="ki-contact" id="contact">
  <h2>${c.t.getInTouch}</h2>
  ${CONTACT_FORM_TOKEN}
</section>

<footer class="ki-footer"><span>${c.t.footer(c.name, new Date().getFullYear())}</span></footer>`;
}

export function kioskCss(): string {
  return `
  /* ── KIOSK ───────────────────────────────────────────────────────────── */
  body{background:var(--bg);color:var(--text);}
  /* One condensed face doing all the shouting. The category themes pick softer
     serifs; this design overrides them on purpose — its whole identity is scale. */
  .design-kiosk{--display:'Archivo','Anton',system-ui,sans-serif;}

  .ki-nav{position:fixed;inset:0 0 auto 0;z-index:60;display:flex;align-items:center;
    justify-content:space-between;gap:20px;padding:16px clamp(14px,3vw,30px);
    mix-blend-mode:difference;color:#fff;}
  .ki-nav-mark{font-family:var(--display);font-weight:800;text-transform:uppercase;
    letter-spacing:-.01em;font-size:14px;white-space:nowrap;overflow:hidden;
    text-overflow:ellipsis;max-width:48vw;}
  .ki-nav-right{display:flex;align-items:center;gap:clamp(12px,2vw,26px);}
  .ki-nav-right a{font-size:12px;text-transform:uppercase;letter-spacing:.1em;font-weight:600;}
  .ki-nav-cta{border:1px solid currentColor;padding:6px 14px;}

  /* Hero — the photograph IS the first screen.
     The first version centred one line of type in an otherwise empty viewport:
     half the screen was blank ground above the name, and the photo was a 300px
     panel. That is the worst possible use of the only screen guaranteed to be
     seen. The image now fills the viewport and the type sits on it. */
  .ki-hero{position:relative;min-height:100svh;overflow:hidden;
    background:var(--text);display:flex;}
  .ki-shot{position:absolute;inset:0;}
  .ki-shot div{position:absolute;inset:0;background-size:cover;background-position:center;}
  .ki-hero.has-photo::after{content:"";position:absolute;inset:0;
    background:linear-gradient(180deg,rgba(0,0,0,.66) 0%,rgba(0,0,0,.12) 30%,
      rgba(0,0,0,.35) 62%,rgba(0,0,0,.88) 100%);}
  .ki-hero:not(.has-photo){background:
    linear-gradient(165deg,color-mix(in srgb,var(--accent) 30%,var(--text)),var(--text));}
  .ki-hero-grid{position:relative;z-index:2;flex:1;display:flex;flex-direction:column;
    justify-content:space-between;padding:74px clamp(14px,3vw,30px) clamp(26px,4vh,44px);
    color:#fff;}
  .ki-hero-top{display:flex;justify-content:space-between;gap:20px;font-size:11.5px;
    letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.82);}
  .ki-hero-bottom{display:flex;flex-direction:column;gap:clamp(16px,2.6vh,30px);}
  .ki-hero-foot{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;
    flex-wrap:wrap;}
  .ki-hero-foot p{font-size:clamp(15px,1.5vw,19px);max-width:32ch;line-height:1.45;
    text-shadow:0 1px 16px rgba(0,0,0,.5);}
  /* Sized to the full width now that nothing overlaps it. */
  .ki-name{font-family:var(--display);font-weight:900;text-transform:uppercase;
    line-height:.84;letter-spacing:-.04em;color:#fff;
    font-size:clamp(38px,var(--ki-size,12vw),230px);white-space:nowrap;}
  .ki-name span{display:block;}
  .ki-btn{display:inline-block;background:var(--accent);color:var(--accent-text);
    font-family:var(--display);font-weight:800;text-transform:uppercase;letter-spacing:.04em;
    font-size:13px;padding:14px 26px;transition:transform .2s;}
  .ki-btn:hover{transform:translateY(-2px);}

  /* services — oversized type rows, no numbers, no cards */
  .ki-sec-head{padding:0 clamp(14px,3vw,30px);border-bottom:1px solid var(--text);}
  .ki-sec-head span{display:inline-block;padding:14px 0;font-size:11px;letter-spacing:.2em;
    text-transform:uppercase;color:var(--muted);}
  .ki-big-list{list-style:none;}
  .ki-big{border-bottom:1px solid var(--text);}
  .ki-big a{display:flex;align-items:baseline;justify-content:space-between;gap:24px;
    padding:clamp(18px,3.4vw,42px) clamp(14px,3vw,30px);position:relative;overflow:hidden;}
  /* Accent sweeps in from the left on hover — a wipe, not a fade. */
  .ki-big a::before{content:"";position:absolute;inset:0;background:var(--accent);
    transform:translateX(-101%);transition:transform .45s cubic-bezier(.7,0,.2,1);z-index:0;}
  .ki-big a:hover::before{transform:none;}
  .ki-big-t,.ki-big-d{position:relative;z-index:1;transition:color .3s ease;}
  .ki-big-t{font-family:var(--display);font-weight:800;text-transform:uppercase;
    letter-spacing:-.02em;line-height:.95;font-size:clamp(26px,5.6vw,86px);}
  .ki-big-d{font-size:13.5px;color:var(--muted);max-width:34ch;text-align:right;flex:0 1 34ch;}
  .ki-big a:hover .ki-big-t,.ki-big a:hover .ki-big-d{color:var(--accent-text);}

  /* photo strip — full bleed, horizontally scrollable */
  .ki-strip{overflow-x:auto;overflow-y:hidden;scrollbar-width:none;border-bottom:1px solid var(--text);}
  .ki-strip::-webkit-scrollbar{display:none;}
  .ki-strip-track{display:flex;width:max-content;}
  .ki-strip figure{width:min(52vw,520px);aspect-ratio:4/3;background-size:cover;
    background-position:center;border-right:1px solid var(--text);flex:none;}

  /* shout — type-only quote, fills the screen */
  .ki-shout{background:var(--text);color:var(--bg);padding:clamp(70px,14vh,150px) clamp(14px,3vw,30px);}
  .ki-shout-q{font-family:var(--display);font-weight:800;text-transform:uppercase;
    line-height:.98;letter-spacing:-.028em;font-size:clamp(26px,5.4vw,78px);max-width:16ch;}
  .ki-shout-m{margin-top:clamp(24px,4vh,44px);font-size:11.5px;letter-spacing:.2em;
    text-transform:uppercase;opacity:.6;}

  /* facts */
  .ki-facts{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);
    border-bottom:1px solid var(--text);}
  .ki-facts-in{padding:clamp(40px,7vh,90px) clamp(14px,3vw,30px);}
  .ki-facts h2{font-family:var(--display);font-weight:900;text-transform:uppercase;
    font-size:clamp(28px,4.6vw,64px);line-height:.92;letter-spacing:-.03em;}
  .ki-facts-copy{margin-top:20px;max-width:46ch;color:var(--muted);font-size:16px;line-height:1.65;}
  .ki-table{margin-top:clamp(28px,5vh,54px);border-top:1px solid var(--text);}
  .ki-table > div{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.6fr);gap:20px;
    padding:16px 0;border-bottom:1px solid color-mix(in srgb,var(--text) 22%,transparent);}
  .ki-table dt{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);}
  .ki-table dd{font-size:15px;}
  .ki-table dd span{display:block;}
  .ki-map{border-left:1px solid var(--text);}
  .ki-map img{display:block;width:100%;height:100%;object-fit:cover;min-height:280px;}

  .ki-contact{padding:clamp(48px,9vh,110px) clamp(14px,3vw,30px);}
  .ki-contact h2{font-family:var(--display);font-weight:900;text-transform:uppercase;
    font-size:clamp(26px,4.2vw,58px);letter-spacing:-.03em;margin-bottom:28px;}
  .ki-footer{border-top:1px solid var(--text);padding:20px clamp(14px,3vw,30px);
    font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);}

  @media(max-width:820px){
    .ki-facts{grid-template-columns:1fr;}
    .ki-map{border-left:0;border-top:1px solid var(--text);}
    .ki-big a{flex-direction:column;align-items:flex-start;gap:8px;}
    .ki-big-d{text-align:left;}
    .ki-hero-top span:last-child{display:none;}
    .ki-nav-right a:not(.ki-nav-cta){display:none;}
  }

  @media(max-width:430px){
    .ki-nav-cta{display:none;}
    .ki-facts{gap:0;}
    .ki-big a{padding-block:18px;}
  }

  @media(prefers-reduced-motion:no-preference){
    .ki-shot div{animation:kiPush 30s ease-in-out infinite alternate;}
    @keyframes kiPush{from{transform:scale(1.04);}to{transform:scale(1.12) translateX(-1.5%);}}
    .ki-name span{animation:kiWide 1.1s cubic-bezier(.2,.75,.25,1) backwards;}
    @keyframes kiWide{from{transform:translateY(24px);opacity:0;}to{transform:none;opacity:1;}}
    .ki-hero-foot,.ki-hero-top{animation:kiFade .9s ease .38s backwards;}
    @keyframes kiFade{from{opacity:0;}to{opacity:1;}}
  }`;
}
