#!/usr/bin/env python3
"""Patch the shared LocalSite photo engine inlined in every templates/t*.html.

The engine is identical in all ten templates (inlined at build time), so the
change is applied as an exact-string replacement and refuses to run if any
template has drifted from the expected code. Idempotent: an already-patched
template is skipped.

What changes, and why:
  - Real photos outrank stock. Stock (`"stock": true`, added server-side) only
    exists so that no frame is ever left empty; it never displaces the business's
    own picture from a slot it can fill.
  - `"hero": false` is honoured. The server checks what a photo looks like — a
    macro close-up of an eye or a nail, a dark or flat shot — and the old engine
    simply gave the hero to the largest landscape image, which is how a lash
    close-up ended up as the first thing a salon owner saw.
  - The hero judges a photo by the pixels left after cropping to the frame, not
    by orientation. Phone photos are mostly portrait, and the old landscape-only
    rule discarded sharp interior shots and left the hero blank.
  - Stock skips the resolution floor, which exists to keep blurry phone photos
    out of big frames; stock is chosen and sized for them.
  - The gallery pads up to `data-min` (default 4) with stock when the business
    has too few photos, then keeps adding stock while the last row is left with
    a gap, measured from the rendered grid since every template's grid differs.
  - Services can carry an image (`service_images[i]`), exposed to CSS as
    --svc-img plus a `has-img` class, for layouts whose cards are empty frames.
"""
import pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent / "templates"
MARK = "/* photo-engine v2 */"

OLD_DISTRIBUTE_HEAD = """  function distribute(list) {
    var pool = list.filter(function (p) { return p.ok; }).sort(function (a, b) { return b.px - a.px; });
    var used = 0;
    var hero = $('[data-hero-photo]');
    if (hero && pool.length) {
      var o = hero.getAttribute('data-orient') || 'landscape';
      var min = +hero.getAttribute('data-min-px') || 1500000;
      var pick = pool.filter(function (p) { return p.px >= min && (o === 'any' || p.o === o || (o === 'landscape' && p.o === 'square' && p.w >= 1800)); })[0];"""

NEW_DISTRIBUTE_HEAD = """  function distribute(list) {
    """ + MARK + """
    /* Real photos first, sharpest first; stock only fills what real photos cannot. */
    var pool = list.filter(function (p) { return p.ok; }).sort(function (a, b) { return (a.stock ? 1 : 0) - (b.stock ? 1 : 0) || b.px - a.px; });
    var used = 0;
    var hero = $('[data-hero-photo]');
    if (hero && pool.length) {
      var o = hero.getAttribute('data-orient') || 'landscape';
      var min = +hero.getAttribute('data-min-px') || 1500000;
      /* Judge a photo by what survives the crop, not by its orientation: a 3024x4032 phone shot of the
         salon cropped to a wide hero still has ~5MP, while the old "landscape only" rule threw it away
         and left the hero empty. */
      var cropPx = function (p) { return o === 'portrait' ? p.h * Math.min(p.w, p.h / 1.4) : o === 'any' ? p.px : p.w * Math.min(p.h, p.w / 1.6); };
      /* hero:false = the server judged it wrong for a hero (close-up, dark, flat). Big is not the same as right. */
      /* hero:true = the server shortlisted it as the right subject; display copies are capped at ~1500px,
         which still fills a desktop hero, so a vetted photo gets a lower floor than an unknown one. */
      var pick = pool.filter(function (p) { return p.hero !== false && (p.stock || cropPx(p) >= (p.hero === true ? Math.min(min, 1000000) : min)); })[0];"""

OLD_SLOT = """      var ok = pool.filter(function (p) { return p.px >= min && p.px <= maxpx; });"""
NEW_SLOT = """      var ok = pool.filter(function (p) { return p.stock || (p.px >= min && p.px <= maxpx); });"""

OLD_GALLERY = """      pool.slice(0, max).forEach(function (p) {
        var n = t.content.firstElementChild.cloneNode(true);
        var w = $('[data-f="photo"]', n) || n;
        n.setAttribute('data-gallery-item', '');
        n.classList.add('o-' + p.o, 'q-' + p.q);
        putImg(w, p, used++);
        box.appendChild(n); gcount++;
      });
      pool = pool.slice(max);
    });"""
