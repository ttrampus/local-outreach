// Single source of truth for the parts of templates/*.html that are shared.
//
// Each template is a standalone file by design (README.md: "no build step"), but
// three blocks inside them are byte-identical across all ten and have to stay
// that way: the LocalSite core styles, the responsive foundation, and the mobile
// nav runtime. Editing ten copies by hand is how they drift. This script owns
// those blocks and writes them into every template between marker comments.
//
//   node scripts/sync-template-core.mjs          # write
//   node scripts/sync-template-core.mjs --check  # verify, non-zero if stale
//
// The templates stay standalone: this only edits them in place, it is not a
// build step and nothing at runtime depends on it.
import { readFile, writeFile } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import path from "node:path";

const TEMPLATE_DIR = path.join(process.cwd(), "templates");

// ---------------------------------------------------------------------------
// The responsive foundation.
//
// These pages are generated: every visible string, photo and list length comes
// from a lead's Google data, so the layout has to survive content the template
// was never drawn with — a 60-character business name, an email address with no
// spaces in it, two services or twelve, a portrait photo in a landscape frame.
// The rules below are what make that true for all ten templates at once.
//
// Everything is wrapped in :where() so it carries zero specificity — a template
// that wants different behaviour just states it normally and wins.
// ---------------------------------------------------------------------------
const FOUNDATION_CSS = `/* Nothing scrolls sideways, ever. clip rather than hidden: hidden would turn the
   root into a scroll container and break every position:sticky inside the page. */
html{overflow-x:clip}
body{overflow-x:clip;max-width:100%}

/* Media is fluid regardless of the source file's real dimensions. Google photos
   arrive at whatever size the uploader's phone produced. */
:where(img,svg,video,canvas,iframe,embed,object){max-width:100%}
:where(img,video){height:auto}
/* …except cover-fitted photos, which must keep filling their frame. */
.ls-img,.ls-ph>img{height:100%}

/* The classic grid/flex blowout: children default to min-width:auto, so one long
   unbroken word makes its track wider than the share it was given, and the whole
   row overflows. Opting the structural elements out of that is what lets the
   tracks actually honour 1fr. */
:where(main,section,article,div,aside,header,footer,ul,ol,li,figure,figcaption,
p,h1,h2,h3,h4,h5,h6,blockquote,dl,dt,dd,form,label,fieldset,a){min-width:0}

/* Long words break instead of overflowing. break-word leaves intrinsic sizing
   alone, so normal prose is unaffected. */
:where(h1,h2,h3,h4,h5,h6,p,li,blockquote,figcaption,dd,dt,td,th,small,label,
summary,address){overflow-wrap:break-word}

/* Nav labels are one or two fixed words from the template — never lead data.
   Holding them on one line is what makes the rule below safe to state without
   exceptions: with "break anywhere" and no nowrap, a nav link in a flex row can
   shrink to one character per line and stack "Storitve" vertically. The
   wordmark is excluded from the nowrap, because that one IS the business name. */
:where(nav) :where(a):not(:where(.brand,.logo,.mark,.wordmark)){white-space:nowrap}
/* …except where a nav link carries lead data. t04's drawer prints the street
   under each label, and white-space INHERITS — so the nowrap above reached the
   address and silently defeated the overflow-wrap rule below it, which is why
   a long street ran 50px past the drawer. Template labels (data-t) keep the
   nowrap; fields filled from the lead (data-bind, data-f) get wrapping back. */
:where(nav) :where([data-bind],[data-f]){white-space:normal}
/* Everything carrying lead data may break mid-word rather than overflow.
   "anywhere" also lowers the element's min-content width, which is what stops a
   long name from forcing a grid track or a flex row open.
   The wordmark classes are here because they are where this actually bites: the
   header and footer both print the business name, at display size, in a cell
   sized for "Tamara" — and a 43-character name ran 500px past the viewport. */
:where([data-bind],[data-t],[data-f],[data-fit],
.brand,.logo,.mark,.wordmark,
a[href^="mailto:"],a[href^="http"]){overflow-wrap:anywhere}
/* Footers carry the legal business name ("… Marjana Kovačič Novak s.p."), the
   address and the year in one inline run — the longest unbreakable string on the
   page, and the last place anyone looks. */
:where(footer),:where(footer) *{overflow-wrap:anywhere}
/* A call link comes in two shapes. Most are a prose label that includes the
   business name ("Pokliči Frizerski studio Tamara"), and those must be able to
   break an over-long word. It has to be "anywhere" and not "break-word":
   break-word does not lower min-content width, so the button still pushes its
   column open and overflows. */
:where(a[href^="tel:"]),:where(a[href^="tel:"]) *{overflow-wrap:anywhere}
/* A field bound to the phone number and nothing else is the exception, stated
   last so it wins: it wraps at the spaces between digit groups, never inside
   one. This is also what stops the nav's phone collapsing to a 24px column. */
:where([data-bind="phone"],[data-f="phone"]){overflow-wrap:normal;word-break:normal}
/* Headings that hold a business name hyphenate rather than break mid-syllable
   where the language has hyphenation rules. */
:where(h1,h2,h3)[data-bind],:where(h1,h2,h3)[data-t],:where(h1,h2,h3)[data-fit]{hyphens:auto}

/* Tables and any deliberately wide block scroll inside themselves rather than
   widening the page. */
:where(table){width:100%;border-collapse:collapse}
.ls-scroll-x{overflow-x:auto;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain}

/* Touch. Under the nav's collapse point every control is at least 44px in the
   direction it is tapped. Stated with :where() so a template can opt out, and as
   min-height rather than padding so it never changes a deliberate text size. */
@media (max-width:900px){
  :where(.btn,.pill,.btn-o,.ghost,.tab,.cta,.big,.brand,.logo,button,[role="button"],
  a[href^="tel:"],a[href^="mailto:"],input[type="submit"],input[type="button"]){min-height:44px}
  /* The templates' text-link treatments — an arrow link, an underlined link, a
     small caps link. They are real destinations, styled at 18–25px tall, which
     is under the tap target minimum on every one of them. */
  :where(a.link,a.arrow,a.mark,a.keep,a.ul,a.more,a.back){min-height:44px;
    display:inline-flex;align-items:center}
  :where(.callbar) :where(a,button){min-height:48px}
  /* Nav links are still on screen on a tablet — several templates collapse at
     760px, so 768 shows the desktop bar on a touch device, at 35px tall. Footer
     links get breathing room rather than a height, since they wrap in prose. */
  :where(nav) :where(a){min-height:44px;display:inline-flex;align-items:center}
  :where(.foot,.footer) :where(a){padding-block:2px}
}

/* Form controls: 16px is the threshold under which iOS Safari zooms the viewport
   on focus, which reads to the visitor as the page jumping. */
:where(input,select,textarea){font:inherit;max-width:100%}
@media (max-width:900px){
  :where(input,select,textarea):where(:not([type=checkbox]):not([type=radio])){font-size:16px;min-height:44px}
}

/* Mobile nav sheet. Injected by the runtime below only when a template's own nav
   links have been hidden by that template's breakpoint, so each template keeps
   its own collapse point. It borrows the page's colours through inherit and
   currentColor, so it looks native to whichever template it lands in. */
/* Anchored to the header's top-right corner rather than appended to its flow.
   The ten headers are a grid, a flex row and a plain block in different files —
   appending a child to a two-column grid pushes the button onto a row of its own
   and opens a band of empty header under the logo. Taking it out of flow is the
   only placement that is correct in all of them. position:relative on a static
   block header changes nothing else. */
.ls-navtoggle{display:none;position:absolute;top:50%;right:clamp(12px,4vw,26px);
  transform:translateY(-50%);z-index:5;align-items:center;justify-content:center;
  width:44px;height:44px;padding:0;border:0;background:none;color:inherit;
  font:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent}
.ls-navtoggle.is-on{display:inline-flex}
/* Once the burger is showing, the header's own action button is redundant — every
   template already pins a call/directions bar to the bottom of the screen at this
   width, and the sheet repeats the phone number. Dropping it is what stops the
   absolutely-positioned burger landing on top of it. */
header.ls-nav-collapsed :where(.btn,.pill,.btn-o,.cta,.ghost,
a[href^="tel:"],a[href^="mailto:"]){display:none}
.ls-navtoggle span{position:relative;display:block;width:22px;height:1.5px;background:currentColor;
  transition:transform .25s,background-color .25s}
.ls-navtoggle span::before,.ls-navtoggle span::after{content:"";position:absolute;left:0;width:22px;
  height:1.5px;background:currentColor;transition:transform .25s,top .25s}
.ls-navtoggle span::before{top:-7px}
.ls-navtoggle span::after{top:7px}
.ls-navtoggle[aria-expanded="true"] span{background:transparent}
.ls-navtoggle[aria-expanded="true"] span::before{top:0;transform:rotate(45deg)}
.ls-navtoggle[aria-expanded="true"] span::after{top:0;transform:rotate(-45deg)}

.ls-navsheet{position:fixed;inset:0;z-index:90;display:flex;flex-direction:column;
  padding:max(76px,env(safe-area-inset-top)) 24px calc(28px + env(safe-area-inset-bottom));
  background:var(--ls-sheet-bg,Canvas);color:var(--ls-sheet-fg,CanvasText);
  overflow-y:auto;overscroll-behavior:contain;
  opacity:0;visibility:hidden;transform:translateY(-8px);
  transition:opacity .22s ease,transform .22s ease,visibility .22s}
.ls-navsheet.is-open{opacity:1;visibility:visible;transform:none}
.ls-navsheet a{display:block;padding:14px 0;font-size:clamp(20px,6vw,28px);line-height:1.2;
  border-bottom:1px solid color-mix(in srgb,currentColor 16%,transparent)}
/* The toggle sits inside the header, below the sheet in paint order, and several
   templates give that header a backdrop-filter — which makes it the containing
   block for anything fixed inside it, so raising the toggle's z-index is not
   reliably enough to lift it above the sheet. The sheet carries its own close
   button instead. */
.ls-navsheet .ls-navsheet-close{position:absolute;top:16px;right:18px;width:44px;height:44px;
  display:flex;align-items:center;justify-content:center;padding:0;border:0;background:none;
  color:inherit;font:300 30px/1 system-ui,sans-serif;cursor:pointer;opacity:.7}
.ls-navsheet .ls-navsheet-close:hover{opacity:1}
.ls-navsheet .ls-navsheet-foot{margin-top:auto;padding-top:28px;display:grid;gap:12px}
.ls-navsheet .ls-navsheet-foot a{border:0;padding:0;font-size:clamp(17px,4.4vw,20px);opacity:.75}
html.ls-navopen{overflow:hidden}
@media (min-width:901px){.ls-navsheet{display:none}}
`;

