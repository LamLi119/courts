import type { Venue, Language } from '../../types';
import type { GrindEventRow } from './grindEventFormat';
import { getVenueDistrictSlug, getDistrictDisplayName } from './hkDistricts';
import { getStationDisplayName } from './mtrStations';

function clean(s: unknown): string {
  return typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '';
}

function sportLabel(venue: Venue, lang: Language): string {
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

function numOrNull(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Strip HTML to plain text for length checks / matching. */
export function stripHtml(html: string | undefined | null): string {
  if (!html?.trim()) return '';
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Match Grind public events to this venue so the detail page does not
 * reuse the same site-wide events block on every location.
 */
export function eventMatchesVenue(ev: GrindEventRow, venue: Venue): boolean {
  const hay = [
    ev.location,
    ev.companyName,
    ev.company?.name,
    ev.name,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (!hay) return false;

  const name = clean(venue.name).toLowerCase();
  if (name.length >= 4 && hay.includes(name)) return true;

  // Brand prefix before district/paren (e.g. "Bay Pickle (Tin Hau)")
  const brand = name.replace(/\s*[(\[{].*$/, '').trim();
  if (brand.length >= 5 && hay.includes(brand)) return true;

  const addr = clean(venue.address).toLowerCase();
  if (addr.length >= 8) {
    const chunk = addr.slice(0, Math.min(24, addr.length));
    if (hay.includes(chunk)) return true;
  }

  const mtr = clean(venue.mtrStation).toLowerCase();
  if (mtr.length >= 3 && hay.includes(mtr) && brand.length >= 4 && hay.includes(brand.slice(0, 8))) {
    return true;
  }

  return false;
}

export type VenueSeoSection = {
  heading: string;
  paragraphs: string[];
};

/**
 * Location-unique, citable prose for venue pages (helps chain locations
 * that share membership copy). Built from structured venue fields only.
 */
export function buildVenueSeoSections(venue: Venue, lang: Language): VenueSeoSection[] {
  const sport = sportLabel(venue, lang);
  const districtSlug = getVenueDistrictSlug(venue);
  const district = districtSlug ? getDistrictDisplayName(districtSlug, lang) : '';
  const mtrRaw = clean(venue.mtrStation);
  const mtr = mtrRaw
    ? (lang === 'zh' ? getStationDisplayName(mtrRaw, 'zh') : getStationDisplayName(mtrRaw, 'en'))
    : '';
  const exit = clean(venue.mtrExit);
  const walk = numOrNull(venue.walkingDistance);
  const courts = numOrNull(venue.court_count);
  const price = numOrNull(venue.startingPrice);
  const ceiling = numOrNull(venue.ceilingHeight);
  const addr = clean(venue.address);
  const amenities = Array.isArray(venue.amenities)
    ? venue.amenities.map((a) => clean(a)).filter(Boolean)
    : [];
  const customDesc = stripHtml(venue.description);

  if (lang === 'zh') {
    const overview: string[] = [];
    if (customDesc.length > 40) {
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
    const facts: string[] = [];
    if (courts != null && courts > 0) facts.push(`場內約有${courts}個球場`);
    if (ceiling != null && ceiling > 0) facts.push(`網高約${ceiling}米`);
    if (price != null && price > 0) facts.push(`起步價約每小時$${price}`);
    if (facts.length) {
      overview.push(`關於場地規格：${facts.join('；')}。請以場館最新公布為準。`);
    }
    if (amenities.length) {
      overview.push(`常用設施包括：${amenities.slice(0, 8).join('、')}。`);
    }
    overview.push(
      `如需比較${district || '附近'}其他${sport}場地、收費與港鐵步行距離，可返回 Courts 以地區或運動類型繼續搜尋。`,
    );

    return [
      {
        heading: `如何前往${venue.name}？`,
        paragraphs: [
          mtr
            ? `多數訪客可經港鐵${mtr}${exit ? `（${exit}）` : ''}前往` +
              (walk != null && walk > 0 ? `，出站後步行約${walk}分鐘到達。` : '。')
              + (addr ? `詳細地址：${addr}。` : '')
            : (addr
              ? `${venue.name}地址為${addr}。建議使用下方「獲取路線」開啟 Google 地圖導航。`
              : `請於場地詳情頁查看最新地址與開放時間，並以 Google 地圖確認路線。`),
        ],
      },
      {
        heading: `${venue.name}適合什麼用途？`,
        paragraphs: overview,
      },
    ];
  }

  const overview: string[] = [];
  if (customDesc.length > 40) {
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
  const facts: string[] = [];
  if (courts != null && courts > 0) facts.push(`approximately ${courts} court${courts === 1 ? '' : 's'}`);
  if (ceiling != null && ceiling > 0) facts.push(`around ${ceiling}m ceiling height`);
  if (price != null && price > 0) facts.push(`starting from about HK$${price} per hour`);
  if (facts.length) {
    overview.push(`Venue details on Courts include ${facts.join(', ')}. Always confirm pricing and availability with the operator before booking.`);
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
            ? `${venue.name} is listed at ${addr}. Use Get Directions below to open Google Maps with the exact coordinates.`
            : `Check the address and hours on this page, then open Google Maps for turn-by-turn directions.`),
      ],
    },
    {
      heading: `What should I know about ${venue.name}?`,
      paragraphs: overview,
    },
  ];
}

/** Flatten SEO sections into one meta/OG description (not shown in the page UI). */
export function flattenVenueSeoForMeta(
  venue: Venue,
  lang: Language,
  maxLen = 320,
): string {
  const text = buildVenueSeoSections(venue, lang)
    .flatMap((s) => s.paragraphs)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return '';
  if (text.length <= maxLen) return text;
  const cut = text.slice(0, maxLen - 1);
  const safer = cut.replace(/\s+\S*$/, '');
  return `${(safer || cut).trimEnd()}…`;
}

/** Stable YYYY-MM-DD that only changes when venue content changes (no DB updated_at). */
export function venueContentLastmod(venue: Record<string, unknown> | Venue): string {
  const rawUpdated = (venue as any).updated_at || (venue as any).updatedAt;
  if (rawUpdated) {
    const d = new Date(rawUpdated);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }

  const payload = JSON.stringify({
    name: (venue as any).name,
    description: (venue as any).description,
    address: (venue as any).address,
    mtrStation: (venue as any).mtrStation,
    pricing: (venue as any).pricing,
    images: (venue as any).images,
    startingPrice: (venue as any).startingPrice,
    court_count: (venue as any).court_count,
    amenities: (venue as any).amenities,
    operating_hours: (venue as any).operating_hours,
    membership_description: (venue as any).membership_description,
    coordinates: (venue as any).coordinates,
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

export function googleMapsDirectionsUrl(venue: Venue): string {
  const lat = numOrNull(venue.coordinates?.lat);
  const lng = numOrNull(venue.coordinates?.lng);
  if (lat != null && lng != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }
  const addr = clean(venue.address);
  if (addr) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.name)}`;
}

/** iframe embed URL (no Maps JS API key required). */
export function googleMapsEmbedUrl(venue: Venue): string | null {
  const lat = numOrNull(venue.coordinates?.lat);
  const lng = numOrNull(venue.coordinates?.lng);
  if (lat != null && lng != null) {
    return `https://maps.google.com/maps?q=${lat},${lng}&z=16&output=embed`;
  }
  const addr = clean(venue.address);
  if (addr) {
    return `https://maps.google.com/maps?q=${encodeURIComponent(addr)}&z=16&output=embed`;
  }
  return null;
}
