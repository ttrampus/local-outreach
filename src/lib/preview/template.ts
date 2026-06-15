// Build a modern, mobile-responsive single-page site from data we already have
// (name, category, reviews, address, hours). No external build step — one
// self-contained HTML string with inline CSS, ready to screenshot or deploy.
import type { NormalizedPlaceDetails } from "@/lib/leadSource/types";
import { pickTheme, GOOGLE_FONTS_HREF, type Theme } from "./theme";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// A small per-category service list so "Services" isn't empty. Tasteful, generic.
const SERVICES_BY_THEME: Record<string, { title: string; blurb: string }[]> = {
  salon: [
    { title: "Cuts & Styling", blurb: "Precision cuts and finishes tailored to you." },
    { title: "Color", blurb: "Balayage, highlights and full color by specialists." },
    { title: "Treatments", blurb: "Restorative care that keeps hair healthy." },
  ],
  cafe: [
    { title: "Specialty Coffee", blurb: "Single-origin espresso and slow pour-overs." },
    { title: "Fresh Bakes", blurb: "Pastries and bread baked in-house each morning." },
    { title: "All-Day Brunch", blurb: "Seasonal plates made from local produce." },
  ],
  trades: [
    { title: "Emergency Callouts", blurb: "Fast same-day response when it matters." },
    { title: "Repairs & Installs", blurb: "Done right the first time, guaranteed." },
    { title: "Maintenance", blurb: "Planned upkeep to prevent costly surprises." },
  ],
  medical: [
    { title: "Check-ups", blurb: "Thorough, unhurried consultations." },
    { title: "Treatments", blurb: "Modern, evidence-based care." },
    { title: "Online Booking", blurb: "Reserve a slot in seconds, any time." },
  ],
  florist: [
    { title: "Bouquets", blurb: "Seasonal arrangements for any occasion." },
    { title: "Events & Weddings", blurb: "Florals designed around your day." },
    { title: "Same-Day Delivery", blurb: "Fresh stems delivered across the area." },
  ],
  default: [
    { title: "Our Work", blurb: "Quality service our customers come back for." },
    { title: "Local & Trusted", blurb: "Proudly serving the neighborhood." },
    { title: "Get In Touch", blurb: "We'd love to hear what you need." },
  ],
};

function neighborhood(address?: string): string | null {
  if (!address) return null;
  // Use the first address segment as a "neighborhood/street" hook.
  const part = address.split(",")[0]?.trim();
  return part && part.length <= 40 ? part : null;
}

