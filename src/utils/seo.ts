import type { Venue } from '../../types';

const SITE_NAME = 'Courts Finder';

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

/** SEO title: {Venue Name} | {Sport Type} Court in {MTR Station} | Courts Finder */
export function getVenueTitle(venue: Venue, lang: 'en' | 'zh' = 'en'): string {
  const sport = getSportTypeLabel(venue, lang);
  return `${venue.name} | ${sport} Court in ${venue.mtrStation} | ${SITE_NAME}`;
}

/** Meta description: {Venue Name}. Featuring {Sport Type} facilities located just {Walking Distance} from {MTR Station}. Check pricing and amenities here. */
export function getVenueDescription(venue: Venue, lang: 'en' | 'zh' = 'en'): string {
  const sport = getSportTypeLabel(venue, lang);
  return `Book ${venue.name} today. Featuring ${sport} facilities located just ${venue.walkingDistance} min from ${venue.mtrStation}. Check pricing and amenities here.`;
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

const DEFAULT_TITLE = `Courts Finder | Find Sports Courts in Hong Kong`;
const DEFAULT_DESCRIPTION = `Find and book sports courts near MTR stations. Compare prices, amenities, and walking distance.`;
/** Default share preview image (home page). Use absolute URL so crawlers see it when sharing site URL. */
const DEFAULT_OG_IMAGE_PATH = '/green_G.png';

/** Apply dynamic meta and OG tags for a venue (detail page). Call when venue is shown. */
export function applyVenueSeo(venue: Venue, baseUrl: string, lang: 'en' | 'zh' = 'en'): void {
  const title = getVenueTitle(venue, lang);
  const description = getVenueDescription(venue, lang);
  const image = (venue.images && venue.images[0]) || '';
  const pageUrl = typeof window !== 'undefined' ? window.location.href : `${baseUrl}/venues/${venue.id}`;
  const origin = typeof window !== 'undefined' ? window.location.origin : baseUrl.replace(/\/$/, '');

  document.title = title;
  setMeta('description', description);
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
  const searchUrl = typeof window !== 'undefined' ? window.location.href : `${baseUrl || ''}/search/${sportSlug}`;

  document.title = title;
  setMeta('description', description);
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
  const pageUrl = typeof window !== 'undefined' ? window.location.href : `${baseUrl}/venues/${venue.id}`;

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'SportsActivityLocation',
    name: venue.name,
    url: pageUrl,
    address: {
      '@type': 'PostalAddress',
      streetAddress: venue.address,
      addressLocality: venue.mtrStation || undefined,
      addressRegion: 'Hong Kong'
    },
    image: imageUrl ? [imageUrl] : undefined,
    priceRange: venue.startingPrice ? `$${venue.startingPrice}` : undefined,
  };
  if (venue.whatsapp) {
    jsonLd.telephone = venue.whatsapp.replace(/[^0-9+]/g, '');
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

