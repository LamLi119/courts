/**
 * Phase 4: verify every sitemap URL returns HTTP 200 and is not noindex.
 *
 * Usage: node scripts/seo-check-sitemap.js
 *        SEO_CONCURRENCY=8 node scripts/seo-check-sitemap.js
 *        SEO_SITEMAP_URL=https://courts.theground.io/sitemap.xml node scripts/seo-check-sitemap.js
 */
import {
  siteBaseUrl,
  fetchText,
  parseSitemapLocs,
  hasNoindex,
} from './seo-lib.js';

const CONCURRENCY = Math.max(1, Number(process.env.SEO_CONCURRENCY || 6));

async function mapPool(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return out;
}

async function main() {
  const base = siteBaseUrl();
  const sitemapUrl = process.env.SEO_SITEMAP_URL || `${base}/sitemap.xml`;
  console.log(`Fetching sitemap: ${sitemapUrl}`);

  const sitemap = await fetchText(sitemapUrl);
  if (sitemap.status !== 200) {
    console.error(`Sitemap HTTP ${sitemap.status}`);
    process.exit(1);
  }

  const locs = parseSitemapLocs(sitemap.body);
  console.log(`Checking ${locs.length} URLs (concurrency=${CONCURRENCY})…`);

  const results = await mapPool(locs, CONCURRENCY, async (url) => {
    try {
      const res = await fetchText(url, { timeoutMs: 45_000 });
      const noindex = hasNoindex(res.body, res.headers);
      const ok = res.status === 200 && !noindex;
      return {
        url,
        status: res.status,
        noindex,
        ok,
        redirectHint: res.url !== url ? res.url : null,
      };
    } catch (err) {
      return { url, status: 0, noindex: false, ok: false, error: err.message };
    }
  });

  const failures = results.filter((r) => !r.ok);
  const noindexHits = results.filter((r) => r.noindex);
  const non200 = results.filter((r) => r.status !== 200);

  console.log('\n=== Sitemap URL health ===');
  console.log(`Total: ${results.length}`);
  console.log(`HTTP 200 + indexable: ${results.length - failures.length}`);
  console.log(`Non-200: ${non200.length}`);
  console.log(`noindex: ${noindexHits.length}`);

  if (failures.length) {
    console.log('\nFailures:');
    for (const f of failures.slice(0, 50)) {
      const detail = f.error
        ? f.error
        : `status=${f.status}${f.noindex ? ' noindex' : ''}`;
      console.log(`  ${f.url}  (${detail})`);
    }
    if (failures.length > 50) console.log(`  … and ${failures.length - 50} more`);
  }

  // lastmod sanity: warn if every lastmod is identical
  const lastmods = [...sitemap.body.matchAll(/<lastmod>\s*([^<]+)\s*<\/lastmod>/gi)].map((m) => m[1].trim());
  const uniqueLastmod = new Set(lastmods);
  if (lastmods.length > 10 && uniqueLastmod.size === 1) {
    console.warn(`\nWARN: all ${lastmods.length} lastmod values are identical (${[...uniqueLastmod][0]}). Prefer per-venue timestamps.`);
  } else {
    console.log(`\nlastmod diversity: ${uniqueLastmod.size} unique dates across ${lastmods.length} entries`);
  }

  process.exit(failures.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
