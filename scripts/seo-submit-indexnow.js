/**
 * Phase 4: submit sitemap URLs to IndexNow (Bing / Yandex / etc.).
 *
 * Usage: node scripts/seo-submit-indexnow.js
 *        node scripts/seo-submit-indexnow.js --dry-run
 *        SEO_INDEXNOW_LIMIT=50 node scripts/seo-submit-indexnow.js
 *
 * Requires INDEXNOW_KEY in env (see .env.example) and public/<key>.txt deployed.
 */
import { siteBaseUrl, fetchText, parseSitemapLocs } from './seo-lib.js';
import { submitIndexNowUrls, getIndexNowKey } from '../lib/indexnow.js';

const BATCH = 100;

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const key = getIndexNowKey();
  if (!key && !dryRun) {
    console.error('INDEXNOW_KEY is not set. Add it to .env (see .env.example).');
    process.exit(1);
  }

  const base = siteBaseUrl();
  const sitemapUrl = process.env.SEO_SITEMAP_URL || `${base}/sitemap.xml`;
  console.log(`Sitemap: ${sitemapUrl}`);

  const sitemap = await fetchText(sitemapUrl);
  if (sitemap.status !== 200) {
    console.error(`Sitemap HTTP ${sitemap.status}`);
    process.exit(1);
  }

  let urls = parseSitemapLocs(sitemap.body);
  const limit = Number(process.env.SEO_INDEXNOW_LIMIT || 0);
  if (limit > 0) urls = urls.slice(0, limit);

  console.log(`URLs to submit: ${urls.length}${dryRun ? ' (dry-run)' : ''}`);
  if (dryRun) {
    urls.slice(0, 10).forEach((u) => console.log(`  ${u}`));
    if (urls.length > 10) console.log(`  … +${urls.length - 10} more`);
    process.exit(0);
  }

  // Verify key file is publicly reachable before bulk submit
  const keyRes = await fetchText(`${base}/${key}.txt`);
  if (keyRes.status !== 200 || keyRes.body.trim() !== key) {
    console.error(`IndexNow key file missing or mismatch at ${base}/${key}.txt (HTTP ${keyRes.status})`);
    process.exit(1);
  }
  console.log('IndexNow key file OK');

  for (let i = 0; i < urls.length; i += BATCH) {
    const chunk = urls.slice(i, i + BATCH);
    console.log(`Submitting ${i + 1}–${i + chunk.length}…`);
    await submitIndexNowUrls(chunk);
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
