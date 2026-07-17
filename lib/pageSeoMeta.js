/**
 * Shared page-level SEO builders for home / explore / search (SSG + Vite middleware).
 */
import { buildVenueOgMeta, slugifyVenueName, SITE_NAME, BRAND } from './venueOgMeta.js';
import { buildHomeStaticBodyHtml, buildListingStaticBodyHtml } from './venueSeoContent.js';
import {
  getDistrictDisplayName,
  HK_DISTRICTS,
  isValidDistrictSlug,
  venueMatchesDistricts,
} from './hkDistricts.js';

const HK_DISTRICT_COUNT = 18;
const DEFAULT_OG_IMAGE_PATH = '/gray-G.png';
const DEFAULT_KEYWORDS =
  'pickleball courts hong kong, pickleball court hk, sports courts Hong Kong, court booking, Hong Kong 18 districts courts, 香港18區球場, 香港球場, 球場預訂, pickleball Hong Kong, 匹克球, 匹克球香港';
const PARENT_SITE = 'https://theground.io';
const PARENT_SITE_WWW = 'https://www.theground.io';

export const HOME_TITLE_EN = `${BRAND} | Find Sports Courts Across All ${HK_DISTRICT_COUNT} Hong Kong Districts`;
export const HOME_TITLE_ZH = `運動場地搜尋 全港${HK_DISTRICT_COUNT}區 80+場館 | ${BRAND}`;

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sportLabel(sport, lang = 'en') {
  if (lang === 'zh' && sport?.name_zh) return sport.name_zh;
  return sport?.name || sport?.slug || 'Court';
}

function venueMatchesSportSlug(venue, sportSlug) {
  const slug = (sportSlug || '').toLowerCase().trim();
  if (!slug) return false;
  const types = venue.sport_types;
  const data = venue.sport_data;
  const name = (venue?.name ?? '').toString().toLowerCase();
  const desc = (venue?.description ?? '').toString().toLowerCase();
  const hasSportBySlug =
    Array.isArray(data) && data.some((d) => String(d.slug || '').toLowerCase().trim() === slug);
  const hasSportByName =
    Array.isArray(types) && types.some((t) => String(t).toLowerCase().trim() === slug);
  return hasSportBySlug || hasSportByName || name.includes(slug) || desc.includes(slug);
}

function countVenuesBySport(venues, sports) {
  return (sports || [])
    .map((sport) => ({
      slug: sport.slug,
      name: sport.name,
      name_zh: sport.name_zh,
      count: (venues || []).filter((v) => venueMatchesSportSlug(v, sport.slug)).length,
    }))
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count);
}

function humanizeSportSlug(slug) {
  return String(slug || '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function defaultImage(origin) {
  return `${(origin || '').replace(/\/$/, '')}${DEFAULT_OG_IMAGE_PATH}`;
}

function jsonLdString(obj) {
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}

function venueListItems(venues, origin, limit = 80) {
  return (venues || []).slice(0, limit).map((venue, index) => {
    const slug = slugifyVenueName(venue.name);
    return {
      '@type': 'ListItem',
      position: index + 1,
      name: venue.name,
      url: `${origin}/venues/${slug}`,
    };
  });
}

function venueLinkItems(venues, origin, limit = 80) {
  return (venues || [])
    .slice(0, limit)
    .map((v) => {
      const slug = slugifyVenueName(v.name);
      const href = `${origin}/venues/${slug}`;
      return `<li><a href="${escapeHtml(href)}">${escapeHtml(v.name)}</a></li>`;
    })
    .join('');
}

function buildNoscriptVenueLinks(venues, origin, limit = 80) {
  const items = venueLinkItems(venues, origin, limit);
  if (!items) return '';
  return `<noscript data-seo-crawl-links="1"><nav aria-label="Venues"><ul>${items}</ul></nav></noscript>`;
}

function buildOrganizationLd(base) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${base}/#organization`,
    name: BRAND,
    url: `${base}/`,
    logo: `${base}${DEFAULT_OG_IMAGE_PATH}`,
    sameAs: [PARENT_SITE, PARENT_SITE_WWW],
  };
}

function buildBreadcrumbLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/**
 * @param {{ venues: object[], sports: object[], origin: string, lang?: 'en'|'zh' }} opts
 */
export function buildHomePageMeta(opts) {
  const { venues = [], sports = [], origin, lang = 'en' } = opts;
  const base = origin.replace(/\/$/, '');
  const homeUrl = `${base}/`;
  const total = venues.length;
  const sportCounts = countVenuesBySport(venues, sports);
  const sportSummary = sportCounts
    .slice(0, 5)
    .map((s) =>
      lang === 'zh'
        ? `${sportLabel(s, lang)} ${s.count}個`
        : `${sportLabel(s, lang)} (${s.count})`
    )
    .join(lang === 'zh' ? '、' : ', ');

  const title = lang === 'zh' ? HOME_TITLE_ZH : HOME_TITLE_EN;
  const aboutMeta =
    lang === 'zh'
      ? 'Courts by The Ground 是香港運動場地目錄，資料來自營運商提交及編輯覆核。可按地區、運動類型及港鐵站搜尋場地，再聯絡場館預訂。'
      : 'Courts by The Ground is a Hong Kong sports-venue directory curated from operator-submitted and editor-reviewed details. Find courts by district, sport, and MTR — then contact venues to book.';
  const descriptionRaw =
    lang === 'zh'
      ? `搜尋香港全部${HK_DISTRICT_COUNT}區運動場地，共${total}個場館${sportSummary ? `。${sportSummary}` : ''}。可搜尋所有地區或按區篩選，比較收費，快速預訂。${aboutMeta}`
      : `Search sports courts across all ${HK_DISTRICT_COUNT} Hong Kong districts. ${total}+ venues${sportSummary ? `: ${sportSummary}` : ''}. Filter by district and sport, compare prices, and book in minutes. ${aboutMeta}`;
  const description =
    descriptionRaw.length > 320
      ? `${descriptionRaw.slice(0, 319).replace(/\s+\S*$/, '').trimEnd()}…`
      : descriptionRaw;

  const orgLd = buildOrganizationLd(base);
  const websiteLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: homeUrl,
    description,
    publisher: { '@id': `${base}/#organization` },
    potentialAction: {
      '@type': 'SearchAction',
      target: `${base}/explore`,
      'query-input': 'required name=search_term_string',
    },
  };

  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: lang === 'zh' ? '香港運動場地（按運動類型）' : 'Hong Kong sports venues by type',
    numberOfItems: sportCounts.length,
    itemListElement: sportCounts.map((s, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: sportLabel(s, lang),
      url: `${base}/search/${s.slug}`,
    })),
  };

  const sportLinks = sportCounts
    .map((s) => `<li><a href="${escapeHtml(`${base}/search/${s.slug}`)}">${escapeHtml(sportLabel(s, lang))}</a></li>`)
    .join('');
  const districtLinks = [];
  for (const sport of sportCounts.slice(0, 4)) {
    for (const district of HK_DISTRICTS) {
      const count = venues.filter(
        (v) => venueMatchesSportSlug(v, sport.slug) && venueMatchesDistricts(v, [district.slug])
      ).length;
      if (count === 0) continue;
      const label = `${sportLabel(sport, lang)} — ${lang === 'zh' ? district.zh : district.en}`;
      districtLinks.push(
        `<li><a href="${escapeHtml(`${base}/search/${sport.slug}/${district.slug}`)}">${escapeHtml(label)} (${count})</a></li>`
      );
      if (districtLinks.length >= 24) break;
    }
    if (districtLinks.length >= 24) break;
  }
  const venueLinks = venueLinkItems(venues, base);

  const homeIntro =
    lang === 'zh'
      ? `Courts by The Ground 收錄全港${HK_DISTRICT_COUNT}區共${total}個運動場地。可按運動類型及地區搜尋、比較收費與港鐵步行時間。`
      : `Courts by The Ground lists ${total} sports venues across Hong Kong’s ${HK_DISTRICT_COUNT} districts. Browse by sport and district, compare starting prices, and contact venues to book.`;

  return {
    title,
    description,
    keywords: DEFAULT_KEYWORDS,
    canonicalUrl: homeUrl,
    imageUrl: defaultImage(base),
    jsonLdStrings: [jsonLdString(orgLd), jsonLdString(websiteLd), jsonLdString(itemListLd)],
    jsonLdMarker: 'data-seo-landing="1"',
    noscriptHtml: `<noscript data-seo-crawl-links="1"><nav aria-label="Sports and venues"><ul>${sportLinks}${districtLinks.join('')}${venueLinks}</ul></nav></noscript>`,
    staticBodyHtml: buildHomeStaticBodyHtml({
      intro: homeIntro,
      sportLinksHtml: sportLinks,
      districtLinksHtml: districtLinks.join(''),
    }),
  };
}

