import type { Venue } from '../../types';
import { rowToVenue } from '../../db';

export type SportOption = { id: number; name: string; name_zh?: string | null; slug: string };

export type VenuesBootstrapPayload = {
  venues?: Venue[];
  sports?: SportOption[];
  generatedAt?: string;
};

const VENUES_CACHE_KEY = 'pickleball_venues_cache';
export const VENUES_CACHE_TTL_MS = 3 * 60 * 1000;

declare global {
  interface Window {
    __VENUES_BOOTSTRAP__?: VenuesBootstrapPayload;
  }
}

export async function prefetchVenuesBootstrap(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const res = await fetch('/venues-bootstrap.json', { cache: 'no-cache' });
    if (res.ok) {
      window.__VENUES_BOOTSTRAP__ = await res.json();
    }
  } catch {
    // Bootstrap is optional; API remains the source of truth.
  }
}

function readSessionCache(): { venues: Venue[]; sports: SportOption[]; ts: number } | null {
  try {
    const raw = sessionStorage.getItem(VENUES_CACHE_KEY);
    if (!raw) return null;
    const { data, sports, ts } = JSON.parse(raw);
    if (!Array.isArray(data) || typeof ts !== 'number') return null;
    return {
      venues: data,
      sports: Array.isArray(sports) ? sports : [],
      ts,
    };
  } catch {
    return null;
  }
}

export function hydrateInitialVenueData(): {
  venues: Venue[];
  sports: SportOption[];
  hasData: boolean;
} {
  const bootstrap = typeof window !== 'undefined' ? window.__VENUES_BOOTSTRAP__ : undefined;
  if (bootstrap?.venues?.length) {
    return {
      venues: bootstrap.venues.map((row) => rowToVenue(row)),
      sports: bootstrap.sports ?? [],
      hasData: true,
    };
  }

  const cached = readSessionCache();
  if (cached?.venues.length) {
    return {
      venues: cached.venues.map((row) => rowToVenue(row)),
      sports: cached.sports,
      hasData: true,
    };
  }

  return { venues: [], sports: [], hasData: false };
}

export function setVenuesCache(data: Venue[], sports: SportOption[], ts: number): void {
  try {
    sessionStorage.setItem(
      VENUES_CACHE_KEY,
      JSON.stringify({ data, sports, ts }),
    );
  } catch (e) {
    if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22)) {
      try {
        sessionStorage.removeItem(VENUES_CACHE_KEY);
      } catch {
        // ignore
      }
    }
  }
}

export function isVenuesCacheFresh(ts: number): boolean {
  return Date.now() - ts < VENUES_CACHE_TTL_MS;
}

export function readSessionCacheMeta(): { ts: number } | null {
  const cached = readSessionCache();
  return cached ? { ts: cached.ts } : null;
}
