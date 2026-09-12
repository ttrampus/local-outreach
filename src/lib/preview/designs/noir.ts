// NOIR — dark ground, one hot accent, photography as the centrepiece.
//
// Built from the dark salon references in /home/tim/website designs photos
// (Veloura and similar): near-black page, heavy sans headline with a single word
// in the accent, a large rounded photo panel, a floating social-proof card, and
// service cards on raised dark surfaces.
//
// Two deliberate departures from the references, both forced by reality:
//
//  1. The references run a stat row of big accent numerals — "200+", "15k+",
//     "12+". Those are invented. The only counts we can actually stand behind are
//     the Google rating and its review count, so the stat row carries those and
//     nothing else. Inventing "200+ clients" for a real salon is the exact
//     failure copyPolicy.ts exists to prevent.
//  2. The references are built on studio cutouts on clean backdrops. Real leads
//     have amateur phone photos, so photography sits inside rounded frames with a
//     scrim rather than being knocked out — a crop that flatters bad source shots
//     instead of exposing them.
import type { Ctx } from "../template";

const CONTACT_FORM_TOKEN = "{{CONTACT_FORM}}";

/** Split "Where Beauty Meets Confidence" so the last word can take the accent. */
function accentLast(text: string): string {
  const words = text.trim().split(/\s+/);
  if (words.length < 2) return `<em>${text}</em>`;
  const last = words.pop();
  return `${words.join(" ")} <em>${last}</em>`;
}

export function noirBody(c: Ctx): string {
  const hero = c.heroImg;
  const shots = c.gallery.slice(0, 3);

  return `
<nav class="no-nav">
  <div class="no-nav-in">
    <a class="no-mark" href="#top">${c.name}</a>
    <div class="no-links">
      <a href="#services">${c.t.navServices}</a>
      <a href="#about">${c.t.navAbout}</a>
      ${c.testimonials.length ? `<a href="#reviews">${c.t.navReviews}</a>` : ""}
    </div>
    <a class="no-pill" href="#contact">${c.t.navBook}</a>
  </div>
</nav>

<header class="no-hero" id="top">
  <div class="no-hero-in">
    <div class="no-hero-copy">
      <span class="no-eyebrow">${c.label}${c.area ? ` · ${c.area}` : ""}</span>
      <h1>${accentLast(c.tagline)}</h1>
      <div class="no-hero-cta">
        <a class="no-btn" href="#contact">${c.t.bookNow}</a>
        ${c.phone ? `<a class="no-btn-ghost" href="tel:${c.phone}">${c.phone}</a>` : ""}
      </div>
    </div>
    ${
      hero
        ? `<div class="no-hero-media">
      <div class="no-frame"><div style="background-image:url('${hero}')"></div></div>
      ${
        c.ratingLine
          ? `<div class="no-proof">
        <span class="no-proof-stars">★★★★★</span>
        <span class="no-proof-t">${c.ratingLine}</span>
      </div>`
          : ""
      }
    </div>`
        : ""
    }
  </div>
</header>

${
  c.rating || c.reviewCount
    ? `<section class="no-stats">
  ${c.rating ? `<div><strong>${c.rating}</strong><span>${c.t.rating}</span></div>` : ""}
  ${c.reviewCount ? `<div><strong>${c.reviewCount}</strong><span>${c.t.reviewsWord}</span></div>` : ""}
</section>`
    : ""
}

<section class="no-services" id="services">
  <div class="no-in">
    <div class="no-head">
      <span class="no-over">${c.t.whatWeDo}</span>
      <h2>${c.t.everythingDoneWithCare}</h2>
    </div>
    <div class="no-cards">
      ${c.services
        .map(
          (s, i) => `
      <article class="no-card reveal d${(i % 3) + 1}">
        ${shots[i] ? `<div class="no-card-img" style="background-image:url('${shots[i]}')"></div>` : ""}
        <div class="no-card-body">
          <h3>${s.title}</h3>
          <p>${s.blurb}</p>
        </div>
      </article>`,
        )
        .join("")}
    </div>
  </div>
</section>

${
  c.testimonials.length
    ? `<section class="no-reviews" id="reviews">
  <div class="no-in">
    <span class="no-over">${c.t.inTheirWords}</span>
    <div class="no-quotes">
      ${c.testimonials
        .slice(0, 2)
        .map(
          (t, i) => `
      <figure class="no-quote reveal d${i + 1}">
        <div class="no-stars">★★★★★</div>
        <blockquote>${t}</blockquote>
      </figure>`,
        )
        .join("")}
    </div>
  </div>
</section>`
    : ""
}

<section class="no-about" id="about">
  <div class="no-in no-about-in">
    <div>
      <span class="no-over">${c.t.aboutOverline}</span>
      <h2>${c.name}</h2>
      <p>${c.t.aboutCopy(c.area, c.label, c.reviewCount)}</p>
    </div>
    ${
      c.hours.length
        ? `<ul class="no-hours reveal">${c.hours.map((h) => `<li>${h}</li>`).join("")}</ul>`
        : ""
    }
  </div>
</section>

<section class="no-contact" id="contact">
  <div class="no-in no-contact-in">
    <div class="no-contact-copy">
      <h2>${c.t.getInTouch}</h2>
      ${c.address ? `<p class="no-addr">${c.address}</p>` : ""}
      ${c.phone ? `<a class="no-btn" href="tel:${c.phone}">${c.t.call(c.name)}</a>` : ""}
    </div>
    ${c.mapImg ? `<div class="no-map"><img src="${c.mapImg}" alt="" loading="lazy" /></div>` : ""}
  </div>
  <div class="no-in">${CONTACT_FORM_TOKEN}</div>
</section>

<footer class="no-foot">${c.t.footer(c.name, new Date().getFullYear())}</footer>`;
}

