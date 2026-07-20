/**
 * IndexNow URL submission (Bing, Yandex, etc.).
 * https://www.indexnow.org/documentation
 */

import { slugifyVenueName } from './sitemap.js';

const DEFAULT_BASE_URL = 'https://courts.theground.io';
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';

export function getSiteBaseUrl() {
  return (process.env.SITEMAP_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
}

export function getIndexNowKey() {
  return (process.env.INDEXNOW_KEY || '').trim();
}

export function venuePublicUrl(venue, baseUrl = getSiteBaseUrl()) {
  const slug = slugifyVenueName(venue?.name);
  if (!slug) return null;
  return `${baseUrl.replace(/\/$/, '')}/venues/${slug}`;
}

/**
 * Submit changed URLs to IndexNow. Fire-and-forget; logs errors only.
 * @param {string[]} urlList
 */
export async function submitIndexNowUrls(urlList) {
  const key = getIndexNowKey();
  if (!key) return;

  const urls = [...new Set((urlList || []).filter(Boolean))];
  if (!urls.length) return;

  const baseUrl = getSiteBaseUrl();
  const host = new URL(baseUrl).host;
  const keyLocation = `${baseUrl}/${key}.txt`;

  const body = { host, key, keyLocation, urlList: urls };

  try {
    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body),
    });
    if (!res.ok && res.status !== 202) {
      const text = await res.text().catch(() => '');
      console.warn(`[IndexNow] ${res.status} ${text}`.trim());
    }
  } catch (err) {
    console.warn('[IndexNow] submit failed:', err?.message || err);
  }
}

/** Notify IndexNow for a single venue (non-blocking). */
export function notifyIndexNowForVenue(venue) {
  const url = venuePublicUrl(venue);
  if (!url) return;
  submitIndexNowUrls([url]).catch(() => {});
}
