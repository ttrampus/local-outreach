# Outreach Console

A full-stack web app to run a **semi-automated, human-in-the-loop** local-business
outreach pipeline. It finds local businesses with weak or outdated web presence,
scores them into tiers, generates website previews, and helps you run **manual**
outreach from one dashboard. The app does the heavy lifting; you provide judgment
and send every message yourself.

> **Manual-send by design.** Nothing is ever sent automatically. Drafts land in a
> review queue; sending is a separate, explicit, per-lead action you take after
> approving. See [Compliance](#compliance--your-responsibility).

## Stack

- **Next.js (App Router) + TypeScript** — one framework for UI and backend.
- **Tailwind CSS v4** for styling.
- **Prisma 7 + SQLite** (via the `better-sqlite3` driver adapter) — local, no
  external DB to manage.
- **Playwright** for screenshot/preview rendering (used in a later build phase).
- API keys live **server-side only** and are never shipped to the browser.

## Build status — all phases complete

- ✅ **Discovery + Qualification.** Search → score → leads table.
- ✅ **Preview generation** (`POST /api/preview/:leadId`). Builds a modern,
  mobile-responsive single-page site from data we already have, themed by category,
  rendered headless with Playwright → a hero screenshot at
  `/public/previews/{placeId}.png`. The HTML is stored at `data/previews/{placeId}.html`
  for deploy. Screenshot only — **no deploy by default.**
- ✅ **Outreach drafting + review queue** (`POST /api/outreach/:leadId`). Generates a
  personalized, recurring-pricing-led draft; the `/outreach` page is a review queue
  to edit, approve, and **manually** send. Nothing auto-sends.
- ✅ **Opt-in deploy** (`POST /api/deploy/:leadId`). Manual, per-lead, gated behind a
  confirm. Deploys the stored HTML to Vercel (target configurable; Cloudflare Pages
  is a documented extension point).

## Setup

```bash
npm install                  # also runs `prisma generate` via postinstall
cp .env.example .env.local   # then edit .env.local
npm run db:migrate           # apply the schema to ./dev.db (already applied on first run)
npm run dev                  # http://localhost:3000
```

The app ships in **mock mode** (`LEAD_SOURCE="mock"`) so you can validate the
qualifier and dashboard with sample data — no API key, no spend. Switch to Google
only when you're ready for real data.

### Useful scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run db:migrate` | Create + apply a Prisma migration |
| `npm run db:studio` | Browse the SQLite DB in Prisma Studio |
| `npm run db:reset` | Drop + recreate the DB (destructive) |

## Environment keys

All secrets live in `.env.local` only (git-ignored). `.env.example` documents
every key:

| Key | Purpose |
| --- | --- |
| `DATABASE_URL` | SQLite file path (default `file:./dev.db`). |
| `LEAD_SOURCE` | `mock` (offline sample data) or `google` (real). |
| `GOOGLE_PLACES_API_KEY` | Required only when `LEAD_SOURCE=google`. Server-side only. |
| `MAX_DETAILS_PER_DAY` | **Cost safety stop** on the expensive Place Details call. |
| `MAX_SEARCH_PER_DAY` | Safety stop on the cheaper Text Search call. |
| `FREE_TIER_*_PER_MONTH` | Free-allowance **estimates**, display-only (see below). |
| `SITE_FETCH_TIMEOUT_MS` | Timeout for analyzing a lead's existing site. |
| `DEPLOY_TARGET` + tokens | Used by the opt-in deploy phase. |

## How it works

### Cost model (Google Places API — New)

Built around the **official Google Places API only** — no Maps scraping. Since
March 2025, Google replaced the single shared $200/mo credit with a **separate
free monthly allowance per API SKU**, and the two SKUs this app uses behave very
differently:

- **Text Search** (discovery) — cheaper Pro-tier SKU, generous free allowance.
- **Place Details** (website/phone/rating/etc.) — a **separate, more expensive
  SKU** with a smaller allowance. This is what pushes you out of free tier as
  volume grows, *not* search.

The app is designed around this:

- **Tight field masks** — Place Details requests only the fields the qualifier and
  outreach need. Broadening a mask bills at a higher tier, so we never do it.
- **Cache-first, never pay twice** — every place is cached by `placeId`
  (`PlaceCache`). Re-running discovery hits the cache, and any `placeId` already a
  `Lead` is skipped before any Details call.
- **Per-SKU usage tracking** — every billable call is counted per SKU per day
  (`ApiUsage`); the dashboard shows today's count and the running monthly total
  against the free-tier estimate.
- **In-code daily ceilings** — `MAX_DETAILS_PER_DAY` / `MAX_SEARCH_PER_DAY` act as
  safety stops independent of the QPD cap you should **also** set in the GCP
  console.

> ⚠️ The free-tier numbers in config are **current-best estimates, not fact** —
> Google restructures pricing often. Check live pricing:
> <https://mapsplatform.google.com/pricing/>

### Swappable data source

The data source sits behind a `LeadSource` interface (`search` + `details`,
returning a normalized internal shape). Google Places is the first implementation;
a `mock` source ships for offline validation. You can add OpenStreetMap/Overpass or
Foursquare later by writing one file and setting `LEAD_SOURCE` — the qualifier and
UI never touch raw Google JSON.

### Qualification — score, don't just filter

Each lead is scored into a tier. The driving insight: *a business with an outdated
site is a warmer lead than one with no site*, because they already believe a
website has value.

- **HOT** — has a website that looks weak/outdated. Detected by fetching the site
  (short timeout, graceful failure) and stacking signals: free-host subdomain
  (wix/wordpress.com), no HTTPS, stale copyright year, no responsive viewport,
  table layout, Flash references, tiny/broken page.
- **WARM** — solid reviews + rating (real, active business) but **no website**.
- **COLD** — no website + thin reviews, already-modern site, or closed/defunct.

Every lead stores its tier, a human-readable reason, and the raw signal map.

## Intended workflow

1. **Discovery** — enter `(category, location)` pairs and launch a search. Runs in
   the background; the page polls for live progress. Re-running is safe (idempotent).
2. **Leads** — browse the filterable/sortable table grouped by tier, with the
   qualification reason and signals visible. Expand a lead to see its funnel status
   and run actions.
3. **Preview** — from a lead, generate a single static hero screenshot (cheap; not a
   deployed site). Shown inline in the lead detail.
4. **Outreach** — draft a personalized message, then on the `/outreach` page review,
   edit, approve, and **manually send** it yourself (confirm step required).
5. **Deploy** — opt-in, per-lead, only for leads that show interest. Requires a
   preview first; needs `VERCEL_TOKEN` in `.env.local`.

## Compliance — your responsibility

This tool helps you contact businesses you have **no prior relationship** with.
Outreach is **manual-send by design** and you are solely responsible for complying
with applicable anti-spam, telemarketing, and privacy laws for cold contact in
your jurisdiction and the recipient's (e.g. GDPR/ePrivacy in the EU, CAN-SPAM in
the US). Don't bulk-blast; this is built for **tens** of considered messages, not
thousands. Honor opt-outs and do-not-contact requests.

## Project layout

```
src/
  app/
    api/            # Route Handlers: discover, leads, leads/[id], search-runs,
                    #   usage, preview/[leadId], outreach(+[leadId]), deploy/[leadId]
    page.tsx        # Leads dashboard
    search/         # Discovery page
    outreach/       # Outreach review queue page
  components/       # Sidebar, LeadsTable, SearchLauncher, UsageBar, TierBadge,
                    #   FunnelStatus, OutreachReview
  lib/
    leadSource/     # LeadSource interface + google + mock implementations
    qualify.ts      # site analysis + tier scoring
    discovery.ts    # orchestration: cache, usage, idempotency, safety stops
    usage.ts        # per-SKU usage accounting
    places.ts       # read cached normalized place details
    preview/        # theme (category → typography/color), HTML template, Playwright render
    outreach/       # draft generator (recurring-pricing-led, personalized)
    deploy/         # deploy abstraction (Vercel target; Cloudflare extension point)
    prisma.ts       # Prisma client singleton (better-sqlite3 adapter)
    env.ts          # typed env config
prisma/schema.prisma
data/previews/      # stored site HTML (git-ignored)
public/previews/    # hero screenshots (git-ignored)
```