export function noirCss(): string {
  return `
  /* ── NOIR ────────────────────────────────────────────────────────────── */
  /* Its own dark ground rather than the palette's: the whole design depends on a
     near-black field with one hot accent, and half the category palettes are
     light. The accent still comes from the business's palette. */
  .design-noir{--ink:#0c0c11;--ink2:#15151d;--line:rgba(255,255,255,.11);
    --dim:rgba(255,255,255,.62);}
  body{background:var(--ink);color:#fff;}
  .no-in{max-width:1200px;margin:0 auto;padding:0 clamp(18px,4vw,54px);}
  .no-over{display:block;font-size:11px;letter-spacing:.24em;text-transform:uppercase;
    color:var(--accent);margin-bottom:16px;}

  .no-nav{position:fixed;inset:0 0 auto 0;z-index:60;
    transition:background .35s ease,border-color .35s ease;border-bottom:1px solid transparent;}
  .no-nav-in{max-width:1200px;margin:0 auto;padding:18px clamp(18px,4vw,54px);
    display:flex;align-items:center;gap:24px;}
  .no-mark{font-family:var(--heading);font-size:20px;letter-spacing:-.01em;flex:1;
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .no-links{display:flex;gap:clamp(14px,2.2vw,30px);}
  .no-links a{font-size:13.5px;color:var(--dim);transition:color .2s;}
  .no-links a:hover{color:#fff;}
  .no-pill{background:#fff;color:var(--ink);border-radius:999px;padding:10px 22px;
    font-size:13.5px;font-weight:600;transition:transform .2s;}
  .no-pill:hover{transform:translateY(-1px);}
  body.nav-solid .no-nav{background:color-mix(in srgb,var(--ink) 92%,transparent);
    backdrop-filter:blur(12px);border-bottom-color:var(--line);}

  /* hero */
  .no-hero{padding:clamp(104px,15vh,150px) 0 clamp(40px,7vh,80px);}
  .no-hero-in{max-width:1200px;margin:0 auto;padding:0 clamp(18px,4vw,54px);
    display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.05fr);
    gap:clamp(28px,4vw,60px);align-items:center;}
  .no-eyebrow{display:block;font-size:11.5px;letter-spacing:.22em;text-transform:uppercase;
    color:var(--accent);margin-bottom:20px;}
  .no-hero h1{font-family:var(--heading);font-size:clamp(38px,5.4vw,76px);line-height:1.02;
    letter-spacing:-.03em;max-width:14ch;}
  /* The accent word — the single most portable device in the references. */
  .no-hero h1 em{font-style:normal;color:var(--accent);}
  .no-hero-cta{margin-top:clamp(26px,4vh,42px);display:flex;align-items:center;gap:16px;
    flex-wrap:wrap;}
  .no-btn{display:inline-block;background:var(--accent);color:var(--accent-text);
    padding:15px 32px;border-radius:999px;font-weight:600;font-size:14.5px;
    transition:transform .2s,box-shadow .2s;
    box-shadow:0 16px 40px -18px var(--accent);}
  .no-btn:hover{transform:translateY(-2px);}
  .no-btn-ghost{display:inline-block;padding:15px 26px;border-radius:999px;
    border:1px solid var(--line);color:#fff;font-size:14.5px;transition:border-color .2s;}
  .no-btn-ghost:hover{border-color:var(--accent);}

  .no-hero-media{position:relative;}
  .no-frame{border-radius:22px;overflow:hidden;aspect-ratio:5/4;}
  .no-frame div{width:100%;height:100%;background-size:cover;background-position:center;}
  /* Real Google photos are often poorly lit; a slight scrim evens them out. */
  .no-frame::after{content:"";position:absolute;inset:0;border-radius:22px;
    background:linear-gradient(180deg,rgba(0,0,0,.06),rgba(0,0,0,.34));pointer-events:none;}
  .no-proof{position:absolute;left:-14px;bottom:-18px;background:var(--ink2);
    border:1px solid var(--line);border-radius:16px;padding:14px 18px;
    display:flex;flex-direction:column;gap:4px;box-shadow:0 24px 50px -24px #000;}
  .no-proof-stars{color:var(--accent);font-size:13px;letter-spacing:.12em;}
  .no-proof-t{font-size:12.5px;color:var(--dim);}

  /* Only real, verifiable numbers live here — see the note at the top. */
  .no-stats{display:flex;justify-content:center;gap:clamp(40px,9vw,110px);
    padding:clamp(28px,5vh,54px) 0;border-top:1px solid var(--line);
    border-bottom:1px solid var(--line);}
  .no-stats div{text-align:center;}
  .no-stats strong{display:block;font-family:var(--heading);font-size:clamp(30px,4.4vw,56px);
    color:var(--accent);line-height:1;letter-spacing:-.02em;}
  .no-stats span{display:block;margin-top:8px;font-size:11.5px;letter-spacing:.18em;
    text-transform:uppercase;color:var(--dim);}

  /* services */
  .no-services{padding:clamp(56px,10vh,120px) 0;}
  .no-head h2{font-family:var(--heading);font-size:clamp(28px,4vw,52px);letter-spacing:-.024em;
    line-height:1.06;max-width:18ch;}
  .no-cards{margin-top:clamp(32px,5vh,60px);display:grid;
    grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:clamp(14px,2vw,26px);}
  .no-card{background:var(--ink2);border:1px solid var(--line);border-radius:20px;
    overflow:hidden;transition:transform .35s cubic-bezier(.2,.7,.3,1),border-color .35s;}
  .no-card:hover{transform:translateY(-4px);border-color:color-mix(in srgb,var(--accent) 55%,transparent);}
  .no-card-img{aspect-ratio:16/11;background-size:cover;background-position:center;}
  .no-card-body{padding:22px;}
  .no-card h3{font-family:var(--heading);font-size:21px;letter-spacing:-.01em;}
  .no-card p{margin-top:8px;color:var(--dim);font-size:14.5px;line-height:1.6;}

  /* reviews */
  .no-reviews{padding:clamp(48px,9vh,110px) 0;background:var(--ink2);
    border-top:1px solid var(--line);border-bottom:1px solid var(--line);}
  .no-quotes{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));
    gap:clamp(14px,2vw,26px);}
  .no-quote{background:var(--ink);border:1px solid var(--line);border-radius:20px;padding:26px;}
  .no-stars{color:var(--accent);letter-spacing:.14em;font-size:13px;margin-bottom:14px;}
  .no-quote blockquote{font-size:15.5px;line-height:1.65;color:var(--dim);}

  /* about */
  .no-about{padding:clamp(56px,10vh,120px) 0;}
  .no-about-in{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,.85fr);
    gap:clamp(28px,5vw,70px);align-items:start;}
  .no-about h2{font-family:var(--heading);font-size:clamp(26px,3.6vw,46px);letter-spacing:-.022em;
    margin-bottom:18px;}
  .no-about p{color:var(--dim);font-size:16.5px;line-height:1.75;max-width:48ch;}
  .no-hours{list-style:none;border-top:1px solid var(--line);}
  .no-hours li{padding:11px 0;border-bottom:1px solid var(--line);font-size:14px;color:var(--dim);}

  /* contact */
  .no-contact{padding:clamp(48px,9vh,110px) 0 clamp(30px,5vh,60px);}
  .no-contact-in{display:grid;grid-template-columns:minmax(0,1fr);gap:clamp(26px,4vw,56px);
    align-items:center;}
  .no-contact-in:has(.no-map){grid-template-columns:minmax(0,1fr) minmax(0,1fr);}
  .no-contact h2{font-family:var(--heading);font-size:clamp(28px,4.2vw,56px);
    letter-spacing:-.026em;margin-bottom:18px;}
  .no-addr{color:var(--dim);font-size:16.5px;line-height:1.6;margin-bottom:26px;max-width:30ch;}
  .no-map{border-radius:20px;overflow:hidden;border:1px solid var(--line);}
  .no-map img{display:block;width:100%;}
  .no-foot{padding:26px 0 34px;text-align:center;font-size:12.5px;color:var(--dim);
    border-top:1px solid var(--line);}

  @media(max-width:880px){
    .no-hero-in,.no-about-in{grid-template-columns:1fr;}
    .no-contact-in:has(.no-map){grid-template-columns:1fr;}
    .no-links{display:none;}
    .no-proof{left:10px;bottom:-14px;}
  }

  @media(max-width:430px){
    .no-nav-in{padding-inline:16px;}
    .no-proof{position:static;margin-top:18px;}
  }

  @media(prefers-reduced-motion:no-preference){
    .no-hero h1,.no-eyebrow,.no-hero-cta{animation:noUp .95s cubic-bezier(.2,.75,.25,1) backwards;}
    .no-eyebrow{animation-delay:.04s;}
    .no-hero-cta{animation-delay:.2s;}
    @keyframes noUp{from{opacity:0;transform:translateY(22px);}to{opacity:1;transform:none;}}
    .no-hero-media{animation:noIn 1.1s cubic-bezier(.2,.75,.25,1) .12s backwards;}
    @keyframes noIn{from{opacity:0;transform:translateY(28px) scale(.98);}to{opacity:1;transform:none;}}
    .reveal{opacity:0;transform:translateY(22px);
      transition:opacity .8s cubic-bezier(.2,.7,.3,1),transform .8s cubic-bezier(.2,.7,.3,1);}
    .reveal.in{opacity:1;transform:none;}
    .reveal.d1{transition-delay:.08s;}
    .reveal.d2{transition-delay:.16s;}
    .reveal.d3{transition-delay:.24s;}
  }`;
}
