// Inject a thin, dismissible "owner bar" into the PUBLIC preview at serve time.
// The generated site's own CTAs point at the business's customers ("Book now"),
// so the prospect viewing their own free mockup has no way to tell US they want it.
// This bar fixes that: it explains the demo, states the offer, and turns a passive
// view into a recorded "I'm interested" signal + a direct way to reach the operator.
//
// IMPORTANT: this is applied ONLY by the /p/ route, never written to the stored
// HTML — so the outreach screenshot (render.ts) stays clean and bar-free.
import { env } from "@/lib/env";
import { detectLocale } from "./i18n";
import { cleanDisplayName } from "./brand";

interface Strings {
  badge: string;
  title: (name: string) => string;
  sub: string;
  yes: string;
  later: string;
  thanksWithContact: string;
  thanksNoContact: string;
  call: string;
  email: string;
  book: string;
  // Shown instead of the above when the page is reached from the public
  // portfolio rather than from a prospect's own outreach email.
  showcaseBadge: string;
  showcaseTitle: string;
  showcaseSub: string;
  showcaseCta: string;
}

const SL: Strings = {
  badge: "Brezplačen predogled",
  title: (name) => `Predlog spletne strani za ${name}`,
  sub: "Vam je všeč? V živo v 24 urah — 50 € / mesec, vključno z vsemi spremembami. Odpoved kadar koli.",
  yes: "Zanima me",
  later: "Mogoče kasneje",
  thanksWithContact: "Hvala! Kmalu se oglasim. Lahko pa me kontaktirate tudi neposredno:",
  thanksNoContact: "Hvala! Kmalu se oglasim.",
  call: "Pokličite",
  email: "E-pošta",
  book: "Rezervirajte klic",
  showcaseBadge: "Primer iz portfelja",
  showcaseTitle: "Želite takšno spletno stran?",
  showcaseSub: "Za vaše podjetje jo pripravimo brezplačno — plačate šele, če vam je všeč.",
  showcaseCta: "Želim takšno",
};

