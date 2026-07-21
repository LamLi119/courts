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

function clampProxyWidth(width: number): number {
  if (!Number.isFinite(width) || width < 16) return 400;
  return Math.min(1600, Math.max(16, Math.round(width)));
}

/** Build `/api/image-proxy` URL; optional `w` enables server-side resize. */
export function venueProxyImageSrc(
  url: string,
  width?: number,
): string {
  const params = new URLSearchParams();
  params.set('url', url);
  if (width != null) params.set('w', String(clampProxyWidth(width)));
  return courtApiUrl(`/api/image-proxy?${params.toString()}`);
}

/**
 * Resolve venue image URL. When useProxy is true, route GCS objects through the API
 * image-proxy (works when bucket CORS is not yet configured).
 * Pass `width` to request a resized WebP from the proxy.
 */
export function venueImageSrc(
  url: string | undefined | null,
  useProxy = false,
  width?: number,
): string {
  const u = (url || '').trim();
  if (!u) return '/placeholder.svg';
  if (u.startsWith('data:') || u.startsWith('/')) return u;
  if (useProxy && isGcsImageUrl(u)) {
    return venueProxyImageSrc(u, width);
  }
  return u;
}

/**
 * Card-sized image URL. Always proxies GCS assets with a width hint so the server
 * can downscale + WebP (avoids multi‑MB originals on list/landing cards).
 */
export function venueCardImageSrc(
  url: string | undefined | null,
  _useProxy = true,
  width = 400,
): string {
  const u = (url || '').trim();
  if (!u || u.startsWith('data:') || u.startsWith('/')) {
    return venueImageSrc(url, false);
  }
  if (isGcsImageUrl(u)) {
    return venueProxyImageSrc(u, width);
  }
  return venueImageSrc(url, false);
}
