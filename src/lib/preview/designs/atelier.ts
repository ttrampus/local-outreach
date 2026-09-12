// ATELIER — the first full-page design.
//
// The seven "archetypes" in template.ts are hero skins: each adds 3–16 CSS rules
// and then hands off to one shared body, so every page below the fold is the same
// page. A Design instead owns the whole document — its own sections, its own type
// scale, its own motion — which is what it takes for two previews to read as two
// different websites rather than one template in different colours.
//
// Atelier's brief: an editorial luxury salon/boutique. Full-bleed photography
// under a slow drift, an oversized display headline that masks up line by line, a
// services list as hairline-ruled editorial rows rather than boxes, an
// intentionally uneven photo mosaic, and one big pull quote. Motion is slow and
// mostly opacity/transform, so it reads as composed rather than busy.
import type { Ctx } from "../template";

const CONTACT_FORM_TOKEN = "{{CONTACT_FORM}}";

/**
 * Column spans and aspect ratios for the photo mosaic, chosen so every row is
 * exactly full. A fixed nth-child pattern left a four-column hole whenever the
 * business had three photos, which is common.
 */
const MOSAIC: Record<number, [number, string][]> = {
  1: [[6, "21/9"]],
  2: [
    [3, "4/5"],
    [3, "4/5"],
  ],
  3: [
    [4, "4/3"],
    [2, "3/4"],
    [6, "21/8"],
  ],
  4: [
    [4, "16/10"],
    [2, "3/4"],
    [2, "3/4"],
    [4, "16/10"],
  ],
  5: [
    [4, "16/10"],
    [2, "3/4"],
    [2, "1/1"],
    [2, "1/1"],
    [2, "1/1"],
  ],
};

/** Split a headline so each word can be masked up on its own delay. */
function maskWords(text: string): string {
  return text
    .split(/\s+/)
    .map(
      (w, i) =>
        `<span class="mw"><span class="mw-i" style="--i:${i}">${w}</span></span>`,
    )
    .join(" ");
}

