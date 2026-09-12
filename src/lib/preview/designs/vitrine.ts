// VITRINE — split screen: a fixed photographic panel beside a scrolling column.
//
// The third distinct structure. Atelier scrolls as one column of full-width
// sections; Kiosk is a magazine cover. This one holds a full-height image still
// on the left while the content moves past it on the right, with the category set
// vertically up the gutter. The stillness is the effect — the photograph behaves
// like a shop window you are walking along, which is why it suits businesses whose
// room is the product.
//
// Same prohibitions as the others: no numbered lists, no card grids, no icon sets,
// no blurred colour gradients.
import type { Ctx } from "../template";

const CONTACT_FORM_TOKEN = "{{CONTACT_FORM}}";

export function vitrineBody(c: Ctx): string {
  const still = c.heroImg;
  const rest = c.gallery.slice(0, 4);

  return `
<div class="vi-shell">
  <aside class="vi-still${still ? "" : " no-photo"}">
    ${still ? `<div class="vi-still-img" style="background-image:url('${still}')"></div>` : ""}
    <div class="vi-rail"><span>${c.label}${c.area ? ` — ${c.area}` : ""}</span></div>
    <div class="vi-still-cap">
      <span class="vi-mark">${c.name}</span>
      ${c.ratingLine ? `<span class="vi-rate">${c.ratingLine}</span>` : ""}
    </div>
  </aside>

  <main class="vi-col">
    <nav class="vi-nav">
      <a href="#services">${c.t.navServices}</a>
      <a href="#about">${c.t.navAbout}</a>
      ${c.testimonials.length ? `<a href="#reviews">${c.t.navReviews}</a>` : ""}
      <a href="#contact" class="vi-nav-cta">${c.t.navBook}</a>
    </nav>

    <section class="vi-intro" id="top">
      <h1>${c.rawName}</h1>
      <p class="vi-tag">${c.tagline}</p>
      <a class="vi-btn" href="#contact">${c.t.bookNow}</a>
    </section>

    <section class="vi-block" id="services">
      <span class="vi-over">${c.t.whatWeDo}</span>
      <div class="vi-serv">
        ${c.services
          .map(
            (s) => `
        <article class="reveal">
          <h3>${s.title}</h3>
          <p>${s.blurb}</p>
        </article>`,
          )
          .join("")}
      </div>
    </section>

    ${
      rest.length
        ? `<section class="vi-shots">
      ${rest
        .map(
          (img, i) =>
            `<figure class="reveal d${(i % 3) + 1}" style="background-image:url('${img}')"></figure>`,
        )
        .join("")}
    </section>`
        : ""
    }

    ${
      c.testimonials.length
        ? `<section class="vi-block vi-quote" id="reviews">
      <span class="vi-over">${c.t.inTheirWords}</span>
      <blockquote class="reveal">${c.testimonials[0]}</blockquote>
    </section>`
        : ""
    }

    <section class="vi-block" id="about">
      <span class="vi-over">${c.t.aboutOverline}</span>
      <p class="vi-about">${c.t.aboutCopy(c.area, c.label, c.reviewCount)}</p>
      ${
        c.hours.length
          ? `<ul class="vi-hours reveal">${c.hours.map((h) => `<li>${h}</li>`).join("")}</ul>`
          : ""
      }
    </section>

    <section class="vi-block vi-contact" id="contact">
      <span class="vi-over">${c.t.comeSayHello}</span>
      ${c.address ? `<p class="vi-addr">${c.address}</p>` : ""}
      ${c.phone ? `<a class="vi-tel" href="tel:${c.phone}">${c.phone}</a>` : ""}
      ${c.mapImg ? `<div class="vi-map"><img src="${c.mapImg}" alt="" loading="lazy" /></div>` : ""}
      ${CONTACT_FORM_TOKEN}
    </section>

    <footer class="vi-foot">${c.t.footer(c.name, new Date().getFullYear())}</footer>
  </main>
</div>`;
}

