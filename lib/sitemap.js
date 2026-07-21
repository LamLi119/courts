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

/** Stable lastmod that changes only when venue content changes (or real updated_at). */
export function venueContentLastmod(venue) {
  const rawUpdated = venue?.updated_at || venue?.updatedAt;
  if (rawUpdated) {
    const d = new Date(rawUpdated);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }

  const payload = JSON.stringify({
    name: venue?.name,
    description: venue?.description,
    address: venue?.address,
    mtrStation: venue?.mtrStation,
    pricing: venue?.pricing,
    images: venue?.images,
    startingPrice: venue?.startingPrice,
    court_count: venue?.court_count,
    amenities: venue?.amenities,
    operating_hours: venue?.operating_hours,
    membership_description: venue?.membership_description,
    coordinates: venue?.coordinates,
  });

  let hash = 2166136261;
  for (let i = 0; i < payload.length; i++) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  hash >>>= 0;

  const start = Date.UTC(2024, 0, 1);
  const span = Math.max(1, Date.now() - start);
  const t = start + (hash % span);
  return new Date(t).toISOString().slice(0, 10);
}

function latestVenueLastmod(venues) {
  if (!Array.isArray(venues) || venues.length === 0) {
    return new Date().toISOString().slice(0, 10);
  }
  let best = '1970-01-01';
  for (const v of venues) {
    const m = venueContentLastmod(v);
    if (m > best) best = m;
  }
  return best;
}

function blogPostLastmod(post) {
  const raw = post?.updated_at || post?.synced_at || post?.published_at;
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function latestBlogLastmod(posts) {
  if (!Array.isArray(posts) || posts.length === 0) return null;
  let best = '1970-01-01';
  for (const post of posts) {
    const m = blogPostLastmod(post);
    if (m && m > best) best = m;
  }
  return best === '1970-01-01' ? null : best;
}

function imageEntries(venue, baseUrl) {
  const images = Array.isArray(venue?.images) ? venue.images : [];
  const title = escapeXml(venue?.name || 'Court');
  const lines = [];
  for (const raw of images.slice(0, 8)) {
    if (!raw || typeof raw !== 'string') continue;
    if (raw.startsWith('data:')) continue;
    let loc = raw.trim();
    if (loc.startsWith('/')) loc = `${baseUrl}${loc}`;
    if (!/^https?:\/\//i.test(loc)) continue;
    lines.push('    <image:image>');
    lines.push(`      <image:loc>${escapeXml(loc)}</image:loc>`);
    lines.push(`      <image:title>${title}</image:title>`);
    lines.push('    </image:image>');
  }
  return lines;
}

function urlEntry(loc, { changefreq = 'monthly', priority = '0.5', lastmod, images } = {}) {
  const mod = lastmod || new Date().toISOString().slice(0, 10);
  const parts = [
    '  <url>',
    `    <loc>${escapeXml(loc)}</loc>`,
    `    <lastmod>${mod}</lastmod>`,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
  ];
  if (Array.isArray(images) && images.length) {
    parts.push(...images);
  }
  parts.push('  </url>');
  return parts.join('\n');
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
 * @param {{ sports?: any[], venues?: any[], blogPosts?: any[], baseUrl?: string, lastmod?: string }} opts
 * @returns {string} sitemap XML
 */
export function buildSitemapXml({ sports, venues, blogPosts, baseUrl, lastmod } = {}) {
  const BASE_URL = (baseUrl || process.env.SITEMAP_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
  const urls = [];
  const seen = new Set();
  const venueList = venues || [];
  const sportList = sports || [];
  const posts = blogPosts || [];
  const catalogMod = lastmod || latestVenueLastmod(venueList);

  function add(loc, opts) {
    if (seen.has(loc)) return;
    seen.add(loc);
    urls.push({ loc, opts });
  }

  add(`${BASE_URL}/`, { changefreq: 'weekly', priority: '1.0', lastmod: catalogMod });
  add(`${BASE_URL}/explore`, { changefreq: 'weekly', priority: '0.9', lastmod: catalogMod });
  add(`${BASE_URL}/about`, { changefreq: 'monthly', priority: '0.5', lastmod: catalogMod });
  add(`${BASE_URL}/upcoming-events`, { changefreq: 'weekly', priority: '0.6', lastmod: catalogMod });
  add(`${BASE_URL}/blog`, {
    changefreq: 'weekly',
    priority: '0.6',
    lastmod: latestBlogLastmod(posts) || catalogMod,
  });

  for (const sport of sportList) {
    const slug = sport?.slug;
    if (!slug) continue;
    const sportVenues = venueList.filter((v) => venueMatchesSportSlug(v, slug));
    if (sportVenues.length === 0) continue;
    add(`${BASE_URL}/search/${slug}`, {
      changefreq: 'weekly',
      priority: '0.8',
      lastmod: latestVenueLastmod(sportVenues),
    });

    for (const district of HK_DISTRICTS) {
      const districtVenues = sportVenues.filter((v) => venueMatchesDistricts(v, [district.slug]));
      if (districtVenues.length === 0) continue;
      add(`${BASE_URL}/search/${slug}/${district.slug}`, {
        changefreq: 'weekly',
        priority: '0.7',
        lastmod: latestVenueLastmod(districtVenues),
      });
    }
  }

  for (const venue of venueList) {
    const slug = slugifyVenueName(venue?.name);
    if (!slug) continue;
    add(`${BASE_URL}/venues/${slug}`, {
      changefreq: 'monthly',
      priority: '0.7',
      lastmod: venueContentLastmod(venue),
      images: imageEntries(venue, BASE_URL),
    });
  }

  for (const post of posts) {
    const slug = String(post?.slug || '').trim();
    if (!slug) continue;
    const images = [];
    if (post?.cover_url && /^https?:\/\//i.test(post.cover_url)) {
      images.push('    <image:image>');
      images.push(`      <image:loc>${escapeXml(post.cover_url)}</image:loc>`);
      images.push(`      <image:title>${escapeXml(post.title || 'Blog')}</image:title>`);
      images.push('    </image:image>');
    }
    add(`${BASE_URL}/blog/${slug}`, {
      changefreq: 'monthly',
      priority: '0.6',
      lastmod: blogPostLastmod(post) || catalogMod,
      images,
    });
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    ...urls.map(({ loc, opts }) => urlEntry(loc, opts)),
    '</urlset>',
    '',
  ].join('\n');
}
