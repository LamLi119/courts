/**
 * Fetches public venues and sports from the API and writes public/sitemap.xml.
 * Run before `vite build` so the sitemap is included in dist/.
 */
import fs from 'fs';
import http from 'node:http';
import https from 'node:https';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_PATH = path.join(ROOT, 'public', 'sitemap.xml');
const BOOTSTRAP_PATH = path.join(ROOT, 'public', 'venues-bootstrap.json');
const CACHE_DIR = path.join(ROOT, 'scripts', '.sitemap-cache');

const BASE_URL = (process.env.SITEMAP_BASE_URL || 'https://courts.theground.io').replace(/\/$/, '');
const FETCH_TIMEOUT_MS = Number(process.env.SITEMAP_FETCH_TIMEOUT_MS || 60_000);
const FETCH_RETRIES = Number(process.env.SITEMAP_FETCH_RETRIES || 3);

/** Sitemap always targets production data unless SITEMAP_API_URL is set explicitly. */
function resolveApiUrl() {
  if (process.env.SITEMAP_API_URL) {
    return process.env.SITEMAP_API_URL.replace(/\/$/, '');
  }

  const vite = (process.env.VITE_API_URL || '').replace(/\/$/, '');
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(vite)) {
    return vite;
  }

  return 'https://courts.api.theground.io';
}

const API_URL = resolveApiUrl();

/** Match src/utils/slugify.ts */
function slugify(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}-]/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function urlEntry(loc, { changefreq = 'monthly', priority = '0.5' } = {}) {
  const lastmod = new Date().toISOString().slice(0, 10);
  return [
    '  <url>',
    `    <loc>${escapeXml(loc)}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    '  </url>',
  ].join('\n');
}

function formatFetchError(err) {
  const parts = [err?.message || String(err)];
  let cause = err?.cause;
  while (cause) {
    const code = cause.code ? ` [${cause.code}]` : '';
    parts.push(`  caused by: ${cause.message || cause}${code}`);
    cause = cause.cause;
  }
  return parts.join('\n');
}

function fetchJsonOnce(url) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;

    const req = lib.request(
      parsed,
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
        timeout: FETCH_TIMEOUT_MS,
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          fetchJsonOnce(new URL(res.headers.location, url).href).then(resolve, reject);
          return;
        }

        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode} ${res.statusMessage || ''}`.trim()));
          return;
        }

        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
          } catch (err) {
            reject(new Error(`Invalid JSON from ${url}: ${err.message}`));
          }
        });
      }
    );

    req.on('timeout', () => {
      req.destroy(new Error(`Request timed out after ${FETCH_TIMEOUT_MS}ms`));
    });
    req.on('error', reject);
    req.end();
  });
}

