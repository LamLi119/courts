# SEO monitoring (Phase 4)

Ongoing checks after technical/content SEO ships. Run these on a schedule; do not treat a one-off green run as permanent.

## npm scripts

| Command | Purpose |
|---|---|
| `npm run seo:check-discovery` | Live `/llms.txt`, AI catalog, robots, IndexNow key, sitemap, OKF |
| `npm run seo:check-sitemap` | Every sitemap URL → HTTP 200 and not `noindex`; lastmod diversity |
| `npm run seo:check-content` | Thin venue copy, near-duplicate pairs, district×sport doorway risk |
| `npm run seo:check-serp` | SERP query checklist + GSC pointers (manual rank tracking) |
| `npm run seo:submit-indexnow` | Bulk-submit sitemap URLs to IndexNow (`--dry-run` supported) |
| `npm run seo:monitor` | Discovery + sitemap + content (full Phase 4 automated suite) |

Env (see `.env.example`):

- `SITEMAP_BASE_URL` — default `https://courts.theground.io`
- `SITEMAP_API_URL` — API used by content audit (default production API)
- `INDEXNOW_KEY` — must match `public/<key>.txt`
- `SEO_CONCURRENCY` — sitemap checker parallelism (default 6)

## Monthly (manual)

1. **PageSpeed Insights / Lighthouse** (mobile + desktop) for `/`, `/explore`, one venue, one `/search/{sport}/{district}`.
2. Record LCP / INP / CLS; attach screenshots or CSV under your ops notes (not in git unless you want history).
3. Optional: CrUX field data in PSI once the site has enough traffic.

## Every 4–6 weeks after a major SEO ship

Re-check these SERP queries in Google (incognito / GSC Performance):

| Query | Why |
|---|---|
| `pickleball courts Hong Kong` | Head non-branded demand |
| `室內網球場 香港` | Indoor tennis category win |
| `觀塘 匹克球 場地` | District × sport persona |
| `Courts The Ground` / `courts.theground.io` | Branded baseline |

Also open **Google Search Console → Links** for `courts.theground.io` (and `theground.io` if relevant). Common Crawl absence is inconclusive — GSC is the source of truth.

## IndexNow + sitemap lastmod

- Live sitemap is served from the API (`/api/sitemap.xml` → proxied at `/sitemap.xml`).
- Per-venue `lastmod` comes from `updated_at` or a content hash (`lib/sitemap.js` → `venueContentLastmod`).
- Venue create/update/delete already notifies IndexNow from `server/index.js`.
- After large catalog edits, run `npm run seo:submit-indexnow` once.

## AggregateRating / reviews

Schema emits `aggregateRating` **only** when a venue has real `rating_value` (1–5) and `review_count` (≥ 1). Do not invent scores for SEO.

## Google Business Profile / NAP spot-check

Once per quarter, pick 5–10 venues and verify:

- [ ] Name / address / phone consistent with the venue page
- [ ] Maps pin matches schema lat/lng
- [ ] Hours on GBP (if claimed) match on-page hours

Aggregator brand GBP is optional; per-operator venues may have their own listings.

## District doorway / duplicate swap-test

After district hubs ship or content changes:

```bash
npm run seo:check-content
```

Investigate any flagged `/search/{sport}/{district}` hubs and near-duplicate chain pairs before scaling more programmatic URLs.

## Discovery assets (must stay live)

| URL | Role |
|---|---|
| `/llms.txt` | Agent-oriented site map |
| `/.well-known/ai-catalog.json` | Machine-readable discovery |
| `/robots.txt` | Crawl + sitemap pointer |
| `/a7f3c9e2b18d4f6a0e5c2b9d7f1a8e3c.txt` | IndexNow key file |
| `/sitemap.xml` | URL inventory (+ image entries) |
| `/okf` / `/okf.tar.gz` | Structured Markdown corpus |

Verify with `npm run seo:check-discovery`.