export function generateSiteHtml(place: NormalizedPlaceDetails, searchHint = ""): string {
  const theme: Theme = pickTheme(place.categories, searchHint);
  const services = SERVICES_BY_THEME[theme.key] ?? SERVICES_BY_THEME.default;
  const area = neighborhood(place.address);
  const name = esc(place.name);
  const ratingLine =
    place.rating && place.reviewCount
      ? `${place.rating.toFixed(1)} ★ · ${place.reviewCount} reviews`
      : null;

  const testimonials = place.reviewSnippets.slice(0, 3).map((t) => esc(t));

  const tagline = area
    ? `Your neighborhood ${theme.label} in ${esc(area)}.`
    : `A ${theme.label} the neighborhood trusts.`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${name}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="${GOOGLE_FONTS_HREF}" />
<style>
  :root {
    --bg:${theme.bg}; --surface:${theme.surface}; --text:${theme.text};
    --muted:${theme.muted}; --accent:${theme.accent}; --accent-text:${theme.accentText};
    --hero-text:${theme.heroText};
  }
  * { margin:0; padding:0; box-sizing:border-box; }
  html { scroll-behavior:smooth; }
  body { font-family:${theme.bodyFont}; background:var(--bg); color:var(--text);
         line-height:1.6; -webkit-font-smoothing:antialiased; }
  h1,h2,h3 { font-family:${theme.headingFont}; line-height:1.1; font-weight:700; }
  .wrap { max-width:1080px; margin:0 auto; padding:0 24px; }
  a { color:inherit; }
  .btn { display:inline-block; background:var(--accent); color:var(--accent-text);
         padding:14px 26px; border-radius:999px; font-weight:600; text-decoration:none;
         font-family:${theme.bodyFont}; }
  /* nav */
  nav { position:sticky; top:0; backdrop-filter:saturate(140%) blur(8px);
        background:color-mix(in srgb, var(--bg) 82%, transparent); z-index:10;
        border-bottom:1px solid color-mix(in srgb, var(--text) 8%, transparent); }
  nav .wrap { display:flex; align-items:center; justify-content:space-between; height:68px; }
  .brand { font-family:${theme.headingFont}; font-weight:700; font-size:20px; }
  .navlinks a { margin-left:26px; text-decoration:none; color:var(--muted); font-size:15px; }
  .navlinks a:hover { color:var(--text); }
  /* hero */
  .hero { background:${theme.heroGradient}; padding:96px 0 104px; }
  .hero .wrap { max-width:760px; text-align:center; }
  .eyebrow { text-transform:uppercase; letter-spacing:.16em; font-size:13px;
             color:color-mix(in srgb, var(--hero-text) 72%, transparent); font-weight:600; }
  .hero h1 { font-size:clamp(40px, 7vw, 68px); margin:18px 0 16px; color:var(--hero-text); }
  .hero p { font-size:20px; color:color-mix(in srgb, var(--hero-text) 85%, transparent);
            margin-bottom:30px; }
  .hero .rating { display:inline-block; margin-top:22px; font-size:14px;
                  color:color-mix(in srgb, var(--hero-text) 75%, transparent); }
  /* sections */
  section { padding:84px 0; }
  .section-head { max-width:560px; margin:0 auto 48px; text-align:center; }
  .section-head h2 { font-size:clamp(28px,4vw,40px); margin-bottom:12px; }
  .section-head p { color:var(--muted); font-size:17px; }
  .grid { display:grid; grid-template-columns:repeat(3,1fr); gap:22px; }
  .card { background:var(--surface); border-radius:18px; padding:30px;
          box-shadow:0 1px 3px color-mix(in srgb, var(--text) 8%, transparent);
          border:1px solid color-mix(in srgb, var(--text) 6%, transparent); }
  .card h3 { font-size:21px; margin-bottom:8px; }
  .card p { color:var(--muted); }
  .about { background:var(--surface); }
  .about .wrap { max-width:720px; text-align:center; }
  .about p { font-size:19px; color:var(--muted); }
  .quotes { display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:22px; }
  .quote { background:var(--surface); border-radius:18px; padding:28px; font-size:17px;
           border:1px solid color-mix(in srgb, var(--text) 6%, transparent); }
  .quote .stars { color:var(--accent); margin-bottom:10px; letter-spacing:2px; }
  .contact { background:${theme.heroGradient}; text-align:center; color:var(--hero-text); }
  .contact h2 { color:var(--hero-text); }
  .contact .info { margin:20px 0 28px; font-size:18px;
                   color:color-mix(in srgb, var(--hero-text) 88%, transparent); }
  .contact .btn { background:var(--accent); color:var(--accent-text); }
  footer { padding:34px 0; text-align:center; color:var(--muted); font-size:14px; }
  @media (max-width:760px){ .grid{grid-template-columns:1fr;} .navlinks{display:none;} }
</style>
</head>
<body>
  <nav><div class="wrap">
    <span class="brand">${name}</span>
    <span class="navlinks">
      <a href="#services">Services</a><a href="#about">About</a>
      <a href="#reviews">Reviews</a><a href="#contact">Contact</a>
    </span>
  </div></nav>

  <header class="hero"><div class="wrap">
    <div class="eyebrow">${esc(area ?? "Local & Trusted")}</div>
    <h1>${name}</h1>
    <p>${tagline}</p>
    <a class="btn" href="#contact">Book Now</a>
    ${ratingLine ? `<div class="rating">${esc(ratingLine)}</div>` : ""}
  </div></header>

  <section id="services"><div class="wrap">
    <div class="section-head"><h2>What we do</h2>
      <p>Everything you need, done with care.</p></div>
    <div class="grid">
      ${services
        .map(
          (s) => `<div class="card"><h3>${esc(s.title)}</h3><p>${esc(s.blurb)}</p></div>`,
        )
        .join("\n      ")}
    </div>
  </div></section>

  <section id="about" class="about"><div class="wrap">
    <div class="section-head"><h2>About ${name}</h2></div>
    <p>${area
      ? `We're proud to serve ${esc(area)} and the surrounding area`
      : "We're proud to serve our local community"} as a trusted ${theme.label}. ${
    place.reviewCount
      ? `With ${place.reviewCount}+ reviews, our customers keep coming back — and we'd love to welcome you too.`
      : "Friendly service, fair prices, and work we stand behind."
  }</p>
  </div></section>

  ${
    testimonials.length
      ? `<section id="reviews"><div class="wrap">
    <div class="section-head"><h2>What people say</h2>
      <p>In our customers' own words.</p></div>
    <div class="quotes">
      ${testimonials
        .map((t) => `<div class="quote"><div class="stars">★★★★★</div>“${t}”</div>`)
        .join("\n      ")}
    </div>
  </div></section>`
      : ""
  }

  <section id="contact" class="contact"><div class="wrap">
    <h2>Come say hello</h2>
    <div class="info">
      ${place.address ? `${esc(place.address)}<br/>` : ""}
      ${place.phone ? `${esc(place.phone)}` : ""}
    </div>
    ${place.phone ? `<a class="btn" href="tel:${esc(place.phone)}">Call us</a>` : `<a class="btn" href="#">Get in touch</a>`}
  </div></section>

  <footer>© ${new Date().getFullYear()} ${name}. Site preview generated by Outreach Console.</footer>
</body>
</html>`;
}