export function atelierBody(c: Ctx): string {
  const hero = c.heroImg;
  const shots = c.gallery.slice(0, 5);
  const mapped = c.mapImg ? " has-map" : "";

  return `
<nav class="at-nav">
  <div class="at-nav-in">
    <a class="at-mark" href="#top">${c.name}</a>
    <div class="at-links">
      <a href="#services">${c.t.navServices}</a>
      <a href="#about">${c.t.navAbout}</a>
      ${c.testimonials.length ? `<a href="#reviews">${c.t.navReviews}</a>` : ""}
      <a href="#contact" class="at-nav-cta">${c.t.navBook}</a>
    </div>
  </div>
</nav>

<header class="at-hero${hero ? " has-photo" : ""}" id="top">
  ${hero ? `<div class="at-hero-media"><div class="at-hero-img" style="background-image:url('${hero}')"></div></div>` : ""}
  <div class="at-hero-in">
    <span class="at-eyebrow">${c.label}${c.eyebrow ? ` · ${c.eyebrow}` : ""}</span>
    <h1>${maskWords(c.rawName)}</h1>
    <p class="at-tagline">${c.tagline}</p>
    <div class="at-hero-foot">
      <a class="at-btn" href="#contact">${c.t.bookNow}</a>
      ${c.ratingLine ? `<span class="at-rating">${c.ratingLine}</span>` : ""}
    </div>
  </div>
  <div class="at-scroll" aria-hidden="true"><span></span></div>
</header>

<div class="at-ticker" aria-hidden="true">
  <div class="at-ticker-row">
    ${Array.from({ length: 3 })
      .map(() => c.services.map((s) => `<span>${s.title}</span><i>·</i>`).join(""))
      .join("")}
  </div>
</div>

<section class="at-services" id="services">
  <div class="at-in">
    <div class="at-head reveal">
      <span class="at-overline">${c.t.whatWeDo}</span>
      <h2>${c.t.everythingDoneWithCare}</h2>
    </div>
    <ol class="at-list">
      ${c.services
        .map(
          (s, i) => `
      <li class="at-row reveal d${(i % 3) + 1}">
        <h3>${s.title}</h3>
        <p>${s.blurb}</p>
      </li>`,
        )
        .join("")}
    </ol>
  </div>
</section>

${
  shots.length
    ? `<section class="at-mosaic">
  ${shots
    .map((img, i) => {
      const [span, ratio] = MOSAIC[shots.length]![i]!;
      return `<figure class="at-tile reveal d${(i % 3) + 1}" style="grid-column:span ${span};aspect-ratio:${ratio}"><div style="background-image:url('${img}')"></div></figure>`;
    })
    .join("")}
</section>`
    : ""
}

<section class="at-about" id="about">
  <div class="at-in at-about-in">
    <div class="at-about-copy reveal">
      <span class="at-overline">${c.t.aboutOverline}</span>
      <h2>${c.name}</h2>
      <p>${c.t.aboutCopy(c.area, c.label, c.reviewCount)}</p>
      ${c.phone ? `<a class="at-link" href="tel:${c.phone}">${c.phone}</a>` : ""}
    </div>
    ${
      c.hours.length
        ? `<div class="at-hours reveal d1">
      <span class="at-overline">${c.t.hours}</span>
      <ul>${c.hours.map((h) => `<li><span>${h}</span></li>`).join("")}</ul>
    </div>`
        : ""
    }
  </div>
</section>

${
  c.testimonials.length
    ? `<section class="at-quote" id="reviews">
  <div class="at-in">
    <div class="at-quote-mark" aria-hidden="true">”</div>
    <blockquote class="reveal">${c.testimonials[0]}</blockquote>
    <div class="at-quote-meta reveal d1">
      <span class="at-stars">★★★★★</span>
      ${c.ratingLine ? `<span>${c.ratingLine}</span>` : ""}
    </div>
  </div>
</section>`
    : ""
}

<section class="at-contact" id="contact">
  <div class="at-in at-contact-in${mapped}">
    <div class="at-contact-copy reveal">
      <span class="at-overline">${c.t.comeSayHello}</span>
      <h2>${c.t.getInTouch}</h2>
      ${c.address ? `<p class="at-addr">${c.address}</p>` : ""}
      ${c.phone ? `<a class="at-btn" href="tel:${c.phone}">${c.t.call(c.name)}</a>` : ""}
    </div>
    ${c.mapImg ? `<div class="at-map reveal d1"><img src="${c.mapImg}" alt="" loading="lazy" /></div>` : ""}
  </div>
  <div class="at-in">${CONTACT_FORM_TOKEN}</div>
</section>

<footer class="at-footer">${c.t.footer(c.name, new Date().getFullYear())}</footer>`;
}

