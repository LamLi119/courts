import type { Language } from '../../types';
import { getStationCanonicalEn } from './mtrStations';

export type HkRegion = 'hk-island' | 'kowloon' | 'new-territories';

export interface HkDistrict {
  slug: string;
  en: string;
  zh: string;
  region: HkRegion;
}

export const HK_REGION_LABELS: Record<HkRegion, { en: string; zh: string }> = {
  'hk-island': { en: 'Hong Kong Island', zh: '香港島' },
  kowloon: { en: 'Kowloon', zh: '九龍' },
  'new-territories': { en: 'The New Territories', zh: '新界' },
};

/** Hong Kong's 18 administrative districts. */
export const HK_DISTRICTS: HkDistrict[] = [
  { slug: 'central-and-western', en: 'Central and Western', zh: '中西區', region: 'hk-island' },
  { slug: 'wan-chai', en: 'Wan Chai', zh: '灣仔', region: 'hk-island' },
  { slug: 'eastern', en: 'Eastern', zh: '東區', region: 'hk-island' },
  { slug: 'southern', en: 'Southern', zh: '南區', region: 'hk-island' },
  { slug: 'yau-tsim-mong', en: 'Yau Tsim Mong', zh: '油尖旺', region: 'kowloon' },
  { slug: 'sham-shui-po', en: 'Sham Shui Po', zh: '深水埗', region: 'kowloon' },
  { slug: 'kowloon-city', en: 'Kowloon City', zh: '九龍城', region: 'kowloon' },
  { slug: 'wong-tai-sin', en: 'Wong Tai Sin', zh: '黃大仙', region: 'kowloon' },
  { slug: 'kwun-tong', en: 'Kwun Tong', zh: '觀塘', region: 'kowloon' },
  { slug: 'kwai-tsing', en: 'Kwai Tsing', zh: '葵青', region: 'new-territories' },
  { slug: 'tsuen-wan', en: 'Tsuen Wan', zh: '荃灣', region: 'new-territories' },
  { slug: 'sha-tin', en: 'Sha Tin', zh: '沙田', region: 'new-territories' },
  { slug: 'tai-po', en: 'Tai Po', zh: '大埔', region: 'new-territories' },
  { slug: 'north', en: 'North', zh: '北區', region: 'new-territories' },
  { slug: 'sai-kung', en: 'Sai Kung', zh: '西貢', region: 'new-territories' },
  { slug: 'yuen-long', en: 'Yuen Long', zh: '元朗', region: 'new-territories' },
  { slug: 'tuen-mun', en: 'Tuen Mun', zh: '屯門', region: 'new-territories' },
  { slug: 'islands', en: 'Islands', zh: '離島', region: 'new-territories' },
];

const districtBySlug = new Map(HK_DISTRICTS.map((d) => [d.slug, d]));

