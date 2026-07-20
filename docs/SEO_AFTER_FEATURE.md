# SEO after shipping a public feature

When you ship a user-facing change that adds/changes public URLs, copy, or venue data, run this short checklist so crawlers and IndexNow stay in sync.

## Before merge

1. New public routes appear in `lib/sitemap.js` (or are intentionally `noindex`).
2. Titles/canonicals are page-specific (prerender / SSR / meta helpers — not only client hydration).
3. Cards and nav use real `<a href>` (or `router-link`) to those URLs.
4. Venue schema stays accurate (`src/utils/seo.ts`); do not add fake ratings.

## After deploy

```bash
npm run seo:check-discovery
npm run seo:check-sitemap
```

If many venue pages changed:

```bash
npm run seo:submit-indexnow
```

If you added district hubs or a lot of templated copy:

```bash
npm run seo:check-content
```

## Ongoing cadence

See [SEO_MONITORING.md](./SEO_MONITORING.md) for monthly PSI/CrUX, SERP spot-checks, GBP/NAP, and IndexNow notes.
