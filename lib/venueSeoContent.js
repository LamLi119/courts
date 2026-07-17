/**
 * Citable venue/listing prose + static HTML for prerender (Node build scripts).
 * Logic mirrors src/utils/venueContent.ts — keep in sync when changing copy rules.
 */

import {
  getDistrictBySlug,
  getDistrictDisplayName,
  getRegionDisplayName,
  getVenueDistrictSlug,
} from './hkDistricts.js';
import { slugifyVenueName } from './venueOgMeta.js';

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function clean(s) {
  return typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '';
}

function numOrNull(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function sportLabel(venue, lang = 'en') {
  const data = venue?.sport_data;
  if (Array.isArray(data) && data.length > 0) {
    const labels = data
      .map((d) => (lang === 'zh' && d.name_zh ? d.name_zh : (d.name || '').trim()))
      .filter(Boolean);
    return labels.join(', ') || 'Court';
  }
  const types = venue?.sport_types;
  if (Array.isArray(types) && types.length > 0) {
    return types.map((t) => (typeof t === 'string' ? t.trim() : '')).filter(Boolean).join(', ') || 'Court';
  }
  return 'Court';
}

/** @returns {{ heading: string, paragraphs: string[] }[]} */
export function buildVenueSeoSections(venue, lang = 'en') {
  const sport = sportLabel(venue, lang);
  const districtSlug = getVenueDistrictSlug(venue);
  const district = districtSlug ? getDistrictDisplayName(districtSlug, lang) : '';
  const mtrRaw = clean(venue?.mtrStation);
  const mtr = mtrRaw || '';
  const exit = clean(venue?.mtrExit);
  const walk = numOrNull(venue?.walkingDistance);
  const courts = numOrNull(venue?.court_count);
  const price = numOrNull(venue?.startingPrice);
  const ceiling = numOrNull(venue?.ceilingHeight);
  const addr = clean(venue?.address);
  const amenities = Array.isArray(venue?.amenities)
    ? venue.amenities.map((a) => clean(a)).filter(Boolean)
    : [];
  const customDesc = clean(venue?.description?.replace?.(/<[^>]+>/g, ' ') || venue?.description);

  if (lang === 'zh') {
    const overview = [];
    if (customDesc && customDesc.length > 40) {
      overview.push(customDesc);
    }
    overview.push(
      `${venue.name}位於香港${district || '市區'}，提供${sport}場地服務。`
        + (addr ? `場館地址為${addr}。` : '')
        + (mtr
          ? `鄰近港鐵${mtr}${exit ? `（${exit}出口）` : ''}`
            + (walk != null && walk > 0 ? `，步行約${walk}分鐘` : '')
            + '。'
          : ''),
    );
    const facts = [];
    if (courts != null && courts > 0) facts.push(`場內約有${courts}個球場`);
    if (ceiling != null && ceiling > 0) facts.push(`網高約${ceiling}米`);
    if (price != null && price > 0) facts.push(`起步價約每小時$${price}`);
    if (facts.length) overview.push(`關於場地規格：${facts.join('；')}。請以場館最新公布為準。`);
    if (amenities.length) overview.push(`常用設施包括：${amenities.slice(0, 8).join('、')}。`);
    overview.push(
      `如需比較${district || '附近'}其他${sport}場地、收費與港鐵步行距離，可返回 Courts 以地區或運動類型繼續搜尋。`,
    );

    return [
      {
        heading: `如何前往${venue.name}？`,
        paragraphs: [
          mtr
            ? `多數訪客可經港鐵${mtr}${exit ? `（${exit}）` : ''}前往`
              + (walk != null && walk > 0 ? `，出站後步行約${walk}分鐘到達。` : '。')
              + (addr ? `詳細地址：${addr}。` : '')
            : (addr
              ? `${venue.name}地址為${addr}。可使用 Google 地圖取得路線。`
              : `請於場地詳情頁查看最新地址與開放時間。`),
        ],
      },
      {
        heading: `${venue.name}適合什麼用途？`,
        paragraphs: overview,
      },
    ];
  }

  const overview = [];
  if (customDesc && customDesc.length > 40) {
    overview.push(customDesc);
  }
  overview.push(
    `${venue.name} is a ${sport.toLowerCase()} venue`
      + (district ? ` in ${district}, Hong Kong` : ' in Hong Kong')
      + '.'
      + (addr ? ` The listed address is ${addr}.` : '')
      + (mtr
        ? ` It is near ${mtr} MTR`
          + (exit ? ` (Exit ${exit})` : '')
          + (walk != null && walk > 0 ? `, about a ${walk}-minute walk` : '')
          + '.'
        : ''),
  );
  const facts = [];
  if (courts != null && courts > 0) facts.push(`approximately ${courts} court${courts === 1 ? '' : 's'}`);
  if (ceiling != null && ceiling > 0) facts.push(`around ${ceiling}m ceiling height`);
  if (price != null && price > 0) facts.push(`starting from about HK$${price} per hour`);
  if (facts.length) {
    overview.push(
      `Venue details on Courts include ${facts.join(', ')}. Always confirm pricing and availability with the operator before booking.`,
    );
  }
  if (amenities.length) {
    overview.push(`Listed amenities include ${amenities.slice(0, 8).join(', ')}.`);
  }
  overview.push(
    `Use Courts to compare other ${sport.toLowerCase()} venues`
      + (district ? ` in ${district}` : ' across Hong Kong')
      + ', including MTR walking times and starting prices.',
  );

  return [
    {
      heading: `How do I get to ${venue.name}?`,
      paragraphs: [
        mtr
          ? `Most visitors reach ${venue.name} via ${mtr} MTR`
            + (exit ? ` (Exit ${exit})` : '')
            + (walk != null && walk > 0 ? `, then about a ${walk}-minute walk` : '')
            + '.'
            + (addr ? ` Address: ${addr}.` : '')
          : (addr
            ? `${venue.name} is listed at ${addr}. Use Get Directions on this page to open Google Maps.`
            : `Check the address and hours on this page, then open Google Maps for turn-by-turn directions.`),
      ],
    },
    {
      heading: `What should I know about ${venue.name}?`,
      paragraphs: overview,
    },
  ];
}

function sectionsToArticleHtml(sections, { h1, pageUrl } = {}) {
  const parts = ['<article data-seo-static="1" lang="en">'];
  if (h1) parts.push(`<h1>${escapeHtml(h1)}</h1>`);
  if (pageUrl) parts.push(`<p><a href="${escapeHtml(pageUrl)}">${escapeHtml(pageUrl)}</a></p>`);
  for (const sec of sections) {
    parts.push(`<h2>${escapeHtml(sec.heading)}</h2>`);
    for (const p of sec.paragraphs) {
      parts.push(`<p>${escapeHtml(p)}</p>`);
    }
  }
  parts.push('</article>');
  return parts.join('\n');
}

export function buildVenueStaticBodyHtml(venue, { pageUrl, lang = 'en' } = {}) {
  const sections = buildVenueSeoSections(venue, lang);
  const h1 = venue?.name ? `${venue.name} | ${sportLabel(venue, lang)}` : 'Venue';
  return sectionsToArticleHtml(sections, { h1, pageUrl });
}

export function buildListingStaticBodyHtml({
  title,
  intro,
  venues = [],
  baseUrl,
  limit = 80,
} = {}) {
  const base = (baseUrl || '').replace(/\/$/, '');
  const items = [];
  for (const v of venues.slice(0, limit)) {
    const slug = slugifyVenueName(v?.name);
    if (!slug) continue;
    const districtSlug = getVenueDistrictSlug(v);
    const district = districtSlug ? getDistrictDisplayName(districtSlug, 'en') : '';
    const region = districtSlug
      ? getRegionDisplayName(getDistrictBySlug(districtSlug)?.region || 'hk-island', 'en')
      : '';
    items.push(
      `<li><a href="${escapeHtml(`${base}/venues/${slug}`)}">${escapeHtml(v.name || slug)}</a>`
        + (district ? ` — ${escapeHtml(district)}${region ? `, ${escapeHtml(region)}` : ''}` : '')
        + '</li>',
    );
  }
  return [
    '<article data-seo-static="1" lang="en">',
    `<h1>${escapeHtml(title || 'Sports courts in Hong Kong')}</h1>`,
    `<p>${escapeHtml(intro || '')}</p>`,
    items.length ? `<nav aria-label="Venues"><ul>${items.join('')}</ul></nav>` : '',
    '</article>',
  ].join('\n');
}

export function buildHomeStaticBodyHtml({ intro, sportLinksHtml = '', districtLinksHtml = '' } = {}) {
  return [
    '<article data-seo-static="1" lang="en">',
    '<h1>Courts by The Ground — Hong Kong sports venue directory</h1>',
    `<p>${escapeHtml(intro || '')}</p>`,
    sportLinksHtml ? `<nav aria-label="Sports"><ul>${sportLinksHtml}</ul></nav>` : '',
    districtLinksHtml ? `<nav aria-label="Districts"><ul>${districtLinksHtml}</ul></nav>` : '',
    '<p>Part of <a href="https://theground.io">The Ground</a> (theground.io). For free public leisure facilities, see the LCSD facilities directory.</p>',
    '</article>',
  ].join('\n');
}
