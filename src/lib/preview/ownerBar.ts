// Inject a thin, dismissible "owner bar" into the PUBLIC preview at serve time.
// The generated site's own CTAs point at the business's customers ("Book now"),
// so the prospect viewing their own free mockup has no way to tell US they want it.
// This bar fixes that: it explains the demo, states the offer, and turns a passive
// view into a recorded "I'm interested" signal + a direct way to reach the operator.
//
// IMPORTANT: this is applied ONLY by the /p/ route, never written to the stored
// HTML — so the outreach screenshot (render.ts) stays clean and bar-free.
import { env } from "@/lib/env";
import { PRICING } from "@/lib/pricing";
import { BRAND } from "@/lib/brand";
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
  minimize: string;
  expand: string;
}

const SL: Strings = {
  badge: "Brezplačen predogled",
  title: (name) => `Predlog spletne strani za ${name}`,
  sub: `Izdelava ${PRICING.buildEur} € — nato spremenim vse, kar želite (besedila, fotografije, barve, postavitev), brez doplačila, in stran objavimo na vaši domeni. Za ${PRICING.careMonthlyEur} € / mesec zanjo skrbim naprej.`,
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
  minimize: "Skrij podrobnosti",
  expand: "Prikaži podrobnosti",
};

const EN: Strings = {
  badge: "Free preview",
  title: (name) => `A website proposal for ${name}`,
  sub: `€${PRICING.buildEur} to make it yours — then I change anything you want (text, photos, colours, layout) at no extra charge, and it goes live on your domain. €${PRICING.careMonthlyEur}/month if you'd like me to look after it.`,
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
  minimize: "Hide details",
  expand: "Show details",
};

// The bar is the only thing on a prospect's preview that is ours rather than
// theirs, so it carries the mark — reversed, since the bar is always dark.
// Inline rather than a /brand URL: the same markup is served from this app but
// read on a page that may later be deployed to the customer's own domain.
const MARK = `<svg class="__lo-mark" viewBox="0 0 100 100" width="34" height="34" aria-hidden="true">
  <path d="M6 87 L27 87 L48.5 20 L43 20 Z" fill="${BRAND.paper}"/>
  <path d="M94 87 L73 87 L51.5 20 L57 20 Z" fill="${BRAND.paper}"/>
  <rect x="44.5" y="55" width="11" height="17" rx="2.5" fill="${BRAND.signalLight}"/>
</svg>`;

// `__lo-lead` keeps the mark and the copy as one unit, so the bar stays the
// two-child (copy | action) flex row it was before the mark existed.
const MARK_CSS = `#__lo .__lo-lead{display:flex;gap:13px;align-items:flex-start;min-width:0;}
    #__lo .__lo-mark{flex-shrink:0;margin-top:1px;}
    @media(max-width:620px){#__lo .__lo-mark{display:none;}}`;

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
 *
 * `interestToken` is that same guarantee made server-side. Removing the button
 * only stops the honest path: the endpoint is a plain POST and the ids are
 * published on /examples, so the bar carries a short-lived signature minted by
 * whoever served this page, and the endpoint records nothing without it.
 */
