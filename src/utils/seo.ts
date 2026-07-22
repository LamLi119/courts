import type { OperatingDayKey, OperatingHours, Venue, BlogPost } from '../../types';
import {
  getDistrictBySlug,
  getDistrictDisplayName,
  getRegionDisplayName,
  getVenueDistrictSlug,
  isValidDistrictSlug,
  venueMatchesDistricts,
} from './hkDistricts';
import { flattenVenueSeoForMeta } from './venueContent';
import { slugify } from './slugify';

const BRAND = 'Courts';
const SITE_NAME = BRAND;
const HK_DISTRICT_COUNT = 18;
const PARENT_SITE = 'https://theground.io';
const PARENT_SITE_WWW = 'https://www.theground.io';
const OPERATING_DAY_SCHEMA: Record<OperatingDayKey, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};
const DEFAULT_KEYWORDS =
  'pickleball courts hong kong, pickleball court hk, sports courts Hong Kong, court booking, Hong Kong 18 districts courts, 香港18區球場, 香港球場, 球場預訂, pickleball Hong Kong, 匹克球, 匹克球香港, pickleball 香港, pickleball 場地, 匹克球場地, 匹克球 租場, 匹克球場收費, Sha Tin courts, Kwun Tong pickleball, 沙田球場, 觀塘匹克球';

export type SportVenueCount = {
  slug: string;
  name: string;
  name_zh?: string | null;
  count: number;
};

type SportOption = { name: string; name_zh?: string | null; slug: string };

export const HOME_TITLE_EN = `${BRAND} | Find Sports Courts Across All ${HK_DISTRICT_COUNT} Hong Kong Districts`;
export const HOME_TITLE_ZH = `運動場地搜尋 全港${HK_DISTRICT_COUNT}區 80+場館 | ${BRAND}`;
const DEFAULT_TITLE = HOME_TITLE_EN;
const DEFAULT_DESCRIPTION =
  `Search sports courts across all ${HK_DISTRICT_COUNT} Hong Kong districts. Filter by district and sport, compare prices and amenities, and book in minutes. 搜尋香港18區運動場地。`;
/** Default share preview image (home page). Use absolute URL so crawlers see it when sharing site URL. */
const DEFAULT_OG_IMAGE_PATH = '/gray-G.png';

/** Whether a venue supports the given sport slug (matches explore filter logic). */
export function venueMatchesSportSlug(venue: Venue, sportSlug: string): boolean {
  const slug = (sportSlug || '').toLowerCase().trim();
  if (!slug) return false;
  const types = venue.sport_types;
  const data = venue.sport_data;
  const name = ((venue as { name?: string }).name ?? '').toString().toLowerCase();
  const desc = ((venue as { description?: string }).description ?? '').toString().toLowerCase();
  const hasSportBySlug = Array.isArray(data)
    && data.some((d) => String(d.slug || '').toLowerCase().trim() === slug);
  const hasSportByName = Array.isArray(types)
    && types.some((t) => String(t).toLowerCase().trim() === slug);
  return hasSportBySlug || hasSportByName || name.includes(slug) || desc.includes(slug);
}

export function countVenuesBySport(venues: Venue[], sports: SportOption[]): SportVenueCount[] {
  return sports
    .map((sport) => ({
      slug: sport.slug,
      name: sport.name,
      name_zh: sport.name_zh,
      count: venues.filter((v) => venueMatchesSportSlug(v, sport.slug)).length,
    }))
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count);
}

function sportLabel(item: SportVenueCount, lang: 'en' | 'zh'): string {
  return lang === 'zh' && item.name_zh ? item.name_zh : item.name;
}

function buildLandingSportSummary(sportCounts: SportVenueCount[], lang: 'en' | 'zh', limit = 5): string {
  return sportCounts
    .slice(0, limit)
    .map((s) => (lang === 'zh'
      ? `${sportLabel(s, lang)} ${s.count}個`
      : `${sportLabel(s, lang)} (${s.count})`))
    .join(lang === 'zh' ? '、' : ', ');
}

function buildLandingKeywords(sportCounts: SportVenueCount[]): string {
  const sportTerms = sportCounts.flatMap((s) => [
    `${s.name} courts hong kong`,
    `${s.name} court hk`,
    s.name_zh ? `${s.name_zh}香港` : '',
    `${s.name} ${HK_DISTRICT_COUNT} districts`,
  ]);
  return uniqueCsv([...sportTerms, DEFAULT_KEYWORDS]);
}

function cleanText(s: unknown): string {
  return typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '';
}

function toKeywordFragment(s: string): string {
  return cleanText(s).replace(/[|]/g, '').trim();
}

function uniqueCsv(items: string[]): string {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of items) {
    const v = toKeywordFragment(raw);
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out.join(', ');
}

