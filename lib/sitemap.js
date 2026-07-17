/**
 * Shared sitemap XML builder (build script + Express live endpoint).
 * Venue slug algorithm must match src/utils/slugify.ts / lib/venueOgMeta.js.
 */

import { HK_DISTRICTS, venueMatchesDistricts } from './hkDistricts.js';

const DEFAULT_BASE_URL = 'https://courts.theground.io';

/** Match src/utils/slugify.ts */
export function slugifyVenueName(text) {
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

function urlEntry(loc, { changefreq = 'monthly', priority = '0.5', lastmod } = {}) {
  const mod = lastmod || new Date().toISOString().slice(0, 10);
  return [
    '  <url>',
    `    <loc>${escapeXml(loc)}</loc>`,
    `    <lastmod>${mod}</lastmod>`,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    '  </url>',
  ].join('\n');
}

export function venueMatchesSportSlug(venue, sportSlug) {
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

/**
 * @param {{ sports?: any[], venues?: any[], baseUrl?: string, lastmod?: string }} opts
 * @returns {string} sitemap XML
 */
export function buildSitemapXml({ sports, venues, baseUrl, lastmod } = {}) {
  const BASE_URL = (baseUrl || process.env.SITEMAP_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
  const urls = [];
  const seen = new Set();
  const venueList = venues || [];
  const sportList = sports || [];
  const mod = lastmod || new Date().toISOString().slice(0, 10);

  function add(loc, opts) {
    if (seen.has(loc)) return;
    seen.add(loc);
    urls.push({ loc, opts: { ...opts, lastmod: mod } });
  }

  add(`${BASE_URL}/`, { changefreq: 'weekly', priority: '1.0' });
  add(`${BASE_URL}/explore`, { changefreq: 'weekly', priority: '0.9' });
  add(`${BASE_URL}/upcoming-events`, { changefreq: 'weekly', priority: '0.6' });

  for (const sport of sportList) {
    const slug = sport?.slug;
    if (!slug) continue;
    const sportVenues = venueList.filter((v) => venueMatchesSportSlug(v, slug));
    if (sportVenues.length === 0) continue;
    add(`${BASE_URL}/search/${slug}`, { changefreq: 'weekly', priority: '0.8' });

    for (const district of HK_DISTRICTS) {
      const count = sportVenues.filter((v) => venueMatchesDistricts(v, [district.slug])).length;
      if (count === 0) continue;
      add(`${BASE_URL}/search/${slug}/${district.slug}`, {
        changefreq: 'weekly',
        priority: '0.7',
      });
    }
  }

  for (const venue of venueList) {
    const slug = slugifyVenueName(venue?.name);
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
