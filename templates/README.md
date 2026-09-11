# Local business templates

Open `index.html` to browse all 10. Each template is one standalone HTML file with no build step and no dependencies other than Google Fonts.

| # | File | Business | Refero reference |
|---|------|----------|------------------|
| 01 | t01-frizerski-salon-oakame.html | Hair salon | Oakâme |
| 02 | t02-masaze-wellness-alveos.html | Spa / massage / beauty | Alveos One |
| 03 | t03-brivnica-aplos.html | Barbershop | Aplós |
| 04 | t04-fotograf-aker.html | Photographer | Aker |
| 05 | t05-avtosola-lightship.html | Driving school | Lightship |
| 06 | t06-gostilna-hungry-tiger.html | Restaurant / grill | Hungry Tiger |
| 07 | t07-mizarstvo-ashton.html | Carpenter / joinery | Ashton Bespoke |
| 08 | t08-kavarna-sweetgreen.html | Café / bakery | sweetgreen |
| 09 | t09-avtoservis-lamborghini.html | Car service / garage | Lamborghini |
| 10 | t10-zobozdravnik-alden.html | Dentist / clinic | Alden |

Template 01 uses your real Tamara data. Templates 02–10 contain **fictional demo data** (marked `"_demo": true`), and their photos are random placeholders from picsum.photos.

## Generating a site

Each file has two JSON blocks near the bottom.

- **`<script id="business-data">`** holds the business data. Replace the whole block on every generation. This is the only thing your pipeline has to touch.
- **`<script id="template-defaults">`** holds the template's default services and all page text (`labels`). Any key you put in `business-data` overrides the default with the same name, including individual `labels`.

### business-data fields

```json
{
  "name_raw": "Frizerski studio Tamara Team Tamara Janža s.p.",
  "name": "Frizerski studio Tamara",
  "short_name": "Tamara",
  "type": "Frizerski salon",
  "categories": ["hair_salon", "..."],
  "address": "Novakova ulica 5, 1000 Ljubljana, Slovenija",
  "phone": "+386 70 600 222",
  "email": "optional@example.si",
  "rating": 4.6,
  "review_count": 100,
  "hours": ["ponedeljek: 7:00–15:00", "nedelja: Zaprto"],
  "reviews": [{ "text": "…", "rating": 5, "author": "optional" }],
  "photos": ["https://…jpg", { "src": "https://…", "width": 1600, "height": 1067, "focus": "50% 30%" }],
  "services": [{ "name": "…", "desc": "…", "price": "18 €", "category": "Kava", "note": "B" }],
  "google_maps_url": "optional link to the Google place page",
  "booking_url": "", "instagram": "", "facebook": "",
  "map_mode": "embed",
  "review_min_rating": 4,
  "labels": { "hero_title": "optional per-site text override" }
}
```

How the fields are used:

- **Names.** `name_raw` is shown in the footer as the legal name. `name` is the display name; if you leave it out, the legal suffix (s.p., d.o.o., …) is stripped from `name_raw`. `short_name` is the word used in the big hero type; it falls back to `name`. For the best results your pipeline should supply both `name` and `short_name`, because raw Google names often include the owner's name.
- **Hours** are displayed exactly as given. They also drive the "open now / closed, opens at …" status and the highlighted today row, using Europe/Ljubljana time.
- **Reviews** with a `rating` below `review_min_rating` (default 4) are dropped automatically. Always pass Google's per-review rating so complaints never end up on the site. Truncated Google snippets are trimmed to a clean sentence or word ending.
- **Photos.** Sending `width` and `height` (Google Places provides them) speeds up placement.
- **`services`.** If you omit it, the template's generic list is used. The café template uses `category` for its menu tabs, and the driving school uses `note` for the large category letter.

### Page text syntax (`labels`)

- `{name}`, `{short}`, `{type}`, `{city}`, `{street}`, `{city_line}`, `{phone}`, `{rating}`, `{count}` and `{count_word}` insert values. `{count_word}` gives the correct Slovenian plural: mnenje / mnenji / mnenja / mnenj.
- `[words]` marks an accent highlight. The dental template renders it in sky blue.
- `|` inserts a line break.

## Photo handling

When the page loads, every photo is measured and graded as hi, mid or low resolution, and as portrait, landscape or square.

- **Hero.** A large hero photo is used only when a photo is big enough, roughly 1.5 MP or more, and the right shape. Otherwise the hero stays type-led, so there are never empty image boxes.
- **Photo slots.** Sharp photos go to big frames. Weak photos go to small frames; in the dentist template, for example, the tiny round avatars take the weakest images.
- **Gallery.** Remaining photos fill the gallery, placed by shape.
- **Low-quality photos** get a film-grain overlay and a softer colour treatment, tuned per template, which hides JPEG blockiness.
- **Consistent look.** Every photo gets a colour filter matched to its template, so mixed phone photos look like one set.
- **Failures and gaps.** Broken image URLs are removed. If a template gets no photos, its gallery section hides itself.

Add `?nophotos` to any template URL to preview the no-photo version.

## Map

The map uses Google Maps embedding with no API key, in Google's own colours, and by default (`"map_mode": "embed"`) it is on screen the moment the page opens — these pages are sent to prospects, and a map behind a button reads as a broken map. Set `"map_mode": "click"` for the consent-safe alternative: visitors get a styled panel with the address and a "Prikaži zemljevid" button, and nothing from Google loads (no Google cookies) until they click. Directions and "all reviews" links go to Google Maps.

## Also included automatically

- **Contact.** Clickable `tel:` phone links everywhere, plus a sticky call and directions bar on mobile.
- **Search engines.** LocalBusiness structured data (schema.org) with address and opening hours, and a page title and meta description built from the data.
- **Accessibility.** A "skip to content" link, respect for reduced-motion settings, and keyboard focus styles.
- **Photo viewer.** Clicking a gallery photo opens it enlarged.

## Fonts

All fonts are free Google Fonts that stand in for the paid fonts on the reference sites:

- Archivo (BwGradual)
- Hanken Grotesk
- Sorts Mill Goudy (Goudy Old Style)
- Montserrat and Lora (Proxima Nova)
- DM Sans (F37 Bolton)
- Antonio (Salmond)
- EB Garamond and Work Sans
- Outfit and Fraunces (SweetSans and Grenette)
- Barlow Condensed (LamboType)
- Inter and Source Serif 4

## Deliberate deviations from the references

- **EB Garamond replaces Cormorant Garamond** in template 07. Cormorant sets the
  caron on `š`, `ž` and `č` high and detached from the letter, which at hero
  sizes makes ordinary Slovene words look broken.
- **The café menu items carry no photos.** Nothing in the pipeline knows what a
  Google photo depicts, and a café's photo set is mostly room and street shots,
  so the espresso card came out showing the building's facade. The colour tiles
  are the template's own no-photo treatment.

- **Call buttons.** Lightship and Ashton Bespoke have no call-to-action buttons. I added one in each style's own shape, because a local business site needs one.
- **Lamborghini's yellow button** uses dark text instead of white, because white on that yellow is unreadable.
- **Lamborghini's all-caps rule** is relaxed for review text and descriptions, so longer text stays readable.