function numOrNull(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Sport type label for meta/alt: join sport_types or use sport_data with language. */
export function getSportTypeLabel(venue: Venue, lang: 'en' | 'zh' = 'en'): string {
  const data = venue.sport_data;
  if (Array.isArray(data) && data.length > 0) {
    const labels = data.map((d) => (lang === 'zh' && d.name_zh ? d.name_zh : (d.name || '').trim())).filter(Boolean);
    return labels.join(', ') || 'Court';
  }
  const types = venue.sport_types;
  if (Array.isArray(types) && types.length > 0) {
    return types.map((t) => (typeof t === 'string' ? t.trim() : '')).filter(Boolean).join(', ') || 'Court';
  }
  return 'Court';
}

/** SEO title: {Venue Name} | {Sport Type} Court in {MTR} | Courts */
export function getVenueTitle(venue: Venue, lang: 'en' | 'zh' = 'en'): string {
  const sport = getSportTypeLabel(venue, lang);
  const mtr = cleanText(venue.mtrStation);
  const where = mtr ? ` in ${mtr}` : '';
  return `${venue.name} | ${sport} Court${where} | ${BRAND}`;
}

function buildOrganizationLd(homeUrl: string): Record<string, unknown> {
  const base = homeUrl.replace(/\/$/, '') || homeUrl;
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: BRAND,
    url: base.endsWith('/') ? base : `${base}/`,
    logo: `${base.replace(/\/$/, '')}/gray-G.png`,
    sameAs: [PARENT_SITE, PARENT_SITE_WWW],
  };
}

function operatingHoursToSchema(venue: Venue): Record<string, unknown>[] | undefined {
  if (!venue.operating_hours_enabled || !venue.operating_hours) return undefined;
  const oh = venue.operating_hours as OperatingHours;
  if (!oh?.weekly) return undefined;
  const specs: Record<string, unknown>[] = [];
  (Object.keys(OPERATING_DAY_SCHEMA) as OperatingDayKey[]).forEach((day) => {
    const entry = oh.weekly[day];
    if (!entry || entry.closed) return;
    const slots = Array.isArray(entry.slots) ? entry.slots : [];
    for (const slot of slots) {
      const opens = cleanText(slot?.[0]);
      const closes = cleanText(slot?.[1]);
      if (!opens || !closes) continue;
      specs.push({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: OPERATING_DAY_SCHEMA[day],
        opens,
        closes,
      });
    }
  });
  return specs.length ? specs : undefined;
}

function buildVenuePostalAddress(venue: Venue): Record<string, unknown> {
  const districtSlug = getVenueDistrictSlug(venue);
  const district = districtSlug ? getDistrictBySlug(districtSlug) : undefined;
  const address: Record<string, unknown> = {
    '@type': 'PostalAddress',
    streetAddress: cleanText(venue.address) || undefined,
    addressCountry: 'HK',
  };
  if (district) {
    address.addressLocality = district.en;
    address.addressRegion = getRegionDisplayName(district.region, 'en');
  } else if (cleanText(venue.mtrStation)) {
    address.addressLocality = cleanText(venue.mtrStation);
    address.addressRegion = 'Hong Kong Island';
  }
  return address;
}

