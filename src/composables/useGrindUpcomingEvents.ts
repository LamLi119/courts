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

/** Shared store so home prefetch and venue detail stay in sync. */
const loading = ref(false);
const error = ref<string | null>(null);
const events = ref<GrindEventRow[]>([]);
let activeRequestId = 0;

const LOCAL_CACHE_KEY = 'venue_upcoming_events_cache_v2';
const LOCAL_CACHE_TTL_MS = 1000 * 60 * 5; // 5 minutes

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

function readLocalCache(): GrindEventRow[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { ts?: number; events?: GrindEventRow[] };
    const ts = Number(parsed?.ts || 0);
    const list = Array.isArray(parsed?.events) ? parsed.events : [];
    if (!ts || Date.now() - ts > LOCAL_CACHE_TTL_MS) return [];
    return normalizeEvents(list);
  } catch {
    return [];
  }
}

function writeLocalCache(list: GrindEventRow[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify({ ts: Date.now(), events: list }));
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

async function loadGrindUpcomingEvents(): Promise<void> {
  const requestId = ++activeRequestId;
  const cached = readLocalCache();
  if (cached.length > 0) {
    events.value = cached;
    loading.value = false;
  } else {
    loading.value = true;
  }
  error.value = null;
  try {
    const pageSize = 8;
    const first = await fetchPage(1, pageSize);
    if (requestId !== activeRequestId) return;
    const firstItems = readItems(first);
    const normalizedFirst = normalizeEvents(firstItems);
    events.value = normalizedFirst;
    writeLocalCache(normalizedFirst);
    loading.value = false;

    const totalPages = Math.max(1, Number(first.meta?.pageCount || 1));
    const cappedPages = Math.min(totalPages, 20);

    let merged = [...firstItems];
    if (cappedPages > 1) {
      const rest = await Promise.all(
        Array.from({ length: cappedPages - 1 }, (_, i) => fetchPage(i + 2, pageSize)),
      );
      if (requestId !== activeRequestId) return;
      rest.forEach((p) => {
        merged = merged.concat(readItems(p));
      });
    }

    const normalizedMerged = normalizeEvents(merged);
    events.value = normalizedMerged;
    writeLocalCache(normalizedMerged);
  } catch (e: unknown) {
    if (requestId !== activeRequestId) return;
    events.value = [];
    error.value = e instanceof Error ? e.message : 'Unknown error';
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
    refresh: loadGrindUpcomingEvents,
  };
}
