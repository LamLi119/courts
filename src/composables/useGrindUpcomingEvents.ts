import { ref } from 'vue';
import { courtApiUrl } from '../utils/courtApiUrl';
import type { GrindEventRow } from '../utils/grindEventFormat';

export type GrindUpcomingEventsPayload = {
  data?: GrindEventRow[];
  events?: GrindEventRow[];
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
    pageCount?: number;
  };
};

export type GrindUpcomingRefreshOptions = {
  /**
   * Max API pages to fetch (pageSize 8 each).
   * Home / background poll should use 1; upcoming list + venue detail can use more.
   */
  maxPages?: number;
};

/** Shared store so home prefetch and venue detail stay in sync. */
const loading = ref(false);
const error = ref<string | null>(null);
const events = ref<GrindEventRow[]>([]);
/** How many API pages the in-memory/cache payload covers. */
const pagesFetched = ref(0);
let activeRequestId = 0;

const LOCAL_CACHE_KEY = 'venue_upcoming_events_cache_v3';
const LOCAL_CACHE_TTL_MS = 1000 * 60 * 5; // 5 minutes
const DEFAULT_MAX_PAGES = 20;
const PAGE_SIZE = 8;

type LocalCachePayload = {
  ts?: number;
  events?: GrindEventRow[];
  pagesFetched?: number;
  pageCount?: number;
};

function isNotFinished(ev: GrindEventRow): boolean {
  const end = new Date(ev.endDate).getTime();
  if (!Number.isFinite(end)) return false;
  return end > Date.now();
}

function readItems(payload: GrindUpcomingEventsPayload): GrindEventRow[] {
  if (Array.isArray(payload)) return payload as GrindEventRow[];
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.events)) return payload.events;
  const any = payload as Record<string, unknown>;
  for (const k of ['items', 'records', 'list', 'rows', 'results', 'content'] as const) {
    const v = any[k];
    if (Array.isArray(v)) return v as GrindEventRow[];
  }
  if (any.data && typeof any.data === 'object' && !Array.isArray(any.data)) {
    const inner = any.data as Record<string, unknown>;
    for (const k of ['data', 'events', 'items', 'records', 'list', 'rows'] as const) {
      const v = inner[k];
      if (Array.isArray(v)) return v as GrindEventRow[];
    }
  }
  return [];
}

function normalizeEvents(list: GrindEventRow[]): GrindEventRow[] {
  return list.filter(isNotFinished).sort((a, b) => {
    const endA = new Date(a.endDate).getTime();
    const endB = new Date(b.endDate).getTime();
    if (endA !== endB) return endA - endB;
    return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
  });
}

function isCacheComplete(pages: number, pageCount: number): boolean {
  const pc = Math.max(1, pageCount || 1);
  return pages >= Math.min(pc, DEFAULT_MAX_PAGES);
}

function readLocalCache(minPages: number): {
  events: GrindEventRow[];
  pagesFetched: number;
  pageCount: number;
} | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalCachePayload;
    const ts = Number(parsed?.ts || 0);
    const list = Array.isArray(parsed?.events) ? parsed.events : [];
    const fetched = Number(parsed?.pagesFetched || 0);
    const pageCount = Number(parsed?.pageCount || 0);
    if (!ts || Date.now() - ts > LOCAL_CACHE_TTL_MS) return null;
    if (list.length === 0 || fetched < 1) return null;
    if (minPages > 1 && !isCacheComplete(fetched, pageCount) && fetched < minPages) {
      return null;
    }
    return {
      events: normalizeEvents(list),
      pagesFetched: fetched,
      pageCount,
    };
  } catch {
    return null;
  }
}

