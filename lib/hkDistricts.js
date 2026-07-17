/**
 * HK district helpers for Node (sitemap, pageSeoMeta). Keep in sync with src/utils/hkDistricts.ts.
 */

export const HK_REGION_LABELS = {
  'hk-island': { en: 'Hong Kong Island', zh: '香港島' },
  kowloon: { en: 'Kowloon', zh: '九龍' },
  'new-territories': { en: 'The New Territories', zh: '新界' },
};

export const HK_DISTRICTS = [
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

const STATION_TO_DISTRICT = {
  'Kennedy Town': 'central-and-western',
  HKU: 'central-and-western',
  'Sai Ying Pun': 'central-and-western',
  'Sheung Wan': 'central-and-western',
  Central: 'central-and-western',
  'Hong Kong': 'central-and-western',
  Admiralty: 'wan-chai',
  'Wan Chai': 'wan-chai',
  'Causeway Bay': 'wan-chai',
  'Tin Hau': 'wan-chai',
  'Exhibition Centre': 'wan-chai',
  'Fortress Hill': 'eastern',
  'North Point': 'eastern',
  'Quarry Bay': 'eastern',
  'Tai Koo': 'eastern',
  'Sai Wan Ho': 'eastern',
  'Shau Kei Wan': 'eastern',
  'Heng Fa Chuen': 'eastern',
  'Chai Wan': 'eastern',
  'Ocean Park': 'southern',
  'Wong Chuk Hang': 'southern',
  'Lei Tung': 'southern',
  'South Horizons': 'southern',
  'Tsim Sha Tsui': 'yau-tsim-mong',
  'East Tsim Sha Tsui': 'yau-tsim-mong',
  Jordan: 'yau-tsim-mong',
  'Yau Ma Tei': 'yau-tsim-mong',
  'Mong Kok': 'yau-tsim-mong',
  'Prince Edward': 'yau-tsim-mong',
  'Mong Kok East': 'yau-tsim-mong',
  Austin: 'yau-tsim-mong',
  Kowloon: 'yau-tsim-mong',
  Olympic: 'yau-tsim-mong',
  'Hong Kong West Kowloon': 'yau-tsim-mong',
  Whampoa: 'kowloon-city',
  'Ho Man Tin': 'kowloon-city',
  'To Kwa Wan': 'kowloon-city',
  'Sung Wong Toi': 'kowloon-city',
  'Kai Tak': 'kowloon-city',
  'Kowloon Tong': 'kowloon-city',
  'Hung Hom': 'kowloon-city',
  'Mei Foo': 'sham-shui-po',
  'Lai Chi Kok': 'sham-shui-po',
  'Cheung Sha Wan': 'sham-shui-po',
  'Sham Shui Po': 'sham-shui-po',
  'Shek Kip Mei': 'sham-shui-po',
  'Nam Cheong': 'sham-shui-po',
  'Lok Fu': 'wong-tai-sin',
  'Wong Tai Sin': 'wong-tai-sin',
  'Diamond Hill': 'wong-tai-sin',
  'Choi Hung': 'wong-tai-sin',
  'Kowloon Bay': 'kwun-tong',
  'Ngau Tau Kok': 'kwun-tong',
  'Kwun Tong': 'kwun-tong',
  'Lam Tin': 'kwun-tong',
  'Yau Tong': 'kwun-tong',
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
  Racecourse: 'sha-tin',
  University: 'sha-tin',
  'Tiu Keng Leng': 'sai-kung',
  'Tseung Kwan O': 'sai-kung',
  'Hang Hau': 'sai-kung',
  'Po Lam': 'sai-kung',
  'LOHAS Park': 'sai-kung',
  'Tai Po Market': 'tai-po',
  'Tai Wo': 'tai-po',
  Fanling: 'north',
  'Sheung Shui': 'north',
  'Lo Wu': 'north',
  'Kam Sheung Road': 'yuen-long',
  'Yuen Long': 'yuen-long',
  'Long Ping': 'yuen-long',
  'Tin Shui Wai': 'yuen-long',
  'Lok Ma Chau': 'yuen-long',
  'Siu Hong': 'tuen-mun',
  'Tuen Mun': 'tuen-mun',
  'Tai Wo Hau': 'tsuen-wan',
  'Tsuen Wan': 'tsuen-wan',
  'Tsuen Wan West': 'tsuen-wan',
  'Lai King': 'kwai-tsing',
  'Kwai Fong': 'kwai-tsing',
  'Kwai Hing': 'kwai-tsing',
  'Tsing Yi': 'kwai-tsing',
  'Sunny Bay': 'islands',
  'Tung Chung': 'islands',
  'Disneyland Resort': 'islands',
  Airport: 'islands',
  'AsiaWorld-Expo': 'islands',
};

export function isValidDistrictSlug(slug) {
  return districtBySlug.has(String(slug || '').toLowerCase().trim());
}

export function getDistrictBySlug(slug) {
  return districtBySlug.get(String(slug || '').toLowerCase().trim()) || null;
}

export function getDistrictDisplayName(slug, lang = 'en') {
  const district = getDistrictBySlug(slug);
  if (!district) return slug;
  return lang === 'zh' ? district.zh : district.en;
}

export function getRegionDisplayName(region, lang = 'en') {
  const label = HK_REGION_LABELS[region];
  if (!label) return region;
  return lang === 'zh' ? label.zh : label.en;
}

/** Best-effort station canonicalization (English key) for Node scripts. */
function getStationCanonicalEn(station) {
  const raw = String(station || '').trim();
  if (!raw) return '';
  if (STATION_TO_DISTRICT[raw]) return raw;
  const lower = raw.toLowerCase();
  for (const key of Object.keys(STATION_TO_DISTRICT)) {
    if (key.toLowerCase() === lower) return key;
  }
  return raw;
}

export function getVenueDistrictSlug(venue) {
  const station = getStationCanonicalEn(venue?.mtrStation);
  if (station && STATION_TO_DISTRICT[station]) {
    return STATION_TO_DISTRICT[station];
  }

  const addr = String(venue?.address || '').toLowerCase();
  if (!addr) return null;

  for (const district of HK_DISTRICTS) {
    if (addr.includes(district.en.toLowerCase()) || addr.includes(district.zh)) {
      return district.slug;
    }
  }
  return null;
}

export function venueMatchesDistricts(venue, districtSlugs) {
  if (!districtSlugs || districtSlugs.length === 0) return true;
  const slug = getVenueDistrictSlug(venue);
  return slug !== null && districtSlugs.includes(slug);
}