/**
 * @param {{ venues: object[], origin: string, lang?: 'en'|'zh' }} opts
 */
export function buildExplorePageMeta(opts) {
  const { venues = [], origin, lang = 'en' } = opts;
  const base = origin.replace(/\/$/, '');
  const pageUrl = `${base}/explore`;
  const total = venues.length;
  const title =
    lang === 'zh'
      ? `探索全港${HK_DISTRICT_COUNT}區運動場地 | ${BRAND}`
      : `Explore Sports Courts Across Hong Kong | ${BRAND}`;
  const description =
    lang === 'zh'
      ? `在地圖或列表中瀏覽香港${total}+個運動場館，按地區、運動類型及港鐵站篩選。`
      : `Browse ${total}+ Hong Kong sports venues on map or list. Filter by district, sport, and MTR station.`;

  const collectionLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title,
    url: pageUrl,
    description,
    isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: `${base}/` },
  };

  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: lang === 'zh' ? '香港運動場地列表' : 'Hong Kong sports venues',
    numberOfItems: total,
    itemListElement: venueListItems(venues, base),
  };

  const breadcrumbLd = buildBreadcrumbLd([
    { name: 'Home', url: `${base}/` },
    { name: lang === 'zh' ? '探索' : 'Explore', url: pageUrl },
  ]);

  return {
    title,
    description,
    keywords: DEFAULT_KEYWORDS,
    canonicalUrl: pageUrl,
    imageUrl: defaultImage(base),
    jsonLdStrings: [jsonLdString(collectionLd), jsonLdString(itemListLd), jsonLdString(breadcrumbLd)],
    jsonLdMarker: 'data-seo-listing="1"',
    noscriptHtml: buildNoscriptVenueLinks(venues, base),
    staticBodyHtml: buildListingStaticBodyHtml({
      title,
      intro: description,
      venues,
      baseUrl: base,
    }),
  };
}

/**
 * @param {{ sportSlug: string, venues: object[], sports?: object[], origin: string, lang?: 'en'|'zh' }} opts
 */