function buildVenueBreadcrumbLd(
  venue: Venue,
  pageUrl: string,
  origin: string,
): Record<string, unknown> {
  const base = origin.replace(/\/$/, '');
  const sportSlug = Array.isArray(venue.sport_data) && venue.sport_data[0]?.slug
    ? String(venue.sport_data[0].slug)
    : Array.isArray(venue.sport_types) && venue.sport_types[0]
      ? slugify(String(venue.sport_types[0]))
      : '';
  const sportLabel = getSportTypeLabel(venue, 'en');
  const items: Record<string, unknown>[] = [
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${base}/` },
  ];
  if (sportSlug) {
    items.push({
      '@type': 'ListItem',
      position: 2,
      name: sportLabel,
      item: `${base}/search/${sportSlug}`,
    });
    items.push({
      '@type': 'ListItem',
      position: 3,
      name: venue.name,
      item: pageUrl,
    });
  } else {
    items.push({
      '@type': 'ListItem',
      position: 2,
      name: 'Explore',
      item: `${base}/explore`,
    });
    items.push({
      '@type': 'ListItem',
      position: 3,
      name: venue.name,
      item: pageUrl,
    });
  }
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items,
  };
}

/** Meta description: venue SEO prose (hidden on-page) with short booking fallback. */
export function getVenueDescription(venue: Venue, lang: 'en' | 'zh' = 'en'): string {
  const rich = flattenVenueSeoForMeta(venue, lang, 320);
  if (rich) return rich;

  const sport = getSportTypeLabel(venue, lang);
  const mtr = cleanText(venue.mtrStation);
  const exit = cleanText(venue.mtrExit);
  const addr = cleanText(venue.address);
  const walkingDistance = numOrNull((venue as any).walkingDistance);
  const wd = walkingDistance != null && walkingDistance > 0 ? `${walkingDistance} min walk` : '';
  const mtrPart = mtr ? `near ${mtr}${exit ? ` (${exit})` : ''}` : '';
  const where = mtrPart ? ` in ${mtrPart}` : '';
  const courtCount = numOrNull((venue as any).court_count);
  const courts = courtCount != null && courtCount > 0 ? `${courtCount} courts` : '';
  const ceilingHeight = numOrNull((venue as any).ceilingHeight);
  const height = ceilingHeight != null && ceilingHeight > 0 ? `${ceilingHeight}m ceiling.` : '';
  const startingPrice = numOrNull((venue as any).startingPrice);
  const price = startingPrice != null && startingPrice > 0 ? `Starting from $${startingPrice}/hr` : '';
  const contact = cleanText(venue.whatsapp) ? 'WhatsApp to book' : '';

  const parts = [
    `Book ${venue.name}${where}.`,
    `${sport} venue${mtrPart ? ` ${mtrPart}` : ''}${wd ? ` — ${wd}.` : '.'}`,
    [courts, height].filter(Boolean).join(' · '),
    [price, contact].filter(Boolean).join(' · '),
    addr ? `Address: ${addr}.` : '',
  ].filter(Boolean);

  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

export function getVenueKeywords(venue: Venue, lang: 'en' | 'zh' = 'en'): string {
  const sport = getSportTypeLabel(venue, lang);
  const mtr = cleanText(venue.mtrStation);
  const priceMessage = '收費';
  const base = [
    `${sport} court`,
    `${sport} courts hong kong`,
    `${sport} court hk`,
    mtr ? `${sport} courts near ${mtr}` : '',
    mtr ? `${mtr} ${sport} court` : '',
    venue.name,
    DEFAULT_KEYWORDS,
    `${venue.name}${priceMessage}`
  ];
  return uniqueCsv(base);
}

/** Image alt: {Venue Name} {Sport Type} area */
export function getVenueImageAlt(venue: Venue, lang: 'en' | 'zh' = 'en'): string {
  const sport = getSportTypeLabel(venue, lang);
  return `${venue.name} ${sport} area`;
}

function setMeta(name: string, content: string, isProperty = false): void {
  const attr = isProperty ? 'property' : 'name';
  let el = document.querySelector(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setOgTag(property: string, content: string): void {
  setMeta(property, content, true);
}

function setCanonical(url: string): void {
  let link = document.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', url);
}

function getReadableCurrentUrl(): string {
  if (typeof window === 'undefined') return '';
  try {
    const { origin, pathname, search, hash } = window.location;
    // Keep Unicode path readable in meta tags while preserving valid URL structure.
    const readablePath = decodeURI(pathname);
    return `${origin}${readablePath}${search}${hash}`;
  } catch {
    return window.location.href;
  }
}

/** Apply dynamic meta and OG tags for a venue (detail page). Call when venue is shown. */
export function applyVenueSeo(venue: Venue, baseUrl: string, lang: 'en' | 'zh' = 'en'): void {
  const title = getVenueTitle(venue, lang);
  const description = getVenueDescription(venue, lang);
  const keywords = getVenueKeywords(venue, lang);
  const image = (venue.images && venue.images[0]) || '';
  const pageUrl =
    typeof window !== 'undefined'
      ? getReadableCurrentUrl()
      : `${baseUrl.replace(/\/$/, '')}/venues/${slugify(venue.name)}`;
  const origin = typeof window !== 'undefined' ? window.location.origin : baseUrl.replace(/\/$/, '');

  document.title = title;
  setMeta('description', description);
  setMeta('keywords', keywords);
  setCanonical(pageUrl);

  setOgTag('og:title', title);
  setOgTag('og:description', description);
  setOgTag('og:type', 'website');
  setOgTag('og:url', pageUrl);
  setOgTag('og:site_name', SITE_NAME);

  setMeta('twitter:card', 'summary_large_image');
  setMeta('twitter:url', pageUrl);
  setMeta('twitter:title', title);
  setMeta('twitter:description', description);

  if (image) {
    const imageUrl = image.startsWith('http') ? image : new URL(image, origin).href;
    setOgTag('og:image', imageUrl);
    setOgTag('og:image:secure_url', imageUrl);
    setMeta('twitter:image', imageUrl);
  }

  injectVenueJsonLd(venue, baseUrl);
}

/** Dynamic landing page SEO with per-sport venue counts. */
export function applyLandingPageSeo(
  venues: Venue[],
  sports: SportOption[],
  lang: 'en' | 'zh' = 'en',
  baseUrl?: string,
): void {
  const total = venues.length;
  const sportCounts = countVenuesBySport(venues, sports);
  const sportSummary = buildLandingSportSummary(sportCounts, lang);
  const origin = typeof window !== 'undefined' ? window.location.origin : (baseUrl || '').replace(/\/$/, '');
  const homeUrl = origin ? `${origin}/` : (baseUrl || '');
  const defaultImageUrl = origin ? new URL(DEFAULT_OG_IMAGE_PATH, origin).href : '';

  const title = lang === 'zh' ? HOME_TITLE_ZH : HOME_TITLE_EN;

  const aboutMeta = lang === 'zh'
    ? 'Courts by The Ground 是香港運動場地目錄，資料來自營運商提交及編輯覆核。可按地區、運動類型及港鐵站搜尋場地，再聯絡場館預訂。'
    : 'Courts by The Ground is a Hong Kong sports-venue directory curated from operator-submitted and editor-reviewed details. Find courts by district, sport, and MTR — then contact venues to book.';

  const descriptionRaw = lang === 'zh'
    ? `搜尋香港全部${HK_DISTRICT_COUNT}區運動場地，共${total}個場館${sportSummary ? `。${sportSummary}` : ''}。可搜尋所有地區或按區篩選，比較收費，快速預訂。${aboutMeta}`
    : `Search sports courts across all ${HK_DISTRICT_COUNT} Hong Kong districts. ${total}+ venues${sportSummary ? `: ${sportSummary}` : ''}. Filter by district and sport, compare prices, and book in minutes. ${aboutMeta}`;
  const description = descriptionRaw.length > 320
    ? `${descriptionRaw.slice(0, 319).replace(/\s+\S*$/, '').trimEnd()}…`
    : descriptionRaw;

  const keywords = buildLandingKeywords(sportCounts);

  document.title = title;
  setMeta('description', description);
  setMeta('keywords', keywords);
  if (homeUrl) setCanonical(homeUrl);

  setOgTag('og:title', title);
  setOgTag('og:description', description);
  setOgTag('og:type', 'website');
  if (homeUrl) setOgTag('og:url', homeUrl);
  setOgTag('og:site_name', SITE_NAME);

  setMeta('twitter:card', 'summary_large_image');
  setMeta('twitter:title', title);
  setMeta('twitter:description', description);
  if (homeUrl) setMeta('twitter:url', homeUrl);
  if (defaultImageUrl) {
    setOgTag('og:image', defaultImageUrl);
    setOgTag('og:image:secure_url', defaultImageUrl);
    setMeta('twitter:image', defaultImageUrl);
  }

  injectLandingJsonLd({ total, sportCounts, homeUrl, lang });
}

/** Explore page SEO with CollectionPage + ItemList of venues. */
export function applyExplorePageSeo(
  venues: Venue[],
  lang: 'en' | 'zh' = 'en',
  baseUrl?: string,
): void {
  const origin = typeof window !== 'undefined' ? window.location.origin : (baseUrl || '').replace(/\/$/, '');
  const pageUrl = origin ? `${origin}/explore` : `${baseUrl || ''}/explore`;
  const defaultImageUrl = origin ? new URL(DEFAULT_OG_IMAGE_PATH, origin).href : '';
  const total = venues.length;

  const title = lang === 'zh'
    ? `探索全港${HK_DISTRICT_COUNT}區運動場地 | ${BRAND}`
    : `Explore Sports Courts Across Hong Kong | ${BRAND}`;
  const description = lang === 'zh'
    ? `在地圖或列表中瀏覽香港${total}+個運動場館，按地區、運動類型及港鐵站篩選。`
    : `Browse ${total}+ Hong Kong sports venues on map or list. Filter by district, sport, and MTR station.`;

  document.title = title;
  setMeta('description', description);
  setMeta('keywords', DEFAULT_KEYWORDS);
  if (pageUrl) setCanonical(pageUrl);

  setOgTag('og:title', title);
  setOgTag('og:description', description);
  setOgTag('og:type', 'website');
  if (pageUrl) setOgTag('og:url', pageUrl);
  setOgTag('og:site_name', SITE_NAME);

  setMeta('twitter:card', 'summary_large_image');
  setMeta('twitter:title', title);
  setMeta('twitter:description', description);
  if (pageUrl) setMeta('twitter:url', pageUrl);
  if (defaultImageUrl) {
    setOgTag('og:image', defaultImageUrl);
    setMeta('twitter:image', defaultImageUrl);
  }

  injectListingJsonLd({
    pageUrl,
    title,
    description,
    listName: lang === 'zh' ? '香港運動場地列表' : 'Hong Kong sports venues',
    venues,
    origin: origin || (baseUrl || '').replace(/\/$/, ''),
    marker: 'data-seo-listing',
    breadcrumbItems: [
      { name: 'Home', url: `${(origin || '').replace(/\/$/, '')}/` },
      { name: lang === 'zh' ? '探索' : 'Explore', url: pageUrl },
    ],
  });
}

/** Reset to default meta when leaving venue detail. */
export function resetSeoToDefault(baseUrl?: string): void {
  const origin = typeof window !== 'undefined' ? window.location.origin : (baseUrl || '').replace(/\/$/, '');
  const homeUrl = origin ? origin + '/' : (baseUrl || '');
  const defaultImageUrl = origin ? new URL(DEFAULT_OG_IMAGE_PATH, origin).href : '';

  document.title = DEFAULT_TITLE;
  setMeta('description', DEFAULT_DESCRIPTION);
  setMeta('keywords', DEFAULT_KEYWORDS);
  if (homeUrl) setCanonical(homeUrl);

  setOgTag('og:title', DEFAULT_TITLE);
  setOgTag('og:description', DEFAULT_DESCRIPTION);
  setOgTag('og:type', 'website');
  if (homeUrl) setOgTag('og:url', homeUrl);
  if (defaultImageUrl) {
    setOgTag('og:image', defaultImageUrl);
    setOgTag('og:image:secure_url', defaultImageUrl);
  }

  setMeta('twitter:card', 'summary_large_image');
  setMeta('twitter:title', DEFAULT_TITLE);
  setMeta('twitter:description', DEFAULT_DESCRIPTION);
  if (homeUrl) setMeta('twitter:url', homeUrl);
  if (defaultImageUrl) setMeta('twitter:image', defaultImageUrl);

  removeJsonLd();
}

/** Category page SEO: /search/:sport */
export function applySearchPageSeo(
  sportSlug: string,
  venues: Venue[] = [],
  sports: SportOption[] = [],
  lang: 'en' | 'zh' = 'en',
  baseUrl?: string,
): void {
  const origin = typeof window !== 'undefined' ? window.location.origin : (baseUrl || '').replace(/\/$/, '');
  const sportMeta = sports.find((s) => s.slug === sportSlug);
  const sport = sportMeta
    ? sportLabel({ slug: sportMeta.slug, name: sportMeta.name, name_zh: sportMeta.name_zh, count: 0 }, lang)
    : sportSlug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const filtered = venues.filter((v) => venueMatchesSportSlug(v, sportSlug));
  const total = filtered.length;
  const title = lang === 'zh'
    ? `${sport}場地 香港 | ${BRAND}`
    : `${sport} Courts Hong Kong | ${BRAND}`;
  const description = lang === 'zh'
    ? `搜尋香港${sport}場地，共${total}個場館。比較收費、設施及港鐵步行距離，快速預訂。`
    : `Find ${sport.toLowerCase()} courts in Hong Kong (${total} venues). Compare prices, amenities, and MTR walking distance.`;
  const keywords = uniqueCsv([`${sport} courts hong kong`, `${sport} court hk`, `${sport} courts near mtr`, DEFAULT_KEYWORDS]);
  const searchUrl = origin
    ? `${origin}/search/${sportSlug}`
    : typeof window !== 'undefined'
      ? window.location.href
      : `${baseUrl || ''}/search/${sportSlug}`;
  const defaultImageUrl = origin ? new URL(DEFAULT_OG_IMAGE_PATH, origin).href : '';

  document.title = title;
  setMeta('description', description);
  setMeta('keywords', keywords);
  if (searchUrl) setCanonical(searchUrl);

  setOgTag('og:title', title);
  setOgTag('og:description', description);
  setOgTag('og:type', 'website');
  if (searchUrl) setOgTag('og:url', searchUrl);
  setOgTag('og:site_name', SITE_NAME);

  setMeta('twitter:title', title);
  setMeta('twitter:description', description);
  if (searchUrl) setMeta('twitter:url', searchUrl);
  if (defaultImageUrl) {
    setOgTag('og:image', defaultImageUrl);
    setMeta('twitter:image', defaultImageUrl);
  }

  injectListingJsonLd({
    pageUrl: searchUrl,
    title,
    description,
    listName: lang === 'zh' ? `香港${sport}場地` : `${sport} courts in Hong Kong`,
    venues: filtered,
    origin: origin || (baseUrl || '').replace(/\/$/, ''),
    marker: 'data-seo-listing',
    breadcrumbItems: [
      { name: 'Home', url: `${(origin || '').replace(/\/$/, '')}/` },
      { name: sport, url: searchUrl },
    ],
  });
}

/** District × sport landing SEO: /search/:sport/:district */
export function applyDistrictSportPageSeo(
  sportSlug: string,
  districtSlug: string,
  venues: Venue[] = [],
  sports: SportOption[] = [],
  lang: 'en' | 'zh' = 'en',
  baseUrl?: string,
): void {
  const origin = typeof window !== 'undefined' ? window.location.origin : (baseUrl || '').replace(/\/$/, '');
  const base = origin || (baseUrl || '').replace(/\/$/, '');
  const sportMeta = sports.find((s) => s.slug === sportSlug);
  const sport = sportMeta
    ? sportLabel({ slug: sportMeta.slug, name: sportMeta.name, name_zh: sportMeta.name_zh, count: 0 }, lang)
    : sportSlug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const districtName = isValidDistrictSlug(districtSlug)
    ? getDistrictDisplayName(districtSlug, lang)
    : districtSlug.replace(/-/g, ' ');
  const filtered = venues.filter(
    (v) => venueMatchesSportSlug(v, sportSlug) && venueMatchesDistricts(v, [districtSlug]),
  );
  const total = filtered.length;
  const title = lang === 'zh'
    ? `${districtName}${sport}場地 | ${BRAND}`
    : `${sport} Courts in ${districtName} | ${BRAND}`;
  const description = lang === 'zh'
    ? `搜尋${districtName}${sport}場地，共${total}個場館。比較收費、設施及港鐵步行距離，快速預訂。`
    : `Find ${sport.toLowerCase()} courts in ${districtName}, Hong Kong (${total} venues). Compare prices, amenities, and MTR walking distance.`;
  const keywords = uniqueCsv([
    `${sport} courts ${districtName}`,
    `${districtName} ${sport}`,
    `${sport} courts hong kong`,
    DEFAULT_KEYWORDS,
  ]);
  const pageUrl = base ? `${base}/search/${sportSlug}/${districtSlug}` : '';
  const sportUrl = base ? `${base}/search/${sportSlug}` : '';
  const defaultImageUrl = origin ? new URL(DEFAULT_OG_IMAGE_PATH, origin).href : '';

  document.title = title;
  setMeta('description', description);
  setMeta('keywords', keywords);
  if (pageUrl) setCanonical(pageUrl);

  setOgTag('og:title', title);
  setOgTag('og:description', description);
  setOgTag('og:type', 'website');
  if (pageUrl) setOgTag('og:url', pageUrl);
  setOgTag('og:site_name', SITE_NAME);

  setMeta('twitter:title', title);
  setMeta('twitter:description', description);
  if (pageUrl) setMeta('twitter:url', pageUrl);
  if (defaultImageUrl) {
    setOgTag('og:image', defaultImageUrl);
    setMeta('twitter:image', defaultImageUrl);
  }

  injectListingJsonLd({
    pageUrl,
    title,
    description,
    listName: lang === 'zh' ? `${districtName}${sport}場地` : `${sport} courts in ${districtName}`,
    venues: filtered,
    origin: base,
    marker: 'data-seo-listing',
    breadcrumbItems: [
      { name: 'Home', url: `${base}/` },
      { name: sport, url: sportUrl },
      { name: districtName, url: pageUrl },
    ],
  });
}

/** Schema.org SportsActivityLocation JSON-LD */
function injectVenueJsonLd(venue: Venue, baseUrl: string): void {
  removeJsonLd();
  const sport = getSportTypeLabel(venue);
  const image = (venue.images && venue.images[0]);
  const imageUrl = image && image.startsWith('http') ? image : image ? new URL(image, baseUrl).href : undefined;
  const pageUrl =
    typeof window !== 'undefined'
      ? getReadableCurrentUrl()
      : `${baseUrl.replace(/\/$/, '')}/venues/${slugify(venue.name)}`;
  const origin = typeof window !== 'undefined' ? window.location.origin : baseUrl.replace(/\/$/, '');

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'SportsActivityLocation',
    name: venue.name,
    url: pageUrl,
    address: buildVenuePostalAddress(venue),
    image: imageUrl ? [imageUrl] : undefined,
    priceRange: venue.startingPrice
      ? `HK$${venue.startingPrice}`
      : undefined,
  };
  const hoursSpec = operatingHoursToSchema(venue);
  if (hoursSpec) {
    jsonLd.openingHoursSpecification = hoursSpec;
  }
  if (venue.whatsapp) {
    jsonLd.telephone = venue.whatsapp.replace(/[^0-9+]/g, '');
  }
  const richDescription = flattenVenueSeoForMeta(venue, 'en', 500);
  if (richDescription) {
    jsonLd.description = richDescription;
  } else {
    const extra: string[] = [];
    if (cleanText(venue.mtrStation)) extra.push(`MTR: ${cleanText(venue.mtrStation)}${cleanText(venue.mtrExit) ? ` (${cleanText(venue.mtrExit)})` : ''}`);
    if (typeof venue.walkingDistance === 'number' && venue.walkingDistance > 0) extra.push(`Walking distance: ${venue.walkingDistance} min`);
    if (typeof venue.ceilingHeight === 'number' && venue.ceilingHeight > 0) extra.push(`Ceiling height: ${venue.ceilingHeight} m`);
    if (venue.court_count != null && venue.court_count > 0) extra.push(`Court count: ${venue.court_count}`);
    if (extra.length) {
      jsonLd.description = `${sport} venue. ` + extra.join(' · ');
    }
  }
  if (venue.coordinates?.lat != null && venue.coordinates?.lng != null) {
    (jsonLd as Record<string, unknown>).geo = {
      '@type': 'GeoCoordinates',
      latitude: venue.coordinates.lat,
      longitude: venue.coordinates.lng,
    };
  }

  // AggregateRating only when real review data exists (Phase 4 — never fabricate).
  const ratingValue = numOrNull(venue.rating_value);
  const reviewCount = numOrNull(venue.review_count);
  if (
    ratingValue != null
    && reviewCount != null
    && ratingValue >= 1
    && ratingValue <= 5
    && reviewCount >= 1
  ) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue,
      reviewCount,
      bestRating: 5,
      worstRating: 1,
    };
  }

  const venueScript = document.createElement('script');
  venueScript.type = 'application/ld+json';
  venueScript.textContent = JSON.stringify(jsonLd);
  venueScript.setAttribute('data-seo-venue', '1');
  document.head.appendChild(venueScript);

  const crumbScript = document.createElement('script');
  crumbScript.type = 'application/ld+json';
  crumbScript.textContent = JSON.stringify(buildVenueBreadcrumbLd(venue, pageUrl, origin));
  crumbScript.setAttribute('data-seo-breadcrumb', '1');
  document.head.appendChild(crumbScript);
}

function injectLandingJsonLd({
  total,
  sportCounts,
  homeUrl,
  lang,
}: {
  total: number;
  sportCounts: SportVenueCount[];
  homeUrl: string;
  lang: 'en' | 'zh';
}): void {
  removeJsonLd();

  const orgLd = buildOrganizationLd(homeUrl);
  const websiteLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: homeUrl,
    description: lang === 'zh'
      ? `搜尋香港${HK_DISTRICT_COUNT}區運動場地，共${total}個場館。`
      : `Search ${total}+ sports venues across all ${HK_DISTRICT_COUNT} Hong Kong districts.`,
    publisher: { '@id': `${homeUrl.replace(/\/$/, '')}/#organization` },
    potentialAction: {
      '@type': 'SearchAction',
      target: `${homeUrl.replace(/\/$/, '')}/explore`,
      'query-input': 'required name=search_term_string',
    },
  };
  orgLd['@id'] = `${homeUrl.replace(/\/$/, '')}/#organization`;

  const itemListLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: lang === 'zh' ? '香港運動場地（按運動類型）' : 'Hong Kong sports venues by type',
    numberOfItems: sportCounts.length,
    itemListElement: sportCounts.map((s, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: sportLabel(s, lang),
      description: lang === 'zh'
        ? `${s.count}個場館，可於香港${HK_DISTRICT_COUNT}區搜尋`
        : `${s.count} venues searchable across ${HK_DISTRICT_COUNT} Hong Kong districts`,
      url: `${homeUrl.replace(/\/$/, '')}/search/${s.slug}`,
    })),
  };

  for (const payload of [orgLd, websiteLd, itemListLd]) {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(payload);
    script.setAttribute('data-seo-landing', '1');
    document.head.appendChild(script);
  }
}