NEW_GALLERY = """      /* Real photos up to max; stock only pads a thin set up to data-min, so a gallery is never a lone frame. */
      var gmin = Math.min(max, +box.getAttribute('data-min') || 4);
      var take = pool.filter(function (p) { return !p.stock; }).slice(0, max);
      if (take.length < gmin) take = take.concat(pool.filter(function (p) { return p.stock; }).slice(0, gmin - take.length));
      pool = pool.filter(function (p) { return take.indexOf(p) < 0; });
      var addItem = function (p) {
        var n = t.content.firstElementChild.cloneNode(true);
        var w = $('[data-f="photo"]', n) || n;
        n.setAttribute('data-gallery-item', '');
        n.classList.add('o-' + p.o, 'q-' + p.q);
        putImg(w, p, used++);
        box.appendChild(n); gcount++;
      };
      take.forEach(addItem);
      /* Measure, don't guess: every template's grid differs. While the last frame leaves more than half a
         frame of empty row beside it and stock remains, add one more, so the gallery ends on a full row. */
      var rowGap = function () {
        var it = $$('[data-gallery-item]', box); if (it.length < 2) return false;
        var last = it[it.length - 1].getBoundingClientRect(), br = box.getBoundingClientRect();
        return last.width > 0 && br.right - last.right > last.width * 0.5;
      };
      /* Runs after the gallery is un-hidden below; measured while hidden, every width is zero. */
      rowFillers.push(function () {
        for (var guard = 0; guard < 6 && rowGap(); guard++) {
          var extra = pool.filter(function (p) { return p.stock; })[0];
          if (!extra) break;
          pool.splice(pool.indexOf(extra), 1);
          addItem(extra);
        }
      });
    });"""

OLD_GCOUNT = """    var gcount = 0;"""
NEW_GCOUNT = """    var gcount = 0, rowFillers = [];"""

OLD_SETROOT = """    setRoot([gcount ? 'has-gallery' : 'no-gallery', used ? 'has-photos' : 'no-photos'], ['photos-pending']);"""
NEW_SETROOT = OLD_SETROOT + """
    rowFillers.forEach(function (f) { f(); });"""

OLD_SVC = """      node.setAttribute('data-i', i);
      if (s.category) node.setAttribute('data-cat', s.category);"""
NEW_SVC = """      node.setAttribute('data-i', i);
      if (s.category) node.setAttribute('data-cat', s.category);
      var simg = s.image || (D.service_images || [])[i];
      if (simg) { node.classList.add('has-img'); node.style.setProperty('--svc-img', 'url("' + simg + '")'); }"""

T01_CSS_OLD = ".tile .tile-desc{margin-top:auto}"
T01_CSS_NEW = T01_CSS_OLD + """
/* A square card with a name at the top and a line at the bottom is an empty frame in the middle; give it the picture. The gradient keeps both lines legible over any photo. */
.tile.has-img{position:relative;isolation:isolate;overflow:hidden;color:var(--linen);border-color:var(--walnut)}
.tile.has-img::before{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg,rgba(40,35,30,.55),rgba(40,35,30,.05) 40%,rgba(40,35,30,.8)),var(--svc-img) center/cover;transition:transform .6s ease}
.tile.has-img:hover::before{transform:scale(1.04)}
.tile.has-img .tile-desc{color:var(--linen)}"""

REPLACEMENTS = [
    (OLD_DISTRIBUTE_HEAD, NEW_DISTRIBUTE_HEAD),
    (OLD_SLOT, NEW_SLOT),
    (OLD_GCOUNT, NEW_GCOUNT),
    (OLD_GALLERY, NEW_GALLERY),
    (OLD_SETROOT, NEW_SETROOT),
    (OLD_SVC, NEW_SVC),
]

def main() -> int:
    files = sorted(ROOT.glob("t[01][0-9]-*.html"))
    if len(files) != 10:
        print(f"expected 10 templates, found {len(files)}", file=sys.stderr)
        return 1
    for f in files:
        s = f.read_text()
        if MARK in s:
            print(f"{f.name}: already patched")
            continue
        for old, new in REPLACEMENTS:
            if s.count(old) != 1:
                print(f"{f.name}: expected exactly one match for:\n{old[:120]}", file=sys.stderr)
                return 1
            s = s.replace(old, new)
        if f.name.startswith("t01-"):
            if s.count(T01_CSS_OLD) != 1:
                print(f"{f.name}: service tile CSS anchor not found", file=sys.stderr)
                return 1
            s = s.replace(T01_CSS_OLD, T01_CSS_NEW)
        f.write_text(s)
        print(f"{f.name}: patched")
    return 0

if __name__ == "__main__":
    sys.exit(main())
