import type { Language } from '../../types';

/**
 * HK MTR station names: English and Chinese.
 * DB may store either en or zh; we look up and return the name in the requested language.
 */
export const MTR_STATIONS: { en: string; zh: string }[] = [
  { en: 'Admiralty', zh: '金鐘' },
  { en: 'Central', zh: '中環' },
  { en: 'Tsim Sha Tsui', zh: '尖沙咀' },
  { en: 'Mong Kok', zh: '旺角' },
  { en: 'Prince Edward', zh: '太子' },
  { en: 'Jordan', zh: '佐敦' },
  { en: 'Yau Ma Tei', zh: '油麻地' },
  { en: 'Causeway Bay', zh: '銅鑼灣' },
  { en: 'Wan Chai', zh: '灣仔' },
  { en: 'North Point', zh: '北角' },
  { en: 'Quarry Bay', zh: '鰂魚涌' },
  { en: 'Tai Koo', zh: '太古' },
  { en: 'Sai Wan Ho', zh: '西灣河' },
  { en: 'Shau Kei Wan', zh: '筲箕灣' },
  { en: 'Chai Wan', zh: '柴灣' },
  { en: 'Hung Hom', zh: '紅磡' },
  { en: 'Olympic', zh: '奧運' },
  { en: 'Nam Cheong', zh: '南昌' },
  { en: 'Mei Foo', zh: '美孚' },
  { en: 'Lai King', zh: '荔景' },
  { en: 'Kwai Fong', zh: '葵芳' },
  { en: 'Kwai Hing', zh: '葵興' },
  { en: 'Tsuen Wan', zh: '荃灣' },
  { en: 'Sha Tin', zh: '沙田' },
  { en: 'Tai Po Market', zh: '大埔墟' },
  { en: 'Fanling', zh: '粉嶺' },
  { en: 'Sheung Shui', zh: '上水' },
  { en: 'Lo Wu', zh: '羅湖' },
  { en: 'Lok Ma Chau', zh: '落馬洲' },
  { en: 'Diamond Hill', zh: '鑽石山' },
  { en: 'Wong Tai Sin', zh: '黃大仙' },
  { en: 'Kowloon Bay', zh: '九龍灣' },
  { en: 'Ngau Tau Kok', zh: '牛頭角' },
  { en: 'Kwun Tong', zh: '觀塘' },
  { en: 'Lam Tin', zh: '藍田' },
  { en: 'Yau Tong', zh: '油塘' },
  { en: 'Tiu Keng Leng', zh: '調景嶺' },
  { en: 'Choi Hung', zh: '彩虹' },
  { en: 'Sham Shui Po', zh: '深水埗' },
  { en: 'Cheung Sha Wan', zh: '長沙灣' },
  { en: 'Tai Wo Hau', zh: '大窩口' },
  { en: 'Fo Tan', zh: '火炭' },
  { en: 'University', zh: '大學' },
  { en: 'Tai Wai', zh: '大圍' },
  { en: 'Kowloon Tong', zh: '九龍塘' },
  { en: 'Mong Kok East', zh: '旺角東' },
  { en: 'East Tsim Sha Tsui', zh: '尖東' },
  { en: 'Whampoa', zh: '黃埔' },
  { en: 'Ho Man Tin', zh: '何文田' },
  { en: 'To Kwa Wan', zh: '土瓜灣' },
  { en: 'Sung Wong Toi', zh: '宋皇臺' },
  { en: 'Kai Tak', zh: '啟德' },
  { en: 'Fortress Hill', zh: '炮台山' },
  { en: 'HKU', zh: '香港大學' },
  { en: 'Lai Chi Kok', zh: '荔枝角' },
  { en: 'Long Ping', zh: '朗屏' },
  { en: 'Po Lam', zh: '寶琳' },
  { en: 'Tsuen Wan East', zh: '荃灣東' },
  { en: 'Tsuen Wan West', zh: '荃灣西' },
  { en: 'Wong Chuk Hang', zh: '黃竹坑' },
  { en: 'Shek Mun', zh: '石門' },
  { en: 'Kwun Tong', zh: '觀塘' },
];

const byEn = new Map<string, { en: string; zh: string }>();
const byZh = new Map<string, { en: string; zh: string }>();
MTR_STATIONS.forEach((s) => {
  byEn.set(s.en.trim().toLowerCase(), s);
  byZh.set(s.zh.trim(), s);
});

/**
 * Get display name for an MTR station from DB.
 * DB value may be stored in English or Chinese; returns the name in the requested language.
 */
export function getStationDisplayName(dbValue: string | undefined, lang: Language): string {
  if (!dbValue || !dbValue.trim()) return '';
  const v = dbValue.trim();
  const byEnMatch = byEn.get(v.toLowerCase());
  if (byEnMatch) return lang === 'zh' ? byEnMatch.zh : byEnMatch.en;
  const byZhMatch = byZh.get(v);
  if (byZhMatch) return lang === 'zh' ? byZhMatch.zh : byZhMatch.en;
  return v;
}

/**
 * Get a canonical (English) key for matching stations.
 * This makes filtering robust when DB/UI uses mixed zh/en station names.
 */
export function getStationCanonicalEn(dbValue: string | undefined): string {
  if (!dbValue || !dbValue.trim()) return '';
  const v = dbValue.trim();
  const byEnMatch = byEn.get(v.toLowerCase());
  if (byEnMatch) return byEnMatch.en;
  const byZhMatch = byZh.get(v);
  if (byZhMatch) return byZhMatch.en;
  return v;
}
