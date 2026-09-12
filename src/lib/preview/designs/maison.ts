// MAISON — warm cream ground, rounded card shell, display serif.
//
// Built from the warm salon references in /home/tim/website designs photos
// (Hair Vibe, Minerva): a soft cream field with the whole page floating inside a
// large rounded card, a pill-shaped nav bar, an oversized display-serif headline
// with one word in the accent colour, and a glassy booking strip pinned across
// the bottom of the first screen.
//
// Departure from the references, and the reason this is not a clone: their heroes
// are built on a knocked-out studio model on a clean backdrop. Leads here have
// amateur interior photos, so the hero photograph is a bleed panel on the right
// with a soft feather into the ground rather than a cutout — the same
// composition, adapted to the photography that actually exists.
import type { Ctx } from "../template";

const CONTACT_FORM_TOKEN = "{{CONTACT_FORM}}";

/** Put the final word of the headline in the accent colour. */
function accentLast(text: string): string {
  const words = text.trim().split(/\s+/);
  if (words.length < 2) return `<em>${text}</em>`;
  const last = words.pop();
  return `${words.join(" ")} <em>${last}</em>`;
}

export function maisonBody(c: Ctx): string {
  const hero = c.heroImg;
  const tiles = c.gallery.slice(0, 3);

  return `
<div class="ma-page">
  <div class="ma-card">
    <nav class="ma-nav">
      <a class="ma-mark" href="#top">${c.name}</a>
      <div class="ma-links">
        <a href="#services">${c.t.navServices}</a>
        <a href="#about">${c.t.navAbout}</a>
        ${c.testimonials.length ? `<a href="#reviews">${c.t.navReviews}</a>` : ""}
      </div>
      <a class="ma-nav-cta" href="#contact">${c.t.navBook}</a>
    </nav>

    <header class="ma-hero" id="top">
      <div class="ma-hero-copy">
        <span class="ma-eyebrow">${c.label}${c.area ? ` · ${c.area}` : ""}</span>
        <h1>${accentLast(c.tagline)}</h1>
        ${/* ratingLine already carries its own star — do not add a second. */ ""}
        ${c.ratingLine ? `<p class="ma-rate">${c.ratingLine}</p>` : ""}
        <a class="ma-btn" href="#contact">${c.t.bookNow}</a>
      </div>
      ${
        hero
          ? `<div class="ma-hero-photo"><div style="background-image:url('${hero}')"></div></div>`
          : ""
      }
    </header>

    ${
      c.address || c.phone || c.hours.length
        ? `<div class="ma-bar">
      ${c.address ? `<div><span>${c.t.comeSayHello}</span><strong>${c.address}</strong></div>` : ""}
      ${c.hours.length ? `<div><span>${c.t.hours}</span><strong>${c.hours[0]}</strong></div>` : ""}
      ${c.phone ? `<a class="ma-bar-cta" href="tel:${c.phone}">${c.phone}</a>` : ""}
    </div>`
        : ""
    }

    <section class="ma-services" id="services">
      <div class="ma-head reveal">
        <span class="ma-over">${c.t.whatWeDo}</span>
        <h2>${c.t.everythingDoneWithCare}</h2>
      </div>
      <div class="ma-tiles">
        ${c.services
          .map(
            (s, i) => `
        <article class="ma-tile reveal d${(i % 3) + 1}">
          ${tiles[i] ? `<div class="ma-tile-img" style="background-image:url('${tiles[i]}')"></div>` : `<div class="ma-tile-img ma-tile-plain"></div>`}
          <h3>${s.title}</h3>
          <p>${s.blurb}</p>
        </article>`,
          )
          .join("")}
      </div>
    </section>

    ${
      c.testimonials.length
        ? `<section class="ma-reviews" id="reviews">
      <span class="ma-over">${c.t.inTheirWords}</span>
      <blockquote class="reveal">${c.testimonials[0]}</blockquote>
      <div class="ma-stars">★★★★★</div>
    </section>`
        : ""
    }

    <section class="ma-about" id="about">
      <div class="ma-about-copy reveal">
        <span class="ma-over">${c.t.aboutOverline}</span>
        <h2>${c.name}</h2>
        <p>${c.t.aboutCopy(c.area, c.label, c.reviewCount)}</p>
      </div>
      ${
        c.hours.length
          ? `<div class="ma-hours reveal d1">
        <span class="ma-over">${c.t.hours}</span>
        <ul>${c.hours.map((h) => `<li>${h}</li>`).join("")}</ul>
      </div>`
          : ""
      }
    </section>

    <section class="ma-contact" id="contact">
      <h2>${c.t.getInTouch}</h2>
      ${c.address ? `<p class="ma-addr">${c.address}</p>` : ""}
      ${c.phone ? `<a class="ma-btn" href="tel:${c.phone}">${c.t.call(c.name)}</a>` : ""}
      ${c.mapImg ? `<div class="ma-map"><img src="${c.mapImg}" alt="" loading="lazy" /></div>` : ""}
      ${CONTACT_FORM_TOKEN}
    </section>

    <footer class="ma-foot">${c.t.footer(c.name, new Date().getFullYear())}</footer>
  </div>
</div>`;
}