// ---------------------------------------------------------------------------
// The mobile nav runtime.
//
// Deliberately breakpoint-free: it asks the DOM whether the template's own nav
// links are currently hidden. The ten templates collapse at 600–1000px and each
// of those points was chosen for that layout, so hard-coding one here would
// either show a burger beside visible links or hide navigation entirely.
// ---------------------------------------------------------------------------
const NAV_JS = `(function () {
  var doc = document;
  var header = doc.querySelector('header');
  if (!header) return;

  /* Two templates ship a mobile menu of their own, drawn in their own style
     (t04's pill, t09's "Meni" drawer). Injecting a second burger beside one of
     those gives the page two menus. Anything already wired as a disclosure for a
     panel is taken as that template having solved this itself. */
  if (doc.querySelector('button[aria-expanded][aria-controls]')) return;

  /* The template's section links, in document order, deduplicated by href —
     templates repeat the same anchor in more than one nav group.
     The wordmark ("#", "#top") is deliberately excluded. It is the logo, it
     stays visible at every width, and counting it as navigation is what would
     make the visibility probe below decide the nav had not collapsed. */
  function sectionLinks() {
    var seen = {}, out = [];
    doc.querySelectorAll('header a[href^="#"], header nav a[href^="#"]').forEach(function (a) {
      var h = a.getAttribute('href');
      if (!h || h === '#' || h === '#top' || h === '#main') return;
      if (seen[h] || a.closest('.ls-navsheet')) return;
      seen[h] = 1; out.push(a);
    });
    return out;
  }

  var links = sectionLinks();
  if (!links.length) return;

  var sheet = doc.createElement('div');
  sheet.className = 'ls-navsheet';
  sheet.id = 'ls-navsheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-label', doc.documentElement.lang === 'sl' ? 'Meni' : 'Menu');

  var foot = doc.createElement('div');
  foot.className = 'ls-navsheet-foot';

  links.forEach(function (a) {
    var c = a.cloneNode(true);
    c.removeAttribute('class');
    c.removeAttribute('id');
    sheet.appendChild(c);
  });
  /* The phone number, if the page has one, closes the sheet as the action line —
     it is something to do, not somewhere to go, so it sits apart from the stack. */
  var tel = doc.querySelector('a[href^="tel:"]');
  if (tel) { var t = tel.cloneNode(true); t.removeAttribute('class'); t.removeAttribute('id'); foot.appendChild(t); }
  if (foot.children.length) sheet.appendChild(foot);

  var btn = doc.createElement('button');
  btn.type = 'button';
  btn.className = 'ls-navtoggle';
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-controls', 'ls-navsheet');
  btn.setAttribute('aria-label', doc.documentElement.lang === 'sl' ? 'Meni' : 'Menu');
  btn.appendChild(doc.createElement('span'));

  /* The burger is positioned against the header. Set that here rather than in
     CSS: a :has() rule would be the alternative, and a header that is already
     fixed or sticky must keep the position it has. */
  if (getComputedStyle(header).position === 'static') header.style.position = 'relative';
  header.appendChild(btn);
  doc.body.appendChild(sheet);

  /* Pick up the page's real colours so the sheet is opaque and on-brand rather
     than a system-coloured panel. Read from the hero band or body, whichever
     actually paints a background. */
  function paint() {
    var probe = doc.querySelector('.heroband, header, body');
    var bg = '', el = probe;
    while (el && !bg) {
      var c = getComputedStyle(el).backgroundColor;
      if (c && c !== 'transparent' && !/rgba\\(0, 0, 0, 0\\)/.test(c)) bg = c;
      el = el.parentElement;
    }
    var root = getComputedStyle(doc.documentElement);
    sheet.style.setProperty('--ls-sheet-bg', bg || root.backgroundColor || '#fff');
    sheet.style.setProperty('--ls-sheet-fg', getComputedStyle(doc.body).color || root.color);
  }

  function open() {
    paint();
    sheet.classList.add('is-open');
    btn.setAttribute('aria-expanded', 'true');
    doc.documentElement.classList.add('ls-navopen');
  }
  function close() {
    sheet.classList.remove('is-open');
    btn.setAttribute('aria-expanded', 'false');
    doc.documentElement.classList.remove('ls-navopen');
  }
  function toggle() { sheet.classList.contains('is-open') ? close() : open(); }

  var closeBtn = doc.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'ls-navsheet-close';
  closeBtn.setAttribute('aria-label', doc.documentElement.lang === 'sl' ? 'Zapri' : 'Close');
  closeBtn.innerHTML = '&times;';
  closeBtn.addEventListener('click', close);
  sheet.insertBefore(closeBtn, sheet.firstChild);

  btn.addEventListener('click', toggle);
  sheet.addEventListener('click', function (e) { if (e.target.closest('a')) close(); });
  doc.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });

  /* Show the burger exactly when the template's own links are not visible. This
     is re-checked on resize, so it tracks whatever breakpoint the template uses
     without this code knowing what that breakpoint is. */
  /* Reserve the burger's width in the header so a long business name cannot run
     underneath it. Written as an inline style because the ten headers carry their
     horizontal padding in different places — on the <header> itself in some files,
     on an inner .wrap in others — and padding here narrows the row either way. */
  var basePadRight = null;
  function reserve(on) {
    if (basePadRight === null) basePadRight = parseFloat(getComputedStyle(header).paddingRight) || 0;
    header.classList.toggle('ls-nav-collapsed', on);
    header.style.paddingRight = on ? (basePadRight + 52) + 'px' : '';
  }

  function sync() {
    var visible = links.filter(function (a) {
      return a.offsetParent !== null && a.getBoundingClientRect().width > 0;
    }).length;
    /* One-or-fewer counts as collapsed, not just zero. Some templates keep a
       single anchor visible on mobile (t07 marks one "keep"), which still
       leaves the visitor without the rest of the navigation. */
    btn.classList.toggle('is-on', visible < 2);
    reserve(visible < 2);
    if (visible >= 2) close();
  }
  sync();
  var rt;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(sync, 120); });
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(sync);
})();
`;