async function fetchJson(url) {
  let lastErr;
  for (let attempt = 1; attempt <= FETCH_RETRIES; attempt++) {
    try {
      console.log(`Fetching ${url}${attempt > 1 ? ` (attempt ${attempt}/${FETCH_RETRIES})` : ''}…`);
      return await fetchJsonOnce(url);
    } catch (err) {
      lastErr = err;
      if (attempt < FETCH_RETRIES) {
        console.warn(`Fetch failed:\n${formatFetchError(err)}`);
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
  throw new Error(`GET ${url} failed after ${FETCH_RETRIES} attempts:\n${formatFetchError(lastErr)}`);
}

function readCache(name) {
  const filePath = path.join(CACHE_DIR, `${name}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing cache file: ${filePath}`);
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    throw new Error(`Invalid cache file ${filePath}: ${err.message}. Delete scripts/.sitemap-cache/ and retry.`);
  }
}

function hasValidCache() {
  try {
    readCache('sports');
    readCache('venues');
    return true;
  } catch {
    return false;
  }
}

async function writeCache(name, data) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(path.join(CACHE_DIR, `${name}.json`), JSON.stringify(data));
}

function stripVenueForBootstrap(venue) {
  if (!venue || typeof venue !== 'object') return venue;
  const { admin_password, has_admin_password, ...rest } = venue;
  return rest;
}

function writeVenuesBootstrap({ sports, venues }) {
  const payload = {
    generatedAt: new Date().toISOString(),
    sports: sports || [],
    venues: (venues || []).map(stripVenueForBootstrap),
  };
  fs.mkdirSync(path.dirname(BOOTSTRAP_PATH), { recursive: true });
  fs.writeFileSync(BOOTSTRAP_PATH, JSON.stringify(payload));
}

async function loadData({ cacheOnly = false } = {}) {
  if (cacheOnly) {
    console.log('Using cached API data from scripts/.sitemap-cache/');
    return {
      sports: readCache('sports'),
      venues: readCache('venues'),
    };
  }

  try {
    const sports = await fetchJson(`${API_URL}/api/sports`);
    const venues = await fetchJson(`${API_URL}/api/venues`);
    await writeCache('sports', sports);
    await writeCache('venues', venues);
    console.log('Cached API responses to scripts/.sitemap-cache/');
    return { sports, venues };
  } catch (err) {
    if (hasValidCache()) {
      console.warn('Live fetch failed; falling back to cached API data.\n' + formatFetchError(err));
      return {
        sports: readCache('sports'),
        venues: readCache('venues'),
      };
    }
    throw err;
  }
}

function venueMatchesSportSlug(venue, sportSlug) {
  const slug = (sportSlug || '').toLowerCase().trim();
  if (!slug) return false;
  const types = venue?.sport_types;
  const data = venue?.sport_data;
  const name = String(venue?.name ?? '').toLowerCase();
  const desc = String(venue?.description ?? '').toLowerCase();
  const hasSportBySlug = Array.isArray(data)
    && data.some((d) => String(d?.slug || '').toLowerCase().trim() === slug);
  const hasSportByName = Array.isArray(types)
    && types.some((t) => String(t).toLowerCase().trim() === slug);
  return hasSportBySlug || hasSportByName || name.includes(slug) || desc.includes(slug);
}

function buildSitemap({ sports, venues }) {
  const urls = [];
  const seen = new Set();
  const venueList = venues || [];
  const sportList = sports || [];

  function add(loc, opts) {
    if (seen.has(loc)) return;
    seen.add(loc);
    urls.push({ loc, opts });
  }

  add(`${BASE_URL}/`, { changefreq: 'weekly', priority: '1.0' });
  add(`${BASE_URL}/explore`, { changefreq: 'weekly', priority: '0.9' });
  add(`${BASE_URL}/upcoming-events`, { changefreq: 'weekly', priority: '0.6' });

  for (const sport of sportList) {
    const slug = sport?.slug;
    if (!slug) continue;
    const count = venueList.filter((v) => venueMatchesSportSlug(v, slug)).length;
    if (count === 0) continue;
    add(`${BASE_URL}/search/${slug}`, { changefreq: 'weekly', priority: '0.8' });
  }

  for (const venue of venueList) {
    const slug = slugify(venue?.name);
    if (!slug) continue;
    add(`${BASE_URL}/venues/${slug}`, { changefreq: 'monthly', priority: '0.7' });
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map(({ loc, opts }) => urlEntry(loc, opts)),
    '</urlset>',
    '',
  ].join('\n');
}

async function main() {
  const cacheOnly = process.argv.includes('--cache-only');

  console.log(`Sitemap base URL: ${BASE_URL}`);
  console.log(`API URL: ${API_URL}`);

  const { sports, venues } = await loadData({ cacheOnly });
  const xml = buildSitemap({ sports, venues });
  writeVenuesBootstrap({ sports, venues });

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, xml, 'utf8');

  const urlCount = (xml.match(/<loc>/g) || []).length;
  console.log(`Wrote ${urlCount} URLs to public/sitemap.xml`);
  console.log(`Wrote venues bootstrap (${(venues || []).length} venues) to public/venues-bootstrap.json`);
}

main().catch((err) => {
  console.error('generate-sitemap failed:\n' + formatFetchError(err));
  console.error('\nTips:');
  console.error('  • Test API: curl -I ' + API_URL + '/api/sports');
  console.error('  • Local server: SITEMAP_API_URL=http://localhost:3001 npm run generate-sitemap');
  console.error('  • Force prod API: SITEMAP_API_URL=https://courts.api.theground.io npm run generate-sitemap');
  console.error('  • Remove bad cache: rm -rf scripts/.sitemap-cache');
  console.error('  • Offline cache: npm run generate-sitemap -- --cache-only');
  process.exit(1);
});
