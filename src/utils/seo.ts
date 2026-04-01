import type { Venue } from '../../types';
import { slugify } from './slugify';

const SITE_NAME = 'Courts';
const DEFAULT_KEYWORDS =
  'pickleball courts hong kong, pickleball court hk, sports courts Hong Kong, court booking, MTR courts, 香港球場, 球場預訂, pickleball Hong Kong, 匹克球, 匹克球香港, pickleball 香港, pickleball 場地, 匹克球場地, 匹克球 租場, 匹克球場收費';

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

/** SEO title: {Venue Name} | {Sport Type} Court in {MTR} | Courts Finder */
export function getVenueTitle(venue: Venue, lang: 'en' | 'zh' = 'en'): string {
  const sport = getSportTypeLabel(venue, lang);
  const mtr = cleanText(venue.mtrStation);
  const where = mtr ? ` in ${mtr}` : '';
  return `${venue.name} | ${sport} Court${where} | ${SITE_NAME}`;
}

/** Meta description: booking + location + key attributes */
export function getVenueDescription(venue: Venue, lang: 'en' | 'zh' = 'en'): string {
  const sport = getSportTypeLabel(venue, lang);
  const mtr = cleanText(venue.mtrStation);
  const exit = cleanText(venue.mtrExit);
  const addr = cleanText(venue.address);
  const walkingDistance = numOrNull((venue as any).walkingDistance);
  const wd = walkingDistance != null && walkingDistance > 0 ? `${walkingDistance} min walk` : '';
  const mtrPart = mtr ? `near ${mtr}${exit ? ` (${exit})` : ''}` : '';
  const where =  mtrPart ? ` in ${mtrPart}` : '';
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

const DEFAULT_TITLE = `Courts Finder | Find Sports Courts in Hong Kong`;
const DEFAULT_DESCRIPTION = `Find and book sports courts near MTR stations. Compare prices, amenities, and walking distance.`;
/** Default share preview image (home page). Use absolute URL so crawlers see it when sharing site URL. */
const DEFAULT_OG_IMAGE_PATH = '/gray-G.png';

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
export function applySearchPageSeo(sportSlug: string, baseUrl?: string): void {
  const sport = sportSlug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const title = `${sport} Courts Hong Kong | ${SITE_NAME}`;
  const description = `Find ${sport.toLowerCase()} courts near MTR stations. Compare prices, amenities, and book today.`;
  const keywords = uniqueCsv([`${sport} courts hong kong`, `${sport} court hk`, `${sport} courts near mtr`, DEFAULT_KEYWORDS]);
  const searchUrl = typeof window !== 'undefined' ? window.location.href : `${baseUrl || ''}/search/${sportSlug}`;

  document.title = title;
  setMeta('description', description);
  setMeta('keywords', keywords);
  if (searchUrl) setCanonical(searchUrl);

  setOgTag('og:title', title);
  setOgTag('og:description', description);
  setOgTag('og:type', 'website');
  if (searchUrl) setOgTag('og:url', searchUrl);

  setMeta('twitter:title', title);
  setMeta('twitter:description', description);
  if (searchUrl) setMeta('twitter:url', searchUrl);

  removeJsonLd();
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

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'SportsActivityLocation',
    name: venue.name,
    url: pageUrl,
    address: {
      '@type': 'PostalAddress',
      streetAddress: venue.address,
      addressLocality: cleanText(venue.mtrStation) || undefined,
      addressRegion: 'Hong Kong'
    },
    image: imageUrl ? [imageUrl] : undefined,
    priceRange: venue.startingPrice ? `$${venue.startingPrice}` : undefined,
  };
  if (venue.whatsapp) {
    jsonLd.telephone = venue.whatsapp.replace(/[^0-9+]/g, '');
  }
  const extra: string[] = [];
  if (cleanText(venue.mtrStation)) extra.push(`MTR: ${cleanText(venue.mtrStation)}${cleanText(venue.mtrExit) ? ` (${cleanText(venue.mtrExit)})` : ''}`);
  if (typeof venue.walkingDistance === 'number' && venue.walkingDistance > 0) extra.push(`Walking distance: ${venue.walkingDistance} min`);
  if (typeof venue.ceilingHeight === 'number' && venue.ceilingHeight > 0) extra.push(`Ceiling height: ${venue.ceilingHeight} m`);
  if (venue.court_count != null && venue.court_count > 0) extra.push(`Court count: ${venue.court_count}`);
  if (extra.length) {
    (jsonLd as Record<string, unknown>).description = `${sport} venue. ` + extra.join(' · ');
  }
  if (venue.coordinates?.lat != null && venue.coordinates?.lng != null) {
    (jsonLd as Record<string, unknown>).geo = {
      '@type': 'GeoCoordinates',
      latitude: venue.coordinates.lat,
      longitude: venue.coordinates.lng,
    };
  }

  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(jsonLd);
  script.setAttribute('data-seo-venue', '1');
  document.head.appendChild(script);
}

function removeJsonLd(): void {
  document.querySelectorAll('script[data-seo-venue="1"]').forEach((el) => el.remove());
}