function writeLocalCache(
  list: GrindEventRow[],
  meta: { pagesFetched: number; pageCount: number },
): void {
  if (typeof window === 'undefined') return;
  try {
    const existingRaw = window.localStorage.getItem(LOCAL_CACHE_KEY);
    if (existingRaw) {
      const existing = JSON.parse(existingRaw) as LocalCachePayload;
      const existingFetched = Number(existing?.pagesFetched || 0);
      const existingTs = Number(existing?.ts || 0);
      // Don't shrink a fresher, more complete cache with a 1-page home poll.
      if (
        existingFetched > meta.pagesFetched
        && existingTs
        && Date.now() - existingTs <= LOCAL_CACHE_TTL_MS
      ) {
        return;
      }
    }
    window.localStorage.setItem(
      LOCAL_CACHE_KEY,
      JSON.stringify({
        ts: Date.now(),
        events: list,
        pagesFetched: meta.pagesFetched,
        pageCount: meta.pageCount,
      }),
    );
  } catch {
    // ignore quota/private mode failures
  }
}

async function fetchPage(page: number, pageSize: number): Promise<GrindUpcomingEventsPayload> {
  const url = courtApiUrl(
    `/api/events/public?tab=upcoming&order=ASC&page=${page}&pageSize=${pageSize}`,
  );
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || res.statusText || 'Request failed');
  }
  return (await res.json()) as GrindUpcomingEventsPayload;
}

async function loadGrindUpcomingEvents(
  options: GrindUpcomingRefreshOptions = {},
): Promise<void> {
  const maxPages = Math.min(
    Math.max(1, Number(options.maxPages ?? DEFAULT_MAX_PAGES) || DEFAULT_MAX_PAGES),
    DEFAULT_MAX_PAGES,
  );
  const requestId = ++activeRequestId;
  const cached = readLocalCache(maxPages);
  if (cached) {
    events.value = cached.events;
    pagesFetched.value = cached.pagesFetched;
    loading.value = false;
  } else if (events.value.length === 0) {
    loading.value = true;
  }
  error.value = null;
  try {
    const first = await fetchPage(1, PAGE_SIZE);
    if (requestId !== activeRequestId) return;
    const firstItems = readItems(first);
    const totalPages = Math.max(1, Number(first.meta?.pageCount || 1));
    const pagesToFetch = Math.min(totalPages, maxPages);
    const normalizedFirst = normalizeEvents(firstItems);

    // Home light refresh: don't replace a fuller in-memory list with page 1 only.
    if (pagesToFetch === 1) {
      if (events.value.length <= normalizedFirst.length) {
        events.value = normalizedFirst;
        pagesFetched.value = 1;
      }
      writeLocalCache(normalizedFirst, { pagesFetched: 1, pageCount: totalPages });
      loading.value = false;
      return;
    }

    events.value = normalizedFirst;
    pagesFetched.value = 1;
    writeLocalCache(normalizedFirst, { pagesFetched: 1, pageCount: totalPages });
    loading.value = false;

    let merged = [...firstItems];
    if (pagesToFetch > 1) {
      const rest = await Promise.all(
        Array.from({ length: pagesToFetch - 1 }, (_, i) => fetchPage(i + 2, PAGE_SIZE)),
      );
      if (requestId !== activeRequestId) return;
      rest.forEach((p) => {
        merged = merged.concat(readItems(p));
      });
    }

    const normalizedMerged = normalizeEvents(merged);
    events.value = normalizedMerged;
    pagesFetched.value = pagesToFetch;
    writeLocalCache(normalizedMerged, {
      pagesFetched: pagesToFetch,
      pageCount: totalPages,
    });
  } catch (e: unknown) {
    if (requestId !== activeRequestId) return;
    if (events.value.length === 0) {
      error.value = e instanceof Error ? e.message : 'Unknown error';
    }
  } finally {
    if (requestId === activeRequestId) {
      loading.value = false;
    }
  }
}

export function useGrindUpcomingEvents() {
  return {
    loading,
    error,
    events,
    pagesFetched,
    refresh: loadGrindUpcomingEvents,
  };
}
