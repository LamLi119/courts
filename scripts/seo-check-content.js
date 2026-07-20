/**
 * Phase 4: venue content uniqueness + district landing doorway-risk audit.
 *
 * Usage: node scripts/seo-check-content.js
 *        SITEMAP_API_URL=https://courts.api.theground.io node scripts/seo-check-content.js
 *
 * Flags thin venue copy, near-duplicate chain pages, and thin district×sport hubs.
 */
import {
  apiBaseUrl,
  fetchJson,
  textSimilarity,
  wordCount,
} from './seo-lib.js';
import { HK_DISTRICTS, venueMatchesDistricts } from '../lib/hkDistricts.js';
import { venueMatchesSportSlug, slugifyVenueName } from '../lib/sitemap.js';

const MIN_VENUE_WORDS = Number(process.env.SEO_MIN_VENUE_WORDS || 40);
const DUP_THRESHOLD = Number(process.env.SEO_DUP_THRESHOLD || 0.85);
const MIN_DISTRICT_VENUES = Number(process.env.SEO_MIN_DISTRICT_VENUES || 1);
const HARD_STOP_VENUE_COUNT = 50;

function venueBodyText(v) {
  const parts = [
    v?.name,
    v?.description,
    v?.address,
    v?.mtrStation,
    v?.membership_description,
    Array.isArray(v?.amenities) ? v.amenities.join(' ') : '',
    typeof v?.pricing?.content === 'string' ? v.pricing.content : '',
  ];
  return parts.filter(Boolean).join(' ');
}

function chainKey(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(tin hau|tko|tseung kwan o|kwun tong|sha tin|kowloon bay|wong chuk hang|central|causeway bay)\b/gi, ' ')
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

async function main() {
  const api = apiBaseUrl();
  console.log(`Loading venues/sports from ${api}`);
  const [venues, sports] = await Promise.all([
    fetchJson(`${api}/api/venues`),
    fetchJson(`${api}/api/sports`),
  ]);

  const venueList = Array.isArray(venues) ? venues : [];
  const sportList = Array.isArray(sports) ? sports : [];
  console.log(`Venues: ${venueList.length}  Sports: ${sportList.length}`);

  if (venueList.length >= HARD_STOP_VENUE_COUNT) {
    console.log(`\nNOTE: ${venueList.length} venue pages ≥ ${HARD_STOP_VENUE_COUNT} (location-page quality gate). Uniqueness checks below matter more.`);
  }

  // --- Thin content ---
  const thin = [];
  for (const v of venueList) {
    const descWords = wordCount(v?.description);
    const totalWords = wordCount(venueBodyText(v));
    if (descWords < MIN_VENUE_WORDS) {
      thin.push({
        name: v.name,
        slug: slugifyVenueName(v.name),
        descWords,
        totalWords,
      });
    }
  }

  console.log(`\n=== Thin venue descriptions (< ${MIN_VENUE_WORDS} words) ===`);
  console.log(`${thin.length}/${venueList.length} venues`);
  for (const t of thin.slice(0, 30)) {
    console.log(`  ${t.slug || t.name}: description=${t.descWords}w total=${t.totalWords}w`);
  }
  if (thin.length > 30) console.log(`  … and ${thin.length - 30} more`);

  // --- Near-duplicate pairs ---
  const dups = [];
  for (let i = 0; i < venueList.length; i++) {
    for (let j = i + 1; j < venueList.length; j++) {
      const a = venueList[i];
      const b = venueList[j];
      const sameChain = chainKey(a.name) && chainKey(a.name) === chainKey(b.name);
      const sim = textSimilarity(a.description || '', b.description || '');
      const memSim = textSimilarity(a.membership_description || '', b.membership_description || '');
      if (sim >= DUP_THRESHOLD || (sameChain && memSim >= DUP_THRESHOLD && wordCount(a.membership_description) > 20)) {
        dups.push({
          a: a.name,
          b: b.name,
          descSim: sim.toFixed(2),
          memSim: memSim.toFixed(2),
          sameChain,
        });
      }
    }
  }

  console.log(`\n=== Near-duplicate venue copy (similarity ≥ ${DUP_THRESHOLD}) ===`);
  console.log(`${dups.length} pairs`);
  for (const d of dups.slice(0, 25)) {
    console.log(`  "${d.a}" ↔ "${d.b}"  desc=${d.descSim} membership=${d.memSim}${d.sameChain ? ' [chain]' : ''}`);
  }
  if (dups.length > 25) console.log(`  … and ${dups.length - 25} more`);

  // --- District × sport doorway risk ---
  const districtIssues = [];
  for (const sport of sportList) {
    const slug = sport?.slug;
    if (!slug) continue;
    const sportVenues = venueList.filter((v) => venueMatchesSportSlug(v, slug));
    if (!sportVenues.length) continue;

    for (const district of HK_DISTRICTS) {
      const districtVenues = sportVenues.filter((v) => venueMatchesDistricts(v, [district.slug]));
      if (districtVenues.length < MIN_DISTRICT_VENUES) continue;

      const uniqueDescs = new Set(
        districtVenues.map((v) => String(v.description || '').trim().toLowerCase()).filter(Boolean)
      );
      const avgDescWords =
        districtVenues.reduce((sum, v) => sum + wordCount(v.description), 0) / districtVenues.length;

      // Doorway risk: many venues but almost no unique descriptive copy
      if (districtVenues.length >= 3 && uniqueDescs.size <= 1 && avgDescWords < MIN_VENUE_WORDS) {
        districtIssues.push({
          path: `/search/${slug}/${district.slug}`,
          count: districtVenues.length,
          uniqueDescs: uniqueDescs.size,
          avgDescWords: Math.round(avgDescWords),
          reason: 'thin shared copy across venues',
        });
      }
    }
  }

  console.log('\n=== District × sport doorway risk ===');
  console.log(`${districtIssues.length} hubs flagged`);
  for (const d of districtIssues.slice(0, 40)) {
    console.log(`  ${d.path}: ${d.count} venues, uniqueDescs=${d.uniqueDescs}, avgDescWords=${d.avgDescWords} (${d.reason})`);
  }

  const failed = thin.length > venueList.length * 0.5 || dups.length > 0;
  console.log(`\nSummary: thin=${thin.length} dups=${dups.length} districtFlags=${districtIssues.length}`);
  console.log(failed ? 'Result: needs content work (exit 1 if dups or >50% thin)' : 'Result: content gate OK');
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