const EN: Strings = {
  badge: "Free preview",
  title: (name) => `A website proposal for ${name}`,
  sub: "Like it? Live in 24 hours — €50/month, all changes included. Cancel anytime.",
  yes: "I'm interested",
  later: "Maybe later",
  thanksWithContact: "Thanks! I'll be in touch. You can also reach me directly:",
  thanksNoContact: "Thanks! I'll be in touch.",
  call: "Call",
  email: "Email",
  book: "Book a call",
  showcaseBadge: "Portfolio example",
  showcaseTitle: "Want a site like this?",
  showcaseSub: "We build one for your business free — you only pay if you like it.",
  showcaseCta: "I want one",
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Build the contact links revealed after a prospect taps "I'm interested". */
function contactLinks(t: Strings): string {
  const parts: string[] = [];
  if (env.ownerBookingUrl)
    parts.push(`<a href="${esc(env.ownerBookingUrl)}" target="_blank" rel="noopener">${t.book}</a>`);
  if (env.ownerEmail)
    parts.push(`<a href="mailto:${esc(env.ownerEmail)}">${t.email}: ${esc(env.ownerEmail)}</a>`);
  if (env.ownerPhone)
    parts.push(`<a href="tel:${esc(env.ownerPhone.replace(/\s+/g, ""))}">${t.call}: ${esc(env.ownerPhone)}</a>`);
  return parts.join("");
}

/**
 * Return `html` with the owner bar inserted before </body>. Off (returns html
 * unchanged) when OWNER_BAR=off. The bar self-hides if the visitor previously
 * dismissed it (localStorage), and posts interest to /api/p/:leadId/interest.
 *
 * `showcase` swaps that for a generic CTA. The same preview is reachable two
 * ways — from the prospect's own outreach email, and from the public portfolio —
 * and only the first of those is the business being pitched. Leaving the real
 * bar on the portfolio route would let any passing stranger mark someone else's
 * live prospect as interested.
 */
export function injectOwnerBar(
  html: string,
  lead: { id: string; name: string; address: string | null },
  opts: { showcase?: boolean } = {},
): string {
  if (!env.ownerBar) return html;

  const t = detectLocale({ address: lead.address ?? undefined }) === "sl" ? SL : EN;
  const name = esc(cleanDisplayName(lead.name));
  const hasContact = Boolean(env.ownerEmail || env.ownerPhone || env.ownerBookingUrl);
  const thanks = hasContact ? t.thanksWithContact : t.thanksNoContact;

  if (opts.showcase) return injectShowcaseBar(html, t);

  // Scoped under #__lo so nothing clashes with the generated site's own styles.
  const bar = `
<div id="__lo" data-lead="${esc(lead.id)}" role="dialog" aria-label="${esc(t.badge)}">
  <style>
    #__lo{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:2147483000;
      width:min(680px,calc(100% - 24px));box-sizing:border-box;
      background:#0d0f14;color:#fff;border:1px solid rgba(255,255,255,.14);border-radius:16px;
      box-shadow:0 24px 60px -20px rgba(0,0,0,.6);
      font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
      padding:16px 18px;display:flex;gap:16px;align-items:center;justify-content:space-between;
      animation:__loUp .5s cubic-bezier(.2,.75,.25,1) both;}
    @keyframes __loUp{from{opacity:0;transform:translate(-50%,16px);}to{opacity:1;transform:translate(-50%,0);}}
    #__lo .__lo-txt{min-width:0;}
    #__lo .__lo-badge{display:inline-block;font-size:10px;letter-spacing:.16em;text-transform:uppercase;
      color:#9aa3b2;margin-bottom:4px;}
    #__lo .__lo-title{font-weight:700;font-size:15px;line-height:1.25;}
    #__lo .__lo-sub{font-size:13px;color:rgba(255,255,255,.74);line-height:1.4;margin-top:3px;}
    #__lo .__lo-actions{display:flex;gap:10px;align-items:center;flex-shrink:0;}
    #__lo button{font:inherit;cursor:pointer;border-radius:999px;border:0;white-space:nowrap;}
    #__lo .__lo-yes{background:#fff;color:#0d0f14;font-weight:600;font-size:14px;padding:11px 20px;}
    #__lo .__lo-no{background:transparent;color:rgba(255,255,255,.6);font-size:13px;padding:11px 8px;}
    #__lo .__lo-contact{display:none;flex-wrap:wrap;gap:6px 14px;margin-top:8px;font-size:13px;}
    #__lo .__lo-contact a{color:#8ab4ff;text-decoration:none;}
    #__lo.__lo-done .__lo-actions{display:none;}
    #__lo.__lo-done .__lo-sub{display:none;}
    #__lo.__lo-done .__lo-contact{display:flex;}
    @media(max-width:620px){#__lo{flex-direction:column;align-items:stretch;gap:12px;}
      #__lo .__lo-actions{justify-content:space-between;}#__lo .__lo-yes{flex:1;}}
    @media print{#__lo{display:none;}}
  </style>
  <div class="__lo-txt">
    <span class="__lo-badge">${esc(t.badge)}</span>
    <div class="__lo-title">${t.title(name)}</div>
    <div class="__lo-sub">${esc(t.sub)}</div>
    <div class="__lo-contact">${contactLinks(t)}</div>
  </div>
  <div class="__lo-actions">
    <button type="button" class="__lo-no">${esc(t.later)}</button>
    <button type="button" class="__lo-yes">${esc(t.yes)}</button>
  </div>
</div>
<script>
(function(){
  var bar=document.getElementById("__lo");if(!bar)return;
  var id=bar.getAttribute("data-lead");
  var KEY="__lo_dismissed_"+id;
  try{if(localStorage.getItem(KEY)==="1"){bar.parentNode.removeChild(bar);return;}}catch(e){}
  var done=false;try{done=localStorage.getItem("__lo_interested_"+id)==="1";}catch(e){}
  if(done)bar.classList.add("__lo-done");
  var thanks=${JSON.stringify(thanks)};
  bar.querySelector(".__lo-no").addEventListener("click",function(){
    try{localStorage.setItem(KEY,"1");}catch(e){}
    bar.style.transition="opacity .3s,transform .3s";bar.style.opacity="0";bar.style.transform="translate(-50%,16px)";
    setTimeout(function(){if(bar.parentNode)bar.parentNode.removeChild(bar);},300);
  });
  bar.querySelector(".__lo-yes").addEventListener("click",function(){
    bar.querySelector(".__lo-title").textContent=thanks;
    bar.classList.add("__lo-done");
    try{localStorage.setItem("__lo_interested_"+id,"1");}catch(e){}
    fetch("/api/p/"+id+"/interest",{method:"POST",headers:{"Content-Type":"application/json"}}).catch(function(){});
  });
})();
</script>`;

  return html.includes("</body>") ? html.replace("</body>", `${bar}\n</body>`) : html + bar;
}

/**
 * The portfolio variant: no lead id, no interest endpoint, no localStorage — a
 * plain link back to the marketing page. Deliberately scriptless, since there is
 * nothing here to record.
 */
function injectShowcaseBar(html: string, t: Strings): string {
  const bar = `
<div id="__lo" role="dialog" aria-label="${esc(t.showcaseBadge)}">
  <style>
    #__lo{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:2147483000;
      width:min(680px,calc(100% - 24px));box-sizing:border-box;
      background:#0d0f14;color:#fff;border:1px solid rgba(255,255,255,.14);border-radius:16px;
      box-shadow:0 24px 60px -20px rgba(0,0,0,.6);
      font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
      padding:16px 18px;display:flex;gap:16px;align-items:center;justify-content:space-between;
      animation:__loUp .5s cubic-bezier(.2,.75,.25,1) both;}
    @keyframes __loUp{from{opacity:0;transform:translate(-50%,16px);}to{opacity:1;transform:translate(-50%,0);}}
    #__lo .__lo-badge{display:inline-block;font-size:10px;letter-spacing:.16em;text-transform:uppercase;
      color:#9aa3b2;margin-bottom:4px;}
    #__lo .__lo-title{font-weight:700;font-size:15px;line-height:1.25;}
    #__lo .__lo-sub{font-size:13px;color:rgba(255,255,255,.74);line-height:1.4;margin-top:3px;}
    #__lo .__lo-yes{display:inline-block;text-decoration:none;background:#fff;color:#0d0f14;
      font-weight:600;font-size:14px;padding:11px 20px;border-radius:999px;white-space:nowrap;flex-shrink:0;}
    @media(max-width:620px){#__lo{flex-direction:column;align-items:stretch;gap:12px;}
      #__lo .__lo-yes{text-align:center;}}
    @media print{#__lo{display:none;}}
  </style>
  <div class="__lo-txt">
    <span class="__lo-badge">${esc(t.showcaseBadge)}</span>
    <div class="__lo-title">${esc(t.showcaseTitle)}</div>
    <div class="__lo-sub">${esc(t.showcaseSub)}</div>
  </div>
  <a class="__lo-yes" href="/#contact">${esc(t.showcaseCta)} →</a>
</div>`;

  return html.includes("</body>") ? html.replace("</body>", `${bar}\n</body>`) : html + bar;
}