export function maisonCss(): string {
  return `
  /* ── MAISON ──────────────────────────────────────────────────────────── */
  /* Warm ground mixed from the palette's accent so every business keeps its own
     colour while the design stays in the cream family the references live in. */
  .design-maison{--ground:color-mix(in srgb,var(--accent) 9%,#f3ece2);
    --card:color-mix(in srgb,var(--accent) 4%,#fffdf9);
    --hair:color-mix(in srgb,var(--text) 12%,transparent);}
  body{background:var(--ground);}
  .ma-page{padding:clamp(10px,1.6vw,26px);}
  /* The rounded shell the whole page floats in — the single most recognisable
     device in both warm references. */
  .ma-card{background:var(--card);border-radius:clamp(18px,2.4vw,34px);overflow:hidden;
    box-shadow:0 40px 90px -50px color-mix(in srgb,var(--text) 45%,transparent),
      0 0 0 1px color-mix(in srgb,var(--text) 7%,transparent);}

  .ma-over{display:block;font-size:11px;letter-spacing:.24em;text-transform:uppercase;
    color:color-mix(in srgb,var(--text) 55%,transparent);margin-bottom:16px;}

  /* pill nav */
  .ma-nav{margin:clamp(12px,1.8vw,22px);padding:12px 14px 12px 24px;
    background:color-mix(in srgb,var(--accent) 7%,#fff);border-radius:999px;
    display:flex;align-items:center;gap:20px;
    box-shadow:0 2px 0 color-mix(in srgb,var(--text) 5%,transparent);}
  .ma-mark{font-family:var(--heading);font-size:19px;letter-spacing:.01em;flex:1;
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .ma-links{display:flex;gap:clamp(12px,2vw,28px);}
  .ma-links a{font-size:14px;color:color-mix(in srgb,var(--text) 68%,transparent);
    transition:color .2s;}
  .ma-links a:hover{color:var(--text);}
  .ma-nav-cta{background:var(--accent);color:var(--accent-text);border-radius:999px;
    padding:11px 24px;font-size:14px;font-weight:600;transition:transform .2s;}
  .ma-nav-cta:hover{transform:translateY(-1px);}

  /* hero */
  .ma-hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);
    align-items:center;gap:clamp(20px,3vw,50px);
    padding:clamp(24px,4vw,64px) 0 clamp(24px,4vw,56px) clamp(24px,4.5vw,72px);}
  .ma-eyebrow{display:block;font-size:11.5px;letter-spacing:.22em;text-transform:uppercase;
    color:color-mix(in srgb,var(--text) 52%,transparent);margin-bottom:20px;}
  .ma-hero h1{font-family:var(--heading);font-size:clamp(36px,5.4vw,80px);line-height:1.02;
    letter-spacing:-.028em;max-width:13ch;}
  .ma-hero h1 em{font-style:normal;color:var(--accent);}
  .ma-rate{margin-top:22px;font-size:14px;color:color-mix(in srgb,var(--text) 62%,transparent);}
  .ma-rate span{color:var(--accent);}
  .ma-btn{display:inline-block;margin-top:clamp(22px,3.4vh,36px);background:var(--accent);
    color:var(--accent-text);padding:16px 34px;border-radius:999px;font-weight:600;font-size:15px;
    transition:transform .2s,box-shadow .2s;
    box-shadow:0 16px 36px -18px color-mix(in srgb,var(--accent) 90%,transparent);}
  .ma-btn:hover{transform:translateY(-2px);}
  /* Feathered bleed, not a cutout: amateur interior shots have no clean subject
     to knock out, so the photo dissolves into the ground instead. */
  .ma-hero-photo{position:relative;aspect-ratio:4/5;border-radius:clamp(14px,2vw,26px) 0 0
    clamp(14px,2vw,26px);overflow:hidden;}
  .ma-hero-photo div{position:absolute;inset:0;background-size:cover;background-position:center;
    -webkit-mask-image:linear-gradient(100deg,transparent 0%,#000 22%);
    mask-image:linear-gradient(100deg,transparent 0%,#000 22%);}

  /* booking strip */
  .ma-bar{margin:0 clamp(16px,3vw,48px);padding:18px clamp(16px,2.4vw,30px);
    background:color-mix(in srgb,var(--accent) 10%,#fff);border-radius:18px;
    display:flex;align-items:center;gap:clamp(16px,3vw,44px);flex-wrap:wrap;}
  .ma-bar div{display:flex;flex-direction:column;gap:3px;min-width:0;}
  .ma-bar span{font-size:11px;letter-spacing:.18em;text-transform:uppercase;
    color:color-mix(in srgb,var(--text) 50%,transparent);}
  .ma-bar strong{font-size:14.5px;font-weight:500;}
  .ma-bar-cta{margin-left:auto;background:var(--text);color:var(--card);border-radius:999px;
    padding:12px 26px;font-size:14px;font-weight:600;white-space:nowrap;}

  /* services */
  .ma-services{padding:clamp(48px,8vh,110px) clamp(24px,4.5vw,72px);}
  .ma-head h2{font-family:var(--heading);font-size:clamp(28px,4vw,52px);letter-spacing:-.024em;
    line-height:1.06;max-width:18ch;}
  .ma-tiles{margin-top:clamp(30px,5vh,56px);display:grid;
    grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:clamp(16px,2.2vw,30px);}
  .ma-tile-img{aspect-ratio:4/5;border-radius:18px;background-size:cover;background-position:center;
    margin-bottom:18px;transition:transform .5s cubic-bezier(.2,.7,.3,1);}
  .ma-tile-plain{background:linear-gradient(150deg,
    color-mix(in srgb,var(--accent) 26%,var(--card)),var(--card));}
  .ma-tile:hover .ma-tile-img{transform:translateY(-5px);}
  .ma-tile h3{font-family:var(--heading);font-size:22px;letter-spacing:-.012em;}
  .ma-tile p{margin-top:7px;font-size:14.5px;line-height:1.6;
    color:color-mix(in srgb,var(--text) 62%,transparent);}

  /* reviews */
  .ma-reviews{padding:clamp(48px,9vh,110px) clamp(24px,4.5vw,72px);text-align:center;
    background:color-mix(in srgb,var(--accent) 8%,transparent);}
  .ma-reviews blockquote{font-family:var(--heading);font-size:clamp(20px,2.8vw,38px);
    line-height:1.3;letter-spacing:-.018em;max-width:min(24ch,92%);margin:0 auto;}
  .ma-stars{margin-top:20px;color:var(--accent);letter-spacing:.16em;font-size:14px;}

  /* about */
  .ma-about{padding:clamp(48px,9vh,110px) clamp(24px,4.5vw,72px);display:grid;
    grid-template-columns:minmax(0,1.3fr) minmax(0,.8fr);gap:clamp(28px,5vw,70px);
    align-items:start;}
  .ma-about h2{font-family:var(--heading);font-size:clamp(26px,3.6vw,46px);
    letter-spacing:-.022em;margin-bottom:18px;}
  .ma-about p{font-size:16.5px;line-height:1.75;
    color:color-mix(in srgb,var(--text) 66%,transparent);max-width:48ch;}
  .ma-hours ul{list-style:none;border-top:1px solid var(--hair);}
  .ma-hours li{padding:11px 0;border-bottom:1px solid var(--hair);font-size:14px;
    color:color-mix(in srgb,var(--text) 62%,transparent);}

  /* contact */
  .ma-contact{padding:clamp(48px,9vh,110px) clamp(24px,4.5vw,72px);}
  .ma-contact h2{font-family:var(--heading);font-size:clamp(28px,4.2vw,54px);
    letter-spacing:-.026em;margin-bottom:18px;}
  .ma-addr{font-size:17px;line-height:1.6;max-width:32ch;
    color:color-mix(in srgb,var(--text) 66%,transparent);}
  .ma-map{margin-top:30px;border-radius:20px;overflow:hidden;border:1px solid var(--hair);}
  .ma-map img{display:block;width:100%;}
  .ma-foot{padding:26px clamp(24px,4.5vw,72px) 34px;border-top:1px solid var(--hair);
    font-size:12.5px;color:color-mix(in srgb,var(--text) 55%,transparent);}

  @media(max-width:900px){
    .ma-hero{grid-template-columns:1fr;padding:clamp(20px,4vw,40px);}
    .ma-hero-photo{aspect-ratio:16/11;border-radius:18px;}
    .ma-hero-photo div{-webkit-mask-image:none;mask-image:none;}
    .ma-about{grid-template-columns:1fr;}
    .ma-links{display:none;}
    .ma-bar-cta{margin-left:0;}
  }

  @media(max-width:430px){
    .ma-hero{padding:18px;border-radius:18px;}
    .ma-nav{margin:10px;padding:10px 10px 10px 16px;}
  }

  @media(prefers-reduced-motion:no-preference){
    .ma-hero h1,.ma-eyebrow,.ma-rate,.ma-hero .ma-btn{
      animation:maUp .95s cubic-bezier(.2,.75,.25,1) backwards;}
    .ma-eyebrow{animation-delay:.04s;}
    .ma-rate{animation-delay:.18s;}
    .ma-hero .ma-btn{animation-delay:.26s;}
    @keyframes maUp{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:none;}}
    .ma-hero-photo div{animation:maDrift 28s ease-in-out infinite alternate;}
    @keyframes maDrift{from{transform:scale(1.03);}to{transform:scale(1.1);}}
    .reveal{opacity:0;transform:translateY(22px);
      transition:opacity .8s cubic-bezier(.2,.7,.3,1),transform .8s cubic-bezier(.2,.7,.3,1);}
    .reveal.in{opacity:1;transform:none;}
    .reveal.d1{transition-delay:.08s;}
    .reveal.d2{transition-delay:.16s;}
    .reveal.d3{transition-delay:.24s;}
  }`;
}