export function atelierCss(): string {
  return `
  /* ── ATELIER ─────────────────────────────────────────────────────────── */
  body{background:var(--bg);}
  .at-in{max-width:1240px;margin:0 auto;padding:0 clamp(20px,5vw,64px);}
  .at-overline{display:block;font-size:11px;letter-spacing:.22em;text-transform:uppercase;
    color:var(--muted);margin-bottom:18px;}

  /* nav */
  .at-nav{position:fixed;top:0;left:0;right:0;z-index:50;padding:22px 0;
    transition:background .4s ease,padding .4s ease,border-color .4s ease;
    border-bottom:1px solid transparent;}
  /* White nav type over a bright photo was unreadable. A scrim carries it until
     the solid state takes over on scroll. */
  .at-nav::before{content:"";position:absolute;left:0;right:0;top:0;height:180px;
    pointer-events:none;
    background:linear-gradient(180deg,rgba(0,0,0,.62) 0%,rgba(0,0,0,.3) 46%,rgba(0,0,0,0) 100%);
    opacity:1;transition:opacity .4s ease;}
  body.nav-solid .at-nav::before{opacity:0;}
  .at-nav-in{position:relative;z-index:1;}
  .at-nav-in{max-width:1240px;margin:0 auto;padding:0 clamp(20px,5vw,64px);
    display:flex;align-items:center;justify-content:space-between;gap:24px;}
  .at-mark{font-family:var(--heading);font-size:19px;letter-spacing:-.01em;color:#fff;
    transition:color .4s ease;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:52vw;}
  .at-links{display:flex;align-items:center;gap:clamp(14px,2.4vw,34px);}
  .at-links a{font-size:13px;letter-spacing:.04em;color:rgba(255,255,255,.86);
    transition:color .4s ease,opacity .2s ease;}
  .at-links a:hover{opacity:.6;}
  .at-nav-cta{border:1px solid rgba(255,255,255,.45);border-radius:999px;padding:9px 20px;}
  body.nav-solid .at-nav{background:color-mix(in srgb,var(--bg) 88%,transparent);
    backdrop-filter:blur(14px);padding:13px 0;border-bottom-color:var(--border);}
  body.nav-solid .at-mark,body.nav-solid .at-links a{color:var(--text);}
  body.nav-solid .at-nav-cta{border-color:var(--border);}
  .at-hero:not(.has-photo) ~ * .at-nav,
  .at-hero:not(.has-photo) .at-mark{color:var(--text);}

  /* hero */
  .at-hero{position:relative;min-height:100svh;display:flex;align-items:flex-end;
    overflow:hidden;background:var(--bg);}
  .at-hero-media{position:absolute;inset:0;}
  .at-hero-img{position:absolute;inset:-6%;background-size:cover;background-position:center;}
  .at-hero.has-photo::after{content:"";position:absolute;inset:0;
    background:linear-gradient(180deg,rgba(0,0,0,.52) 0%,rgba(0,0,0,.18) 34%,rgba(0,0,0,.72) 100%);}
  .at-hero-in{position:relative;z-index:2;width:100%;max-width:1240px;margin:0 auto;
    padding:0 clamp(20px,5vw,64px) clamp(64px,11vh,120px);}
  .at-hero.has-photo .at-hero-in,.at-hero.has-photo .at-eyebrow{color:#fff;}
  /* Over photography the eyebrow sits on whatever tone the image happens to have,
     so it carries its own shadow rather than relying on the scrim. */
  .at-hero.has-photo .at-eyebrow{color:rgba(255,255,255,.92);
    text-shadow:0 1px 14px rgba(0,0,0,.55);}
  .at-hero.has-photo .at-tagline{text-shadow:0 1px 18px rgba(0,0,0,.4);}
  .at-eyebrow{display:block;font-size:11px;letter-spacing:.24em;text-transform:uppercase;
    color:var(--muted);margin-bottom:clamp(14px,2vh,22px);}
  .at-hero h1{font-family:var(--heading);font-weight:700;letter-spacing:-.028em;line-height:.92;
    font-size:clamp(46px,9.2vw,132px);max-width:15ch;}
  .at-tagline{margin-top:clamp(16px,2.4vh,26px);font-size:clamp(16px,1.5vw,21px);
    max-width:40ch;opacity:.92;line-height:1.5;}
  .at-hero-foot{margin-top:clamp(26px,4vh,44px);display:flex;align-items:center;
    gap:clamp(16px,2.5vw,30px);flex-wrap:wrap;}
  .at-rating{font-size:13px;letter-spacing:.06em;opacity:.85;}
  .at-rating em{font-style:normal;font-weight:700;font-size:16px;}
  .at-btn{display:inline-block;background:var(--accent);color:var(--accent-text);
    padding:16px 34px;border-radius:999px;font-weight:600;font-size:14px;letter-spacing:.02em;
    transition:transform .25s cubic-bezier(.2,.7,.3,1),box-shadow .25s;
    box-shadow:0 14px 34px -14px color-mix(in srgb,var(--accent) 80%,transparent);}
  .at-btn:hover{transform:translateY(-2px);box-shadow:0 20px 40px -16px color-mix(in srgb,var(--accent) 80%,transparent);}
  .at-scroll{position:absolute;left:50%;bottom:26px;z-index:2;width:1px;height:52px;
    background:linear-gradient(180deg,transparent,rgba(255,255,255,.6));overflow:hidden;}
  .at-hero:not(.has-photo) .at-scroll{background:linear-gradient(180deg,transparent,var(--border));}

  /* ticker */
  .at-ticker{overflow:hidden;border-top:1px solid var(--border);border-bottom:1px solid var(--border);
    padding:16px 0;background:var(--surface);}
  .at-ticker-row{display:flex;align-items:center;gap:26px;white-space:nowrap;width:max-content;}
  .at-ticker span{font-family:var(--heading);font-size:clamp(15px,1.7vw,21px);letter-spacing:.02em;}
  .at-ticker i{color:var(--accent);font-style:normal;}

  /* services as editorial rows */
  .at-services{padding:clamp(72px,12vh,140px) 0;}
  .at-head h2{font-family:var(--heading);font-size:clamp(30px,4.4vw,58px);letter-spacing:-.022em;
    line-height:1.04;max-width:18ch;}
  .at-list{list-style:none;margin-top:clamp(38px,6vh,66px);border-top:1px solid var(--border);}
  /* No 01/02/03 counters: a numbered list is one of the surest tells of a
     generated page. The rule and the type carry the rhythm instead. */
  .at-row{display:grid;grid-template-columns:minmax(0,4fr) minmax(0,5fr);gap:clamp(14px,3vw,42px);
    align-items:baseline;padding:clamp(22px,3.4vh,36px) 0;border-bottom:1px solid var(--border);
    transition:background .35s ease,padding-left .35s ease;}
  .at-row:hover{background:var(--surface);padding-left:14px;}
  .at-row h3{font-family:var(--heading);font-size:clamp(21px,2.5vw,32px);font-weight:600;
    letter-spacing:-.015em;line-height:1.12;}
  .at-row p{color:var(--muted);font-size:15.5px;line-height:1.62;}

  /* uneven photo mosaic */
  .at-mosaic{display:grid;grid-template-columns:repeat(6,1fr);gap:clamp(8px,1.2vw,16px);
    padding:0 clamp(8px,1.2vw,16px) clamp(8px,1.2vw,16px);}
  /* Spans and ratios come from MOSAIC, inline per tile, so every row fills. */
  .at-tile{overflow:hidden;border-radius:3px;}
  .at-tile div{width:100%;height:100%;background-size:cover;background-position:center;
    transition:transform 1.1s cubic-bezier(.2,.7,.3,1);}
  .at-tile:hover div{transform:scale(1.05);}

  /* about */
  .at-about{padding:clamp(72px,13vh,150px) 0;}
  .at-about-in{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,.85fr);
    gap:clamp(32px,6vw,90px);align-items:start;}
  .at-about-copy h2{font-family:var(--heading);font-size:clamp(28px,4vw,52px);letter-spacing:-.022em;
    line-height:1.06;margin-bottom:22px;}
  .at-about-copy p{font-size:clamp(16px,1.5vw,19px);line-height:1.72;color:var(--muted);max-width:52ch;}
  .at-link{display:inline-block;margin-top:26px;font-family:var(--heading);font-size:22px;
    border-bottom:1px solid var(--accent);padding-bottom:3px;transition:opacity .2s;}
  .at-link:hover{opacity:.65;}
  .at-hours ul{list-style:none;border-top:1px solid var(--border);}
  .at-hours li{padding:11px 0;border-bottom:1px solid var(--border);font-size:14.5px;
    color:var(--muted);display:flex;justify-content:space-between;gap:16px;}

  /* Pull quote — the page's one inverted block. Without it the whole document is
     one flat light grey from top to bottom and reads as a wireframe; a single
     dark moment gives the scroll a rhythm and makes the accent register. */
  .at-quote{position:relative;padding:clamp(84px,15vh,170px) 0;text-align:center;
    background:var(--text);color:var(--bg);overflow:hidden;}
  /* Flat ground plus a hairline rule, NOT a radial accent glow — the glow is the
     generated-page tell this design exists to avoid. */
  .at-quote::after{content:"";position:absolute;left:50%;top:0;translate:-50% 0;
    width:1px;height:clamp(40px,7vh,84px);background:var(--accent);}
  .at-quote .at-in{position:relative;z-index:1;}
  .at-quote-mark{font-family:var(--heading);font-size:clamp(130px,21vw,300px);line-height:.6;
    color:var(--accent);opacity:.5;height:.4em;overflow:hidden;}
  .at-quote blockquote{font-family:var(--heading);font-size:clamp(22px,3.1vw,44px);line-height:1.28;
    letter-spacing:-.02em;margin:clamp(22px,3.4vh,40px) auto 0;max-width:min(23ch,92%);
    font-weight:500;}
  .at-quote-meta{margin-top:32px;display:flex;align-items:center;justify-content:center;gap:14px;
    font-size:13px;letter-spacing:.04em;opacity:.72;}
  .at-stars{color:var(--accent);letter-spacing:.14em;opacity:1;}

  /* contact */
  .at-contact{padding:clamp(72px,13vh,150px) 0 clamp(48px,8vh,90px);}
  /* Only split the contact block when there is actually a map to fill the other
     half; otherwise it renders as one column with a dead void beside it. */
  .at-contact-in{display:grid;grid-template-columns:minmax(0,1fr);
    gap:clamp(30px,5vw,72px);align-items:center;}
  .at-contact-in.has-map{grid-template-columns:minmax(0,1fr) minmax(0,1fr);}
  .at-contact-copy h2{font-family:var(--heading);font-size:clamp(30px,4.6vw,60px);
    letter-spacing:-.024em;line-height:1.04;margin-bottom:20px;}
  .at-addr{color:var(--muted);font-size:17px;line-height:1.6;margin-bottom:28px;max-width:32ch;}
  .at-map{border-radius:4px;overflow:hidden;border:1px solid var(--border);}
  .at-map img{display:block;width:100%;height:100%;object-fit:cover;}
  .at-footer{padding:34px 0 40px;text-align:center;font-size:12.5px;color:var(--muted);
    border-top:1px solid var(--border);letter-spacing:.03em;}

  @media(max-width:860px){
    .at-about-in,.at-contact-in.has-map{grid-template-columns:1fr;}
    .at-row{grid-template-columns:1fr;gap:6px;}
    .at-mosaic{grid-template-columns:repeat(2,1fr);}
    .at-tile-0{grid-column:span 2;aspect-ratio:16/11;}
    .at-tile-1,.at-tile-2,.at-tile-3,.at-tile-4{grid-column:span 1;aspect-ratio:3/4;}
    .at-links a:not(.at-nav-cta){display:none;}
  }

  /* Small phones: a two-up mosaic leaves tiles under 150px wide, which is not
     enough to read a photograph by. */
  @media(max-width:430px){
    /* The CTA no longer fits beside the wordmark; it is the first thing in the
       mobile sheet, one tap away. */
    .at-nav-cta{display:none;}
    .at-mosaic{grid-template-columns:1fr;}
    .at-tile-0{grid-column:span 1;aspect-ratio:4/3;}
    .at-tile-1,.at-tile-2,.at-tile-3,.at-tile-4{aspect-ratio:4/3;}
    .at-nav{padding:14px 0;}
  }

  /* Motion. The screenshot renderer emulates prefers-reduced-motion:reduce, so
     everything here must be decoration only — the page is complete without it. */
  @media(prefers-reduced-motion:no-preference){
    .at-hero-img{animation:atDrift 26s ease-in-out infinite alternate;}
    @keyframes atDrift{from{transform:scale(1.02) translate3d(0,0,0);}
                       to{transform:scale(1.09) translate3d(-1.5%,-1.5%,0);}}
    .mw{display:inline-block;overflow:hidden;vertical-align:bottom;}
    .mw-i{display:inline-block;animation:atMaskUp .95s cubic-bezier(.2,.75,.25,1) backwards;
      animation-delay:calc(.16s + var(--i) * .085s);}
    @keyframes atMaskUp{from{transform:translateY(102%);}to{transform:none;}}
    .at-eyebrow,.at-tagline,.at-hero-foot{animation:atFade .9s ease backwards;}
    .at-eyebrow{animation-delay:.05s;}
    .at-tagline{animation-delay:.42s;}
    .at-hero-foot{animation-delay:.56s;}
    @keyframes atFade{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:none;}}
    .at-scroll span{display:block;width:100%;height:40%;background:var(--accent);
      animation:atScroll 2.4s ease-in-out infinite;}
    @keyframes atScroll{0%{transform:translateY(-100%);}60%,100%{transform:translateY(260%);}}
    .at-ticker-row{animation:atTicker 38s linear infinite;}
    @keyframes atTicker{from{transform:translateX(0);}to{transform:translateX(-33.333%);}}
    .reveal{opacity:0;transform:translateY(24px);
      transition:opacity .85s cubic-bezier(.2,.7,.3,1),transform .85s cubic-bezier(.2,.7,.3,1);}
    .reveal.in{opacity:1;transform:none;}
    .reveal.d1{transition-delay:.09s;}
    .reveal.d2{transition-delay:.18s;}
    .reveal.d3{transition-delay:.27s;}
  }`;
}
