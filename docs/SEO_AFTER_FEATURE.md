# SEO follow-up (after features)

Courts Finder (`courts.theground.io`) is a Vue SPA. Crawlers that do not fully run JavaScript mainly see raw HTML. After any user-facing feature, run this checklist before considering the work done.

Related code: `src/utils/seo.ts`, `lib/venueOgMeta.js`, `lib/sitemap.js`, `scripts/generate-sitemap.js`, `public/llms.txt`, `index.html`.

---

## Must-do checklist

When the feature adds or changes a **public page / route / listing / venue field**:

1. **Crawlable links** — Cards and CTAs that go to venues, search, or district pages use real `<a href>` or `<router-link>`, not click-only `div` / `button` handlers.
2. **Unique title + meta + canonical** — Update `src/utils/seo.ts` (and `lib/venueOgMeta.js` if OG / server HTML inject is involved). Important pages must not keep a bare `"Courts"` title. Canonical must self-reference the page URL, not always `/`.
3. **One H1** — Each page has a single topic H1; logo and promo banners are not H1.
4. **Schema** — Listing pages: `CollectionPage` / `ItemList`. Venue pages: `SportsActivityLocation` (include hours, `addressCountry: HK`, breadcrumbs when a hierarchy exists). Do not fabricate ratings.
5. **Sitemap** — New indexable URLs go into the sitemap generator (`lib/sitemap.js` / `scripts/generate-sitemap.js`). Prefer real `lastmod` when content changes. Add image entries when new hero / gallery photos matter for discovery.
6. **No bad hreflang** — Do not point hreflang at off-domain URLs (e.g. legacy `thegrind-app.com`). Only add alternates when real language-variant URLs exist on this site.
7. **Images** — GCS images must load (bucket CORS / avoid unnecessary `crossorigin` on `<img>`). Set width/height or aspect-ratio; lazy-load below the fold. See [GCS_MAP_ICONS.md](./GCS_MAP_ICONS.md).
8. **Content uniqueness** — Do not rely on shared widgets (e.g. sitewide upcoming events) as the only page copy. Venue and category pages need unique descriptive text when possible.
9. **AI / discovery surfaces** — If public URLs or site purpose change, update `public/llms.txt` (and OKF / AI catalog pipelines if those are touched).
10. **Auth / performance** — Do not fire authenticated API calls that 401 on every anonymous page load; keep the initial render lean for crawlers.

---

## When adding a new public route

- Register the route in `src/router/index.ts` with a meaningful `meta.title`.
- Wire SEO apply / reset in the page component (same pattern as venue detail and landing).
- Add the URL to the sitemap if it should be indexed; use `noindex` (or omit from sitemap) for admin, login, and other private flows.
- Prefer indexable URLs for district × sport filters — not only client-side filter state with no URL.

---

## Out of scope for a normal feature PR (flag if blocked)

- Full SSR / SSG for all ~85 known routes (architecture track) — still: do not make client-side crawlability worse.
- Cross-domain brand consolidation (`courts` vs `www` vs `join` vs legacy blog).

---

## Done definition

A feature is not SEO-done until:

- Real crawlable links exist for new navigable content
- Title, canonical, and meta are page-specific where applicable
- Schema and sitemap are updated if needed
- No new thin-duplicate content or CORS / image regressions were introduced
