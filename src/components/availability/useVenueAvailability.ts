import { computed, ref, watch, type Ref } from 'vue';
import { buildAvailabilityFetchUrl } from './availabilityApiUrl';
import { ingestAvailabilityBody } from './normalizeAvailability';
import type { VenueAvailabilityResponse } from './types';

function todayDash(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function buildDateOptions(count = 7): string[] {
  const out: string[] = [];
  const cur = new Date();
  for (let i = 0; i < count; i += 1) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const day = String(cur.getDate()).padStart(2, '0');
    out.push(`${y}-${m}-${day}`);
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

type CachePayload = {
  version: 1;
  venueId: number;
  startDate: string;
  fetchedAt: number;
  daysByDate: Record<string, VenueAvailabilityResponse>;
};

const CACHE_VERSION = 4 as const;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

function isPageReload(): boolean {
  if (typeof performance === 'undefined') return false;
  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  return nav?.type === 'reload';
}

/** After F5, allow one fresh fetch per venue; SPA navigation reuses localStorage. */
function clearReloadFlagsOnReload() {
  if (!isPageReload() || typeof sessionStorage === 'undefined') return;
  const keys: string[] = [];
  for (let i = 0; i < sessionStorage.length; i += 1) {
    const key = sessionStorage.key(i);
    if (key?.startsWith('availability:reloadDone:')) keys.push(key);
  }
  keys.forEach((k) => sessionStorage.removeItem(k));
}
clearReloadFlagsOnReload();

function reloadFetchDoneKey(id: number): string {
  return `availability:reloadDone:${id}`;
}

function markReloadFetchDone(id: number) {
  try {
    sessionStorage.setItem(reloadFetchDoneKey(id), '1');
  } catch {
    // ignore
  }
}

function isReloadFetchDone(id: number): boolean {
  try {
    return sessionStorage.getItem(reloadFetchDoneKey(id)) === '1';
  } catch {
    return false;
  }
}

function cacheKey(id: number): string {
  return `availability:v${CACHE_VERSION}:venue:${id}`;
}

function loadCache(id: number, startDate: string): CachePayload | null {
  try {
    const raw = localStorage.getItem(cacheKey(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachePayload;
    if (parsed?.version !== CACHE_VERSION) return null;
    if (parsed?.venueId !== id) return null;
    if (parsed?.startDate !== startDate) return null;
    if (Date.now() - parsed.fetchedAt > CACHE_TTL_MS) return null;
    if (!parsed.daysByDate || typeof parsed.daysByDate !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveCache(id: number, startDate: string, daysByDate: Record<string, VenueAvailabilityResponse>) {
  try {
    const payload: CachePayload = {
      version: CACHE_VERSION,
      venueId: id,
      startDate,
      fetchedAt: Date.now(),
      daysByDate,
    };
    localStorage.setItem(cacheKey(id), JSON.stringify(payload));
  } catch {
    // ignore quota/serialization errors
  }
}

export function useVenueAvailability(
  venueId: Ref<number> | number,
  enabled: Ref<boolean> | boolean,
) {
  const selectedDate = ref(todayDash());
  const loading = ref(false);
  const fetchError = ref<string | null>(null);
  const dateOptions = buildDateOptions(7);
  const daysByDate = ref<Record<string, VenueAvailabilityResponse>>({});
  let requestId = 0;

  const data = computed(() => daysByDate.value[selectedDate.value] ?? null);
  const error = computed(() => fetchError.value ?? data.value?.error ?? null);

  async function fetchRangeRaw(
    id: number,
    startDate: string,
    days: number,
    rid: number,
  ): Promise<unknown> {
    const url = buildAvailabilityFetchUrl(id, startDate, days);
    const res = await fetch(url, { method: 'GET' });
    const body: unknown = await res.json().catch(() => ({}));
    if (rid !== requestId) return null;
    if (!res.ok) {
      const errMsg =
        (body as { error?: string })?.error ||
        (body as { message?: string })?.message ||
        res.statusText;
      throw new Error(errMsg || 'Request failed');
    }
    return body;
  }

  /** One request per date so each tab only ever gets that day's slots. */
  async function fetchAllDays(
    id: number,
    rid: number,
  ): Promise<Record<string, VenueAvailabilityResponse>> {
    const results = await Promise.allSettled(
      dateOptions.map((date) => fetchRangeRaw(id, date, 1, rid)),
    );
    const next: Record<string, VenueAvailabilityResponse> = {};
    for (let i = 0; i < dateOptions.length; i += 1) {
      const r = results[i];
      if (r.status === 'fulfilled' && r.value != null) {
        ingestAvailabilityBody(next, r.value, dateOptions[i], 1);
      }
    }
    return next;
  }

  async function prefetch7Days(force = false) {
    const id = typeof venueId === 'number' ? venueId : venueId.value;
    const isOn = typeof enabled === 'boolean' ? enabled : enabled.value;
    if (!isOn) {
      daysByDate.value = {};
      fetchError.value = null;
      loading.value = false;
      return;
    }

    const startDate = dateOptions[0];
    const cached = loadCache(id, startDate);
    const cachedDayCount = cached ? Object.keys(cached.daysByDate).length : 0;
    const reload = isPageReload();
    const needsFetch =
      force
      || !cached
      || cachedDayCount < dateOptions.length
      || (reload && !isReloadFetchDone(id));

    if (cached) {
      daysByDate.value = cached.daysByDate ?? {};
    }

    if (!needsFetch) {
      fetchError.value = null;
      loading.value = false;
      return;
    }

    const rid = ++requestId;
    loading.value = true;
    fetchError.value = null;
    try {
      const next = await fetchAllDays(id, rid);
      if (rid !== requestId) return;
      if (Object.keys(next).length === 0) {
        throw new Error('No availability data');
      }
      daysByDate.value = next;
      saveCache(id, startDate, next);
      if (reload) markReloadFetchDone(id);
    } catch (e: unknown) {
      if (rid !== requestId) return;
      if (!cached) daysByDate.value = {};
      fetchError.value = e instanceof Error ? e.message : 'Unknown error';
    } finally {
      if (rid === requestId) loading.value = false;
    }
  }

  const venueIdSource = typeof venueId === 'number' ? () => venueId : venueId;
  const enabledSource = typeof enabled === 'boolean' ? () => enabled : enabled;

  watch(
    [venueIdSource, enabledSource],
    () => {
      void prefetch7Days(false);
    },
    { immediate: true },
  );

  return {
    selectedDate,
    loading,
    error,
    data,
    refresh: () => prefetch7Days(true),
    dateOptions,
  };
}
