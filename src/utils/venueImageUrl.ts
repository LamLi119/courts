import { courtApiUrl } from './courtApiUrl';

const GCS_HOST = 'storage.googleapis.com';

export function isGcsImageUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  try {
    return new URL(url, 'https://example.com').hostname.includes(GCS_HOST);
  } catch {
    return url.includes(GCS_HOST);
  }
}

/**
 * Resolve venue image URL. When useProxy is true, route GCS objects through the API
 * image-proxy (works when bucket CORS is not yet configured).
 */
export function venueImageSrc(url: string | undefined | null, useProxy = false): string {
  const u = (url || '').trim();
  if (!u) return '/placeholder.svg';
  if (u.startsWith('data:') || u.startsWith('/')) return u;
  if (useProxy && isGcsImageUrl(u)) {
    return courtApiUrl(`/api/image-proxy?url=${encodeURIComponent(u)}`);
  }
  return u;
}

/** Prefer a smaller display width hint for card grids (browser + CDN still serve full object). */
export function venueCardImageSrc(url: string | undefined | null, useProxy = false): string {
  return venueImageSrc(url, useProxy);
}