function injectListingJsonLd({
  pageUrl,
  title,
  description,
  listName,
  venues,
  origin,
  marker,
  breadcrumbItems,
}: {
  pageUrl: string;
  title: string;
  description: string;
  listName: string;
  venues: Venue[];
  origin: string;
  marker: 'data-seo-listing';
  breadcrumbItems?: { name: string; url: string }[];
}): void {
  removeJsonLd();
  const base = origin.replace(/\/$/, '');
  const collectionLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title,
    url: pageUrl,
    description,
    isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: `${base}/` },
  };
  const itemListLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: listName,
    numberOfItems: venues.length,
    itemListElement: venues.slice(0, 80).map((venue, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: venue.name,
      url: `${base}/venues/${slugify(venue.name)}`,
    })),
  };

  const payloads: Record<string, unknown>[] = [collectionLd, itemListLd];
  if (breadcrumbItems && breadcrumbItems.length > 0) {
    payloads.push({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: breadcrumbItems.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        item: item.url,
      })),
    });
  }

  for (const payload of payloads) {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(payload);
    script.setAttribute(marker, '1');
    document.head.appendChild(script);
  }
}

function removeJsonLd(): void {
  document
    .querySelectorAll(
      'script[data-seo-venue="1"], script[data-seo-landing="1"], script[data-seo-listing="1"], script[data-seo-breadcrumb="1"], script[data-seo-blog="1"]',
    )
    .forEach((el) => el.remove());
}

