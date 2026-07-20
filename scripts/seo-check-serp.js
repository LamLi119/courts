/**
 * Phase 4: SERP traction checklist (manual queries + GSC pointers).
 *
 * Usage: node scripts/seo-check-serp.js
 *        SITEMAP_BASE_URL=https://courts.theground.io node scripts/seo-check-serp.js
 *
 * Note: Google does not offer a free programmatic SERP API. This script prints
 * the audit's core queries, branded checks, and Search Console links for your ops log.
 */
import { apiBaseUrl } from './seo-lib.js';

const BASE = (process.env.SITEMAP_BASE_URL || 'https://courts.theground.io').replace(/\/$/, '');

const CORE_QUERIES = [
  { q: 'pickleball courts Hong Kong', why: 'Head non-branded demand' },
  { q: '室內網球場 香港', why: 'Indoor tennis category' },
  { q: '觀塘 匹克球 場地', why: 'District × sport persona' },
  { q: 'Courts The Ground', why: 'Branded' },
  { q: 'courts.theground.io', why: 'Domain branded' },
];

async function main() {
  console.log('=== SERP traction checklist ===');
  console.log(`Site: ${BASE}`);
  console.log(`Date: ${new Date().toISOString().slice(0, 10)}\n`);

  console.log('Re-check these in Google (incognito) or Google Search Console → Performance every 4–6 weeks after SEO ships:\n');
  for (const { q, why } of CORE_QUERIES) {
    console.log(`  • "${q}" — ${why}`);
    console.log(`    Manual: https://www.google.com/search?q=${encodeURIComponent(q)}`);
  }

  console.log('\nSearch Console (source of truth for impressions/clicks):');
  console.log('  https://search.google.com/search-console');
  console.log(`  Property: ${BASE}`);
  console.log('  Links report: compare courts.theground.io vs theground.io');

  console.log('\nCompetitor spot-check: pickle.hk for "pickleball courts Hong Kong"');

  const api = apiBaseUrl();
  try {
    const res = await fetch(`${BASE}/`, { method: 'HEAD', redirect: 'follow' });
    console.log(`\nLive homepage: HTTP ${res.status} (${BASE}/)`);
  } catch (err) {
    console.warn('\nCould not reach homepage:', err?.message || err);
  }

  try {
    const sampleVenue = await fetch(`${api}/api/venues`).then((r) => r.json());
    const list = Array.isArray(sampleVenue) ? sampleVenue : [];
    console.log(`API venues: ${list.length} (content freshness drives long-tail SERP)`);
  } catch {
    console.log('API venue count: skipped (set SITEMAP_API_URL / VITE_API_URL)');
  }

  console.log('\nDone. Record position/impression notes in your ops log — not in git unless you want history.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