/** MTR station (canonical English) → district slug */
const STATION_TO_DISTRICT: Record<string, string> = {
  // Hong Kong Island — Central and Western
  'Kennedy Town': 'central-and-western',
  'HKU': 'central-and-western',
  'Sai Ying Pun': 'central-and-western',
  'Sheung Wan': 'central-and-western',
  'Central': 'central-and-western',
  'Hong Kong': 'central-and-western',
  // Hong Kong Island — Wan Chai
  'Admiralty': 'wan-chai',
  'Wan Chai': 'wan-chai',
  'Causeway Bay': 'wan-chai',
  'Tin Hau': 'wan-chai',
  'Exhibition Centre': 'wan-chai',
  // Hong Kong Island — Eastern
  'Fortress Hill': 'eastern',
  'North Point': 'eastern',
  'Quarry Bay': 'eastern',
  'Tai Koo': 'eastern',
  'Sai Wan Ho': 'eastern',
  'Shau Kei Wan': 'eastern',
  'Heng Fa Chuen': 'eastern',
  'Chai Wan': 'eastern',
  // Hong Kong Island — Southern
  'Ocean Park': 'southern',
  'Wong Chuk Hang': 'southern',
  'Lei Tung': 'southern',
  'South Horizons': 'southern',
  // Kowloon — Yau Tsim Mong
  'Tsim Sha Tsui': 'yau-tsim-mong',
  'East Tsim Sha Tsui': 'yau-tsim-mong',
  'Jordan': 'yau-tsim-mong',
  'Yau Ma Tei': 'yau-tsim-mong',
  'Mong Kok': 'yau-tsim-mong',
  'Prince Edward': 'yau-tsim-mong',
  'Mong Kok East': 'yau-tsim-mong',
  'Austin': 'yau-tsim-mong',
  'Kowloon': 'yau-tsim-mong',
  'Olympic': 'yau-tsim-mong',
  'Hong Kong West Kowloon': 'yau-tsim-mong',
  // Kowloon — Kowloon City
  'Whampoa': 'kowloon-city',
  'Ho Man Tin': 'kowloon-city',
  'To Kwa Wan': 'kowloon-city',
  'Sung Wong Toi': 'kowloon-city',
  'Kai Tak': 'kowloon-city',
  'Kowloon Tong': 'kowloon-city',
  'Hung Hom': 'kowloon-city',
  // Kowloon — Sham Shui Po
  'Mei Foo': 'sham-shui-po',
  'Lai Chi Kok': 'sham-shui-po',
  'Cheung Sha Wan': 'sham-shui-po',
  'Sham Shui Po': 'sham-shui-po',
  'Shek Kip Mei': 'sham-shui-po',
  'Nam Cheong': 'sham-shui-po',
  // Kowloon — Wong Tai Sin
  'Lok Fu': 'wong-tai-sin',
  'Wong Tai Sin': 'wong-tai-sin',
  'Diamond Hill': 'wong-tai-sin',
  'Choi Hung': 'wong-tai-sin',
  // Kowloon — Kwun Tong
  'Kowloon Bay': 'kwun-tong',
  'Ngau Tau Kok': 'kwun-tong',
  'Kwun Tong': 'kwun-tong',
  'Lam Tin': 'kwun-tong',
  'Yau Tong': 'kwun-tong',
  // New Territories — Sha Tin
  'Hin Keng': 'sha-tin',
  'Tai Wai': 'sha-tin',
  'Che Kung Temple': 'sha-tin',
  'Sha Tin Wai': 'sha-tin',
  'City One': 'sha-tin',
  'Shek Mun': 'sha-tin',
  'Tai Shui Hang': 'sha-tin',
  'Heng On': 'sha-tin',
  'Ma On Shan': 'sha-tin',
  'Wu Kai Sha': 'sha-tin',
  'Sha Tin': 'sha-tin',
  'Fo Tan': 'sha-tin',
  'Racecourse': 'sha-tin',
  'University': 'sha-tin',
  // New Territories — Sai Kung
  'Tiu Keng Leng': 'sai-kung',
  'Tseung Kwan O': 'sai-kung',
  'Hang Hau': 'sai-kung',
  'Po Lam': 'sai-kung',
  'LOHAS Park': 'sai-kung',
  // New Territories — Tai Po
  'Tai Po Market': 'tai-po',
  'Tai Wo': 'tai-po',
  // New Territories — North
  'Fanling': 'north',
  'Sheung Shui': 'north',
  'Lo Wu': 'north',
  // New Territories — Yuen Long
  'Kam Sheung Road': 'yuen-long',
  'Yuen Long': 'yuen-long',
  'Long Ping': 'yuen-long',
  'Tin Shui Wai': 'yuen-long',
  'Lok Ma Chau': 'yuen-long',
  // New Territories — Tuen Mun
  'Siu Hong': 'tuen-mun',
  'Tuen Mun': 'tuen-mun',
  // New Territories — Tsuen Wan
  'Tai Wo Hau': 'tsuen-wan',
  'Tsuen Wan': 'tsuen-wan',
  'Tsuen Wan West': 'tsuen-wan',
  // New Territories — Kwai Tsing
  'Lai King': 'kwai-tsing',
  'Kwai Fong': 'kwai-tsing',
  'Kwai Hing': 'kwai-tsing',
  'Tsing Yi': 'kwai-tsing',
  // New Territories — Islands
  'Sunny Bay': 'islands',
  'Tung Chung': 'islands',
  'Disneyland Resort': 'islands',
  'Airport': 'islands',
  'AsiaWorld-Expo': 'islands',
};

export function getDistrictDisplayName(slug: string, lang: Language): string {
  const district = districtBySlug.get(slug);
  if (!district) return slug;
  return lang === 'zh' ? district.zh : district.en;
}

export function getRegionDisplayName(region: HkRegion, lang: Language): string {
  const label = HK_REGION_LABELS[region];
  return lang === 'zh' ? label.zh : label.en;
}

export function getDistrictsByRegion(region: HkRegion): HkDistrict[] {
  return HK_DISTRICTS.filter((d) => d.region === region);
}

export function getVenueDistrictSlug(venue: {
  mtrStation?: string;
  address?: string;
}): string | null {
  const station = getStationCanonicalEn(venue.mtrStation);
  if (station && STATION_TO_DISTRICT[station]) {
    return STATION_TO_DISTRICT[station];
  }

  const addr = (venue.address || '').toLowerCase();
  if (!addr) return null;

  for (const district of HK_DISTRICTS) {
    if (
      addr.includes(district.en.toLowerCase())
      || addr.includes(district.zh)
    ) {
      return district.slug;
    }
  }

  return null;
}

export function venueMatchesDistricts(
  venue: { mtrStation?: string; address?: string },
  districtSlugs: string[],
): boolean {
  if (districtSlugs.length === 0) return true;
  const slug = getVenueDistrictSlug(venue);
  return slug !== null && districtSlugs.includes(slug);
}