/** Blog index SEO. */
export function applyBlogListSeo(lang: 'en' | 'zh' = 'en', baseUrl?: string): void {
  const origin = typeof window !== 'undefined' ? window.location.origin : (baseUrl || '').replace(/\/$/, '');
  const pageUrl = origin ? `${origin}/blog` : `${baseUrl || ''}/blog`;
  const defaultImageUrl = origin ? new URL(DEFAULT_OG_IMAGE_PATH, origin).href : '';
  const title = lang === 'zh' ? `網誌 | ${BRAND}` : `Blog | ${BRAND}`;
  const description = lang === 'zh'
    ? 'Courts 網誌：香港運動場地貼士、場館資訊及社群故事。'
    : 'Courts blog: Hong Kong sports court tips, venue guides, and community stories.';

  document.title = title;
  setMeta('description', description);
  setMeta('keywords', DEFAULT_KEYWORDS);
  if (pageUrl) setCanonical(pageUrl);

  setOgTag('og:title', title);
  setOgTag('og:description', description);
  setOgTag('og:type', 'website');
  if (pageUrl) setOgTag('og:url', pageUrl);
  setOgTag('og:site_name', SITE_NAME);

  setMeta('twitter:card', 'summary_large_image');
  setMeta('twitter:title', title);
  setMeta('twitter:description', description);
  if (pageUrl) setMeta('twitter:url', pageUrl);
  if (defaultImageUrl) {
    setOgTag('og:image', defaultImageUrl);
    setMeta('twitter:image', defaultImageUrl);
  }

  removeJsonLd();
  const blogLd = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: `${BRAND} Blog`,
    url: pageUrl,
    publisher: { '@type': 'Organization', name: BRAND },
  };
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(blogLd);
  script.setAttribute('data-seo-blog', '1');
  document.head.appendChild(script);
}