export function buildSearchPageMeta(opts) {
  const { sportSlug, venues = [], sports = [], origin, lang = 'en' } = opts;
  const base = origin.replace(/\/$/, '');
  const pageUrl = `${base}/search/${sportSlug}`;
  const sportMeta = (sports || []).find((s) => s.slug === sportSlug);
  const sportName = sportMeta ? sportLabel(sportMeta, lang) : humanizeSportSlug(sportSlug);
  const filtered = venues.filter((v) => venueMatchesSportSlug(v, sportSlug));
  const total = filtered.length;

  const title =
    lang === 'zh'
      ? `${sportName}場地 香港 | ${BRAND}`
      : `${sportName} Courts Hong Kong | ${BRAND}`;
  const description =
    lang === 'zh'
      ? `搜尋香港${sportName}場地，共${total}個場館。比較收費、設施及港鐵步行距離，快速預訂。`
      : `Find ${sportName.toLowerCase()} courts in Hong Kong (${total} venues). Compare prices, amenities, and MTR walking distance.`;

  const collectionLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title,
    url: pageUrl,
    description,
    isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: `${base}/` },
  };

  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: lang === 'zh' ? `香港${sportName}場地` : `${sportName} courts in Hong Kong`,
    numberOfItems: total,
    itemListElement: venueListItems(filtered, base),
  };

  const breadcrumbLd = buildBreadcrumbLd([
    { name: 'Home', url: `${base}/` },
    { name: sportName, url: pageUrl },
  ]);

  return {
    title,
    description,
    keywords: `${sportName} courts hong kong, ${sportSlug}, ${DEFAULT_KEYWORDS}`,
    canonicalUrl: pageUrl,
    imageUrl: defaultImage(base),
    jsonLdStrings: [jsonLdString(collectionLd), jsonLdString(itemListLd), jsonLdString(breadcrumbLd)],
    jsonLdMarker: 'data-seo-listing="1"',
    noscriptHtml: buildNoscriptVenueLinks(filtered, base),
    staticBodyHtml: buildListingStaticBodyHtml({
      title,
      intro: description,
      venues: filtered,
      baseUrl: base,
    }),
  };
}

/**
 * @param {{ sportSlug: string, districtSlug: string, venues: object[], sports?: object[], origin: string, lang?: 'en'|'zh' }} opts
 */
export function buildDistrictSportPageMeta(opts) {
  const { sportSlug, districtSlug, venues = [], sports = [], origin, lang = 'en' } = opts;
  const base = origin.replace(/\/$/, '');
  const pageUrl = `${base}/search/${sportSlug}/${districtSlug}`;
  const sportUrl = `${base}/search/${sportSlug}`;
  const sportMeta = (sports || []).find((s) => s.slug === sportSlug);
  const sportName = sportMeta ? sportLabel(sportMeta, lang) : humanizeSportSlug(sportSlug);
  const districtName = isValidDistrictSlug(districtSlug)
    ? getDistrictDisplayName(districtSlug, lang)
    : humanizeSportSlug(districtSlug);
  const filtered = venues.filter(
    (v) => venueMatchesSportSlug(v, sportSlug) && venueMatchesDistricts(v, [districtSlug])
  );
  const total = filtered.length;

  const title =
    lang === 'zh'
      ? `${districtName}${sportName}場地 | ${BRAND}`
      : `${sportName} Courts in ${districtName} | ${BRAND}`;
  const description =
    lang === 'zh'
      ? `搜尋${districtName}${sportName}場地，共${total}個場館。比較收費、設施及港鐵步行距離，快速預訂。`
      : `Find ${sportName.toLowerCase()} courts in ${districtName}, Hong Kong (${total} venues). Compare prices, amenities, and MTR walking distance.`;

  const collectionLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title,
    url: pageUrl,
    description,
    isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: `${base}/` },
  };

  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: lang === 'zh' ? `${districtName}${sportName}場地` : `${sportName} courts in ${districtName}`,
    numberOfItems: total,
    itemListElement: venueListItems(filtered, base),
  };

  const breadcrumbLd = buildBreadcrumbLd([
    { name: 'Home', url: `${base}/` },
    { name: sportName, url: sportUrl },
    { name: districtName, url: pageUrl },
  ]);

  return {
    title,
    description,
    keywords: `${sportName} courts ${districtName}, ${districtSlug}, ${sportSlug}, ${DEFAULT_KEYWORDS}`,
    canonicalUrl: pageUrl,
    imageUrl: defaultImage(base),
    jsonLdStrings: [jsonLdString(collectionLd), jsonLdString(itemListLd), jsonLdString(breadcrumbLd)],
    jsonLdMarker: 'data-seo-listing="1"',
    noscriptHtml: buildNoscriptVenueLinks(filtered, base),
    staticBodyHtml: buildListingStaticBodyHtml({
      title,
      intro: description,
      venues: filtered,
      baseUrl: base,
    }),
  };
}

export { buildVenueOgMeta, slugifyVenueName, HK_DISTRICTS };