export function injectOwnerBar(
  html: string,
  lead: { id: string; name: string; address: string | null },
  opts: { showcase?: boolean; interestToken?: string | null } = {},
): string {
  if (!env.ownerBar) return html;

  const t = detectLocale({ address: lead.address ?? undefined }) === "sl" ? SL : EN;
  const name = esc(cleanDisplayName(lead.name));
  const hasContact = Boolean(env.ownerEmail || env.ownerPhone || env.ownerBookingUrl);
  const thanks = hasContact ? t.thanksWithContact : t.thanksNoContact;

  if (opts.showcase) return injectShowcaseBar(html, t);

  // Scoped under #__lo so nothing clashes with the generated site's own styles.
  const bar = `
<div id="__lo" data-lead="${esc(lead.id)}" data-tok="${esc(opts.interestToken ?? "")}" role="dialog" aria-label="${esc(t.badge)}">
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

    /* The toggle. A prospect who has read the pitch still wants to look at the
       site underneath it, and on a phone the full bar is a third of the screen.
       Collapsing leaves the one control that matters — "I'm interested" — rather
       than hiding the bar entirely, which "Maybe later" already does.
       
       Pinned to the corner and half outside the panel, the way a dismiss control
       on a dialog is. In the action row it sat next to "Maybe later" and read as
       a third choice about the offer, which it is not — it is a control over the
       panel. Overlapping the edge also keeps it clear of the buttons without
       adding vertical padding, which would undo the point of collapsing. */
    #__lo .__lo-toggle{position:absolute;top:-9px;right:-9px;width:26px;height:26px;
      display:flex;align-items:center;justify-content:center;padding:0;
      background:#0d0f14;border:1px solid rgba(255,255,255,.18);border-radius:999px;
      color:rgba(255,255,255,.6);font-size:11px;line-height:1;z-index:1;
      box-shadow:0 2px 8px rgba(0,0,0,.4);}
    #__lo .__lo-toggle:hover{color:#fff;border-color:rgba(255,255,255,.35);}
    #__lo.__lo-min{width:auto;max-width:calc(100% - 24px);padding:8px 10px 8px 14px;gap:10px;}
    #__lo.__lo-min .__lo-badge,#__lo.__lo-min .__lo-sub,#__lo.__lo-min .__lo-no{display:none;}
    #__lo.__lo-min .__lo-title{font-size:13px;font-weight:600;white-space:nowrap;
      overflow:hidden;text-overflow:ellipsis;}
    #__lo.__lo-min .__lo-yes{font-size:13px;padding:8px 14px;}
    #__lo.__lo-min .__lo-mark{width:24px;height:24px;}

    @media(max-width:620px){#__lo{flex-direction:column;align-items:stretch;gap:12px;}
      #__lo .__lo-actions{justify-content:space-between;}#__lo .__lo-yes{flex:1;}
      /* collapsed stays a single row, or it saves no height at all */
      #__lo.__lo-min{flex-direction:row;align-items:center;gap:8px;}
      #__lo.__lo-min .__lo-yes{flex:0 0 auto;}}
    @media print{#__lo{display:none;}}
    ${MARK_CSS}
  </style>
  <div class="__lo-lead">
    ${MARK}
    <div class="__lo-txt">
      <span class="__lo-badge">${esc(t.badge)}</span>
      <div class="__lo-title">${t.title(name)}</div>
      <div class="__lo-sub">${esc(t.sub)}</div>
      <div class="__lo-contact">${contactLinks(t)}</div>
    </div>
  </div>
  <button type="button" class="__lo-toggle" aria-expanded="true"
    aria-label="${esc(t.minimize)}" title="${esc(t.minimize)}">&#9660;</button>
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

  // Collapsed state survives a reload: someone who shrank the bar to look at the
  // page does not want it back at full height on the next one.
  var MINKEY="__lo_min_"+id,tog=bar.querySelector(".__lo-toggle");
  var LBL=${JSON.stringify({ minimize: t.minimize, expand: t.expand })};
  function setMin(on,persist){
    bar.classList.toggle("__lo-min",on);
    tog.innerHTML=on?"&#9650;":"&#9660;";
    tog.setAttribute("aria-expanded",on?"false":"true");
    tog.setAttribute("aria-label",on?LBL.expand:LBL.minimize);
    tog.setAttribute("title",on?LBL.expand:LBL.minimize);
    if(persist){try{localStorage.setItem(MINKEY,on?"1":"0");}catch(e){}}
  }
  var wasMin=false;try{wasMin=localStorage.getItem(MINKEY)==="1";}catch(e){}
  if(wasMin)setMin(true,false);
  tog.addEventListener("click",function(){setMin(!bar.classList.contains("__lo-min"),true);});
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
    fetch("/api/p/"+id+"/interest",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({token:bar.getAttribute("data-tok")})}).catch(function(){});
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
    ${MARK_CSS}
  </style>
  <div class="__lo-lead">
    ${MARK}
    <div class="__lo-txt">
      <span class="__lo-badge">${esc(t.showcaseBadge)}</span>
      <div class="__lo-title">${esc(t.showcaseTitle)}</div>
      <div class="__lo-sub">${esc(t.showcaseSub)}</div>
    </div>
  </div>
  <a class="__lo-yes" href="/#contact">${esc(t.showcaseCta)} →</a>
</div>`;

  return html.includes("</body>") ? html.replace("</body>", `${bar}\n</body>`) : html + bar;
}