function formatBlogPublished(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Single blog post SEO. Meta title/description use Published + Summary. */
export function applyBlogPostSeo(post: BlogPost, lang: 'en' | 'zh' = 'en', baseUrl?: string): void {
  const origin = typeof window !== 'undefined' ? window.location.origin : (baseUrl || '').replace(/\/$/, '');
  const pageUrl = origin
    ? `${origin}/blog/${post.slug}`
    : `${baseUrl || ''}/blog/${post.slug}`;
  const published = formatBlogPublished(post.published_at);
  const summary = cleanText(post.summary)
    || cleanText(post.title)
    || (lang === 'zh' ? 'Courts 網誌文章' : 'Courts blog article');
  const metaText = [published, summary].filter(Boolean).join(' ');
  const image = post.cover_url || '';
  const defaultImageUrl = origin ? new URL(DEFAULT_OG_IMAGE_PATH, origin).href : '';

  document.title = metaText;
  setMeta('description', metaText);
  setMeta('content', metaText);
  setMeta('keywords', DEFAULT_KEYWORDS);
  if (pageUrl) setCanonical(pageUrl);

  setOgTag('og:title', metaText);
  setOgTag('og:description', metaText);
  setOgTag('og:type', 'article');
  if (pageUrl) setOgTag('og:url', pageUrl);
  setOgTag('og:site_name', SITE_NAME);

  setMeta('twitter:card', 'summary_large_image');
  setMeta('twitter:title', metaText);
  setMeta('twitter:description', metaText);
  if (pageUrl) setMeta('twitter:url', pageUrl);

  const imageUrl = image
    ? (image.startsWith('http') ? image : new URL(image, origin).href)
    : defaultImageUrl;
  if (imageUrl) {
    setOgTag('og:image', imageUrl);
    setMeta('twitter:image', imageUrl);
  }

  removeJsonLd();
  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: summary,
    image: imageUrl ? [imageUrl] : undefined,
    datePublished: post.published_at || undefined,
    dateModified: post.updated_at || post.synced_at || post.published_at || undefined,
    author: { '@type': 'Organization', name: BRAND },
    publisher: { '@type': 'Organization', name: BRAND },
    mainEntityOfPage: pageUrl,
    url: pageUrl,
  };
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(articleLd);
  script.setAttribute('data-seo-blog', '1');
  document.head.appendChild(script);
}

