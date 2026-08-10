// Texture for the public pages.
//
// The console is deliberately a flat, quiet panel — you stare at it all day and
// it should get out of the way. The public pages are the opposite: they are the
// shop window for a business that sells websites, and a flat #0b0e14 ground with
// text on it reads as an unfinished screen, not as a design.
//
// Three layers, all light and geometry — deliberately no noise/grain overlay,
// which on a near-black ground looks like grey TV static rather than texture:
//
//   aurora    a soft indigo/violet wash that gives the top of the page colour
//   grid      a perspective plane tilting away, dissolved by a radial mask
//   vignette  corners pulled down so the aurora reads as light, not a rectangle
//
// All are pointer-events:none and aria-hidden, at a negative z-index so no
// stacking context in the page can end up beneath them.
export function SiteBackdrop() {
  return (
    <div aria-hidden className="site-backdrop">
      <div className="site-backdrop__aurora" />
      <div className="site-backdrop__grid" />
      <div className="site-backdrop__vignette" />
    </div>
  );
}
