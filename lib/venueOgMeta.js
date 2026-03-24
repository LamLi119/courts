/**
 * Shared venue Open Graph / Twitter meta + HTML injection (Vercel function + Express can import).
 * Slug algorithm must match src/utils/slugify.ts (Unicode letters/numbers kept).
 */

const SITE_NAME = 'Courts Finder';
const DEFAULT_OG_IMAGE_PATH = '/gray-G.png';
const DEFAULT_KEYWORDS =
  'pickleball courts hong kong, pickleball court hk, sports courts Hong Kong, court booking, MTR courts, 香港球場, 球場預訂, 匹克球, 匹克球香港';

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

function cleanText(s) {
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

function getSportTypeLabel(venue, lang = 'en') {
  const data = venue.sport_data;
  if (Array.isArray(data) && data.length > 0) {
    const labels = data
      .map((d) => (lang === 'zh' && d.name_zh ? d.name_zh : (d.name || '').trim()))
      .filter(Boolean);
    return labels.join(', ') || 'Court';
  }
  const types = venue.sport_types;
  if (Array.isArray(types) && types.length > 0) {
    return types.map((t) => (typeof t === 'string' ? t.trim() : '')).filter(Boolean).join(', ') || 'Court';
  }
  return 'Court';
}

export function getVenueTitle(venue, lang = 'en') {
  const sport = getSportTypeLabel(venue, lang);
  const mtr = cleanText(venue.mtrStation);
  const where = mtr ? ` in ${mtr}` : '';
  return `${venue.name} | ${sport} Court${where} | ${SITE_NAME}`;
}

export function getVenueDescription(venue, lang = 'en') {
  const sport = getSportTypeLabel(venue, lang);
  const mtr = cleanText(venue.mtrStation);
  const exit = cleanText(venue.mtrExit);
  const addr = cleanText(venue.address);
  const walkingDistance = numOrNull(venue.walkingDistance);
  const wd = walkingDistance != null && walkingDistance > 0 ? `${walkingDistance} min walk` : '';
  const mtrPart = mtr ? `near ${mtr}${exit ? ` (${exit})` : ''}` : '';
  const where = mtrPart ? ` in ${mtrPart}` : '';
  const courtCount = numOrNull(venue.court_count);
  const courts = courtCount != null && courtCount > 0 ? `${courtCount} courts` : '';
  const ceilingHeight = numOrNull(venue.ceilingHeight);
  const height = ceilingHeight != null && ceilingHeight > 0 ? `${ceilingHeight}m ceiling.` : '';
  const startingPrice = numOrNull(venue.startingPrice);
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

function uniqueCsv(items) {
  const out = [];
  const seen = new Set();
  for (const raw of items) {
    const v = cleanText(raw).replace(/[|]/g, '').trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out.join(', ');
}

export function getVenueKeywords(venue, lang = 'en') {
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
    `${venue.name}${priceMessage}`,
  ];
  return uniqueCsv(base);
}

export function parseVenueImages(venue) {
  let imgs = venue.images;
  if (typeof imgs === 'string') {
    try {
      imgs = JSON.parse(imgs);
    } catch {
      imgs = [];
    }
  }
  return Array.isArray(imgs) ? imgs : [];
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function absoluteImageUrl(image, origin) {
  const base = (origin || '').replace(/\/$/, '');
  if (!image) return `${base}${DEFAULT_OG_IMAGE_PATH}`;
  if (image.startsWith('http://') || image.startsWith('https://')) return image;
  return new URL(image.startsWith('/') ? image : `/${image}`, `${base}/`).href;
}

/**
 * @param {object} venue — row from API / getVenueWithSports
 * @param {{ pageUrl: string, origin: string, lang?: 'en'|'zh' }} opts
 */
export function buildVenueOgMeta(venue, opts) {
  const { pageUrl, origin, lang = 'en' } = opts;
  const title = getVenueTitle(venue, lang);
  const description = getVenueDescription(venue, lang);
  const keywords = getVenueKeywords(venue, lang);
  const images = parseVenueImages(venue);
  const first = images[0];
  const imageUrl = absoluteImageUrl(first, origin);

  const sport = getSportTypeLabel(venue, 'en');
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SportsActivityLocation',
    name: venue.name,
    url: pageUrl,
    address: {
      '@type': 'PostalAddress',
      streetAddress: venue.address || undefined,
      addressLocality: cleanText(venue.mtrStation) || undefined,
      addressRegion: 'Hong Kong',
    },
    image: imageUrl ? [imageUrl] : undefined,
    priceRange: venue.startingPrice ? `$${venue.startingPrice}` : undefined,
  };
  if (venue.whatsapp) {
    jsonLd.telephone = String(venue.whatsapp).replace(/[^0-9+]/g, '');
  }
  const extra = [];
  if (cleanText(venue.mtrStation)) {
    extra.push(
      `MTR: ${cleanText(venue.mtrStation)}${cleanText(venue.mtrExit) ? ` (${cleanText(venue.mtrExit)})` : ''}`
    );
  }
  if (typeof venue.walkingDistance === 'number' && venue.walkingDistance > 0) {
    extra.push(`Walking distance: ${venue.walkingDistance} min`);
  }
  if (typeof venue.ceilingHeight === 'number' && venue.ceilingHeight > 0) {
    extra.push(`Ceiling height: ${venue.ceilingHeight} m`);
  }
  if (venue.court_count != null && venue.court_count > 0) {
    extra.push(`Court count: ${venue.court_count}`);
  }
  if (extra.length) jsonLd.description = `${sport} venue. ` + extra.join(' · ');

  let coords = venue.coordinates;
  if (typeof coords === 'string') {
    try {
      coords = JSON.parse(coords);
    } catch {
      coords = null;
    }
  }
  if (coords?.lat != null && coords?.lng != null) {
    jsonLd.geo = {
      '@type': 'GeoCoordinates',
      latitude: coords.lat,
      longitude: coords.lng,
    };
  }

  return {
    title,
    description,
    keywords,
    canonicalUrl: pageUrl,
    imageUrl,
    jsonLdString: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
  };
}

/**
 * Replace title, description, keywords, canonical, og:*, twitter:* and inject JSON-LD.
 */
export function injectVenueOgIntoHtml(html, meta) {
  const {
    title,
    description,
    keywords,
    canonicalUrl,
    imageUrl,
    jsonLdString,
  } = meta;

  let out = html.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(title)}</title>`);

  /** Match <meta name|property="key" ... content="..."> including line breaks between attrs. */
  const setMetaContent = (attrName, key, value) => {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(
      `<meta\\s+${attrName}="${escapedKey}"[\\s\\S]*?content="[^"]*"`,
      'i'
    );
    const replacement = `<meta ${attrName}="${key}" content="${escapeHtml(value)}"`;
    if (re.test(out)) out = out.replace(re, replacement);
  };

  setMetaContent('name', 'description', description);
  setMetaContent('name', 'keywords', keywords);

  setMetaContent('property', 'og:title', title);
  setMetaContent('property', 'og:description', description);
  setMetaContent('property', 'og:url', canonicalUrl);
  setMetaContent('property', 'og:image', imageUrl);
  setMetaContent('property', 'og:image:secure_url', imageUrl);

  setMetaContent('name', 'twitter:url', canonicalUrl);
  setMetaContent('name', 'twitter:title', title);
  setMetaContent('name', 'twitter:description', description);
  setMetaContent('name', 'twitter:image', imageUrl);

  out = out.replace(
    /<link\s+rel="canonical"\s+href="[^"]*"/i,
    `<link rel="canonical" href="${escapeHtml(canonicalUrl)}"`
  );

  out = out.replace(/<script[^>]*data-seo-venue="1"[^>]*>[\s\S]*?<\/script>/gi, '');
  const ldScript = `<script type="application/ld+json" data-seo-venue="1">${jsonLdString}</script>`;
  out = out.replace(/<\/head>/i, `${ldScript}\n</head>`);

  return out;
}