export function vitrineCss(): string {
  return `
  /* ── VITRINE ─────────────────────────────────────────────────────────── */
  body{background:var(--bg);color:var(--text);}
  .vi-shell{display:grid;grid-template-columns:minmax(0,44%) minmax(0,56%);}

  /* The still half. position:sticky rather than fixed so it stops with the
     document instead of floating over the footer. */
  .vi-still{position:sticky;top:0;height:100svh;overflow:hidden;background:var(--text);}
  .vi-still-img{position:absolute;inset:0;background-size:cover;background-position:center;}
  .vi-still::after{content:"";position:absolute;inset:0;
    background:linear-gradient(180deg,rgba(0,0,0,.42),rgba(0,0,0,.05) 40%,rgba(0,0,0,.62));}
  .vi-still.no-photo{background:
    linear-gradient(170deg,color-mix(in srgb,var(--accent) 26%,var(--text)),var(--text));}

  /* Category set vertically up the gutter — the detail that makes the split read
     as designed rather than as two columns that happen to sit together. */
  .vi-rail{position:absolute;z-index:2;left:22px;top:0;bottom:0;display:flex;align-items:center;}
  .vi-rail span{writing-mode:vertical-rl;transform:rotate(180deg);font-size:11px;
    letter-spacing:.34em;text-transform:uppercase;color:rgba(255,255,255,.72);white-space:nowrap;}
  .vi-still-cap{position:absolute;z-index:2;left:56px;right:28px;bottom:30px;color:#fff;
    display:flex;flex-direction:column;gap:6px;}
  .vi-mark{font-family:var(--heading);font-size:clamp(18px,2vw,26px);line-height:1.1;}
  .vi-rate{font-size:11.5px;letter-spacing:.16em;text-transform:uppercase;opacity:.8;}

  /* The moving half */
  .vi-col{min-width:0;padding:0 clamp(22px,4.5vw,76px);}
  .vi-nav{display:flex;align-items:center;justify-content:flex-end;gap:clamp(14px,2vw,28px);
    padding:26px 0;}
  .vi-nav a{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);
    transition:color .2s;}
  .vi-nav a:hover{color:var(--text);}
  .vi-nav-cta{color:var(--text);border-bottom:1px solid var(--accent);padding-bottom:3px;}

  /* Not a full viewport of near-empty column: the name, the line and the button
     were floating in the middle of ~800px of nothing, which wastes the one screen
     everyone sees. Sized to its content with generous but finite padding, so the
     first services already peek above the fold. */
  .vi-intro{display:flex;flex-direction:column;justify-content:center;
    align-items:flex-start;padding:clamp(40px,9vh,90px) 0 clamp(36px,7vh,72px);}
  .vi-intro h1{font-family:var(--heading);font-size:clamp(38px,5.6vw,86px);line-height:.98;
    letter-spacing:-.03em;max-width:12ch;}
  .vi-tag{margin-top:22px;font-size:clamp(15px,1.4vw,19px);color:var(--muted);max-width:34ch;
    line-height:1.6;}
  .vi-btn{margin-top:34px;display:inline-block;background:var(--accent);color:var(--accent-text);
    padding:15px 32px;font-size:14px;font-weight:600;letter-spacing:.02em;border-radius:2px;
    transition:transform .22s;}
  .vi-btn:hover{transform:translateY(-2px);}

  .vi-block{padding:clamp(54px,9vh,110px) 0;border-top:1px solid var(--border);}
  .vi-over{display:block;font-size:11px;letter-spacing:.24em;text-transform:uppercase;
    color:var(--muted);margin-bottom:clamp(22px,3.6vh,40px);}

  .vi-serv article{padding:clamp(18px,2.6vh,26px) 0;border-bottom:1px solid var(--border);}
  .vi-serv article:last-child{border-bottom:0;}
  .vi-serv h3{font-family:var(--heading);font-size:clamp(20px,2.4vw,30px);letter-spacing:-.015em;
    line-height:1.14;}
  .vi-serv p{margin-top:8px;color:var(--muted);font-size:15px;line-height:1.6;max-width:44ch;}

  .vi-shots{display:grid;grid-template-columns:1fr 1fr;gap:clamp(8px,1.1vw,14px);
    padding-bottom:clamp(20px,4vh,44px);}
  .vi-shots figure{aspect-ratio:4/5;background-size:cover;background-position:center;
    border-radius:2px;}
  .vi-shots figure:first-child:nth-last-child(odd){grid-column:span 2;aspect-ratio:16/10;}

  .vi-quote blockquote{font-family:var(--heading);font-size:clamp(21px,2.7vw,36px);
    line-height:1.28;letter-spacing:-.018em;max-width:22ch;}
  .vi-quote blockquote::before{content:"“";color:var(--accent);}
  .vi-quote blockquote::after{content:"”";color:var(--accent);}

  .vi-about{font-size:clamp(16px,1.4vw,18px);line-height:1.75;color:var(--muted);max-width:48ch;}
  .vi-hours{list-style:none;margin-top:30px;border-top:1px solid var(--border);max-width:38ch;}
  .vi-hours li{padding:10px 0;border-bottom:1px solid var(--border);font-size:14px;
    color:var(--muted);}

  .vi-addr{font-size:17px;line-height:1.6;max-width:30ch;}
  .vi-tel{display:inline-block;margin-top:14px;font-family:var(--heading);
    font-size:clamp(22px,2.6vw,34px);border-bottom:1px solid var(--accent);padding-bottom:4px;}
  .vi-map{margin-top:32px;border-radius:2px;overflow:hidden;border:1px solid var(--border);}
  .vi-map img{display:block;width:100%;}
  .vi-foot{padding:26px 0 34px;border-top:1px solid var(--border);font-size:12px;
    color:var(--muted);letter-spacing:.04em;}

  /* Below the split threshold the still becomes a normal banner. */
  @media(max-width:900px){
    .vi-shell{grid-template-columns:1fr;}
    .vi-still{position:relative;height:62svh;}
    .vi-intro{min-height:auto;padding:44px 0 10px;}
    .vi-rail{display:none;}
    .vi-still-cap{left:24px;}
  }

  /* Small phones: the paired shots become a single column, and the still gives
     back some height so the copy under it is reachable without a long scroll. */
  /* Below this the four nav links are 19px-tall targets crowded into one row.
     The shared mobile sheet takes them over — see revealScript() in template.ts. */
  @media(max-width:700px){
    .vi-nav a:not(.vi-nav-cta){display:none;}
    .vi-nav{justify-content:space-between;padding:16px 0;}
  }
  @media(max-width:430px){
    .vi-shots{grid-template-columns:1fr;}
    .vi-still{height:52svh;}
    .vi-still-cap{left:16px;right:16px;}
  }

  @media(prefers-reduced-motion:no-preference){
    .vi-still-img{animation:viHold 30s ease-in-out infinite alternate;}
    @keyframes viHold{from{transform:scale(1.03);}to{transform:scale(1.1);}}
    .vi-intro h1,.vi-tag,.vi-btn{animation:viUp .95s cubic-bezier(.2,.75,.25,1) backwards;}
    .vi-tag{animation-delay:.12s;}
    .vi-btn{animation-delay:.22s;}
    @keyframes viUp{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:none;}}
  }`;
}
