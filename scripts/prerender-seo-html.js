/**
 * After `vite build`, write static HTML shells with page-specific title/canonical/meta/JSON-LD
 * for home, /explore, /search/:sport, and /venues/:slug so crawlers get unique raw HTML.
 *
 * Reads dist/index.html + public/venues-bootstrap.json (written by generate-sitemap.js).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildVenueOgMeta, injectPageSeoIntoHtml, slugifyVenueName } from '../lib/venueOgMeta.js';
import {
  buildExplorePageMeta,
  buildHomePageMeta,
  buildSearchPageMeta,
} from '../lib/pageSeoMeta.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const BOOTSTRAP_PATH = path.join(ROOT, 'public', 'venues-bootstrap.json');
const BASE_URL = (process.env.SITEMAP_BASE_URL || 'https://courts.theground.io').replace(/\/$/, '');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeHtml(relPath, html) {
  const full = path.join(DIST, relPath);
  ensureDir(path.dirname(full));
  fs.writeFileSync(full, html, 'utf8');
}

function main() {
  const indexPath = path.join(DIST, 'index.html');
  if (!fs.existsSync(indexPath)) {
    console.error('prerender-seo-html: dist/index.html missing — run vite build first');
    process.exit(1);
  }

  const shell = fs.readFileSync(indexPath, 'utf8');
  let venues = [];
  let sports = [];

  if (fs.existsSync(BOOTSTRAP_PATH)) {
    try {
      const bootstrap = JSON.parse(fs.readFileSync(BOOTSTRAP_PATH, 'utf8'));
      venues = Array.isArray(bootstrap.venues) ? bootstrap.venues : [];
      sports = Array.isArray(bootstrap.sports) ? bootstrap.sports : [];
    } catch (err) {
      console.warn('prerender-seo-html: failed to parse venues-bootstrap.json:', err?.message || err);
    }
  } else {
    console.warn('prerender-seo-html: venues-bootstrap.json missing — writing shells with empty venue lists');
  }

  const homeMeta = buildHomePageMeta({ venues, sports, origin: BASE_URL, lang: 'en' });
  writeHtml('index.html', injectPageSeoIntoHtml(shell, homeMeta));

  const exploreMeta = buildExplorePageMeta({ venues, origin: BASE_URL, lang: 'en' });
  writeHtml(path.join('explore', 'index.html'), injectPageSeoIntoHtml(shell, exploreMeta));

  const sportSlugs = new Set(sports.map((s) => s.slug).filter(Boolean));
  // Always include known high-traffic slugs from sitemap even if sports list is empty.
  for (const slug of [
    'pickleball',
    'pickleball-indoor',
    'pickleball-outdoor',
    'indoor-tennis-practice-centre',
  ]) {
    sportSlugs.add(slug);
  }

  for (const sportSlug of sportSlugs) {
    const meta = buildSearchPageMeta({
      sportSlug,
      venues,
      sports,
      origin: BASE_URL,
      lang: 'en',
    });
    writeHtml(path.join('search', sportSlug, 'index.html'), injectPageSeoIntoHtml(shell, meta));
  }

  let venueCount = 0;
  for (const venue of venues) {
    const slug = slugifyVenueName(venue?.name);
    if (!slug) continue;
    const pageUrl = `${BASE_URL}/venues/${slug}`;
    const meta = buildVenueOgMeta(venue, { pageUrl, origin: BASE_URL, lang: 'en' });
    writeHtml(path.join('venues', slug, 'index.html'), injectPageSeoIntoHtml(shell, meta));
    venueCount += 1;
  }

  console.log(
    `prerender-seo-html: wrote home + explore + ${sportSlugs.size} search pages + ${venueCount} venue pages`
  );
}

main();