// ---------------------------------------------------------------------------
// Injection.
// ---------------------------------------------------------------------------
const CSS_START = "/* ---- LocalSite responsive foundation (shared, generated) ---- */";
const CSS_END = "/* ---- end responsive foundation ---- */";
const JS_START = "/* ---- LocalSite mobile nav (shared, generated) ---- */";
const JS_END = "/* ---- end mobile nav ---- */";

// The foundation goes after the existing core styles and before the template's
// own :root, so the template always has the last word.
const CSS_ANCHOR =
  "@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}}";

function injectBlock(src, { start, end, body, anchorAfter, anchorBefore }) {
  const block = `${start}\n${body}${end}\n`;
  const s = src.indexOf(start);
  if (s !== -1) {
    const e = src.indexOf(end, s);
    if (e === -1) throw new Error(`found ${start} without its end marker`);
    return src.slice(0, s) + block + src.slice(e + end.length + 1);
  }
  if (anchorAfter) {
    const i = src.indexOf(anchorAfter);
    if (i === -1) throw new Error(`anchor not found: ${anchorAfter.slice(0, 60)}`);
    const at = i + anchorAfter.length;
    return `${src.slice(0, at)}\n\n${block}${src.slice(at)}`;
  }
  const i = src.lastIndexOf(anchorBefore);
  if (i === -1) throw new Error(`anchor not found: ${anchorBefore}`);
  return `${src.slice(0, i)}${block}${src.slice(i)}`;
}

const files = (await readdir(TEMPLATE_DIR))
  .filter((f) => /^t\d\d-.*\.html$/.test(f))
  .sort();

const check = process.argv.includes("--check");
let stale = 0;

for (const f of files) {
  const p = path.join(TEMPLATE_DIR, f);
  const src = await readFile(p, "utf8");
  let out = injectBlock(src, {
    start: CSS_START,
    end: CSS_END,
    body: FOUNDATION_CSS,
    anchorAfter: CSS_ANCHOR,
  });
  out = injectBlock(out, {
    start: JS_START,
    end: JS_END,
    body: NAV_JS,
    anchorBefore: "</script>\n</body>",
  });
  if (out === src) continue;
  stale++;
  if (check) console.error(`stale: ${f}`);
  else {
    await writeFile(p, out);
    console.log(`updated: ${f}`);
  }
}

if (check && stale) {
  console.error(`\n${stale} template(s) out of sync — run: node scripts/sync-template-core.mjs`);
  process.exit(1);
}
console.log(check ? "all templates in sync" : `done (${files.length} templates)`);
