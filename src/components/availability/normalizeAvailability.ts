import type { AvailabilityCourt, VenueAvailabilityResponse } from './types';

const HK_TZ = 'Asia/Hong_Kong';

export function toDateDash(date: unknown): string | null {
  if (date == null || date === '') return null;
  const s = String(date).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  return null;
}

function formatSlotTimeHm(isoString: string): string {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return isoString;
  return d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: HK_TZ,
  });
}

function unwrapN8nItem(item: unknown): Record<string, unknown> | null {
  if (!item || typeof item !== 'object') return null;
  const row = item as Record<string, unknown>;
  if (row.json && typeof row.json === 'object') {
    return row.json as Record<string, unknown>;
  }
  return row;
}

function courtsFromDay(day: Record<string, unknown>): unknown[] | null {
  const courts = day.courts ?? day.courts_with_reservations;
  return Array.isArray(courts) ? courts : null;
}

function dateFromDay(day: Record<string, unknown>): string | null {
  return toDateDash(day.date ?? day.date_dash ?? day.dateDash);
}

function normalizeCourts(courts: unknown[]): AvailabilityCourt[] {
  return courts.map((c: any) => ({
    courtId: Number(c.courtId ?? c.court_id),
    courtName: String(c.courtName ?? c.court_name ?? ''),
    slots: (c.slots || c.available_hours || []).map((h: any) => ({
      start: typeof h.start === 'string' && h.start.includes('T') ? formatSlotTimeHm(h.start) : String(h.start ?? ''),
      end: typeof h.end === 'string' && h.end.includes('T') ? formatSlotTimeHm(h.end) : String(h.end ?? ''),
      startIso: h.startIso ?? h.start,
      endIso: h.endIso ?? h.end,
    })),
  }));
}

/** Same court_id repeated per day (no dates on slots) — keep the first row for a single-day response. */
function collapseRepeatedCourtsForSingleDay(courts: AvailabilityCourt[]): AvailabilityCourt[] {
  if (courts.length <= 1) return courts;
  const ids = new Set(courts.map((c) => c.courtId));
  if (ids.size !== 1) return courts;
  return [courts[0]];
}

function looksLikeDayList(items: unknown[]): boolean {
  return items.some((item) => {
    const day = unwrapN8nItem(item);
    if (!day) return false;
    return !!dateFromDay(day) && !!courtsFromDay(day);
  });
}

function looksLikeCourtEntry(row: Record<string, unknown>): boolean {
  const hasCourtId = row.courtId != null || row.court_id != null;
  const hours = row.slots ?? row.available_hours;
  return hasCourtId && Array.isArray(hours);
}

function looksLikeCourtList(items: unknown[]): boolean {
  return items.some((item) => {
    const row = unwrapN8nItem(item);
    return !!row && looksLikeCourtEntry(row);
  });
}

function addDaysDash(dateDash: string, offset: number): string {
  const d = new Date(`${dateDash}T12:00:00+08:00`);
  d.setDate(d.getDate() + offset);
  return new Intl.DateTimeFormat('en-CA', { timeZone: HK_TZ }).format(d);
}

/** Flat court rows repeated per day (no date on items) → one map entry per calendar day. */
function expandSequentialCourtsAsDays(
  body: unknown,
  startDateDash: string,
  dayCount: number,
): Record<string, VenueAvailabilityResponse> | null {
  if (dayCount < 2) return null;

  let list: unknown[] | null = null;
  if (Array.isArray(body) && looksLikeCourtList(body)) {
    list = body;
  } else if (body && typeof body === 'object') {
    const raw = body as Record<string, unknown>;
    const courts = raw.courts ?? raw.courts_with_reservations;
    if (Array.isArray(courts) && looksLikeCourtList(courts) && !looksLikeDayList(courts)) {
      list = courts;
    }
  }
  if (!list || list.length < dayCount) return null;
  if (list.length % dayCount !== 0) return null;

  const courts = normalizeCourts(list);
  const courtsPerDay = courts.length / dayCount;
  const raw = body && typeof body === 'object' && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};
  const provider = raw.provider ? String(raw.provider) : undefined;
  const out: Record<string, VenueAvailabilityResponse> = {};

  for (let d = 0; d < dayCount; d += 1) {
    const date = addDaysDash(startDateDash, d);
    out[date] = {
      supported: true,
      date,
      timezone: HK_TZ,
      provider,
      courts: courts.slice(d * courtsPerDay, (d + 1) * courtsPerDay),
    };
  }

  return out;
}

function findNestedDayList(body: Record<string, unknown>): unknown[] | null {
  for (const val of Object.values(body)) {
    if (!Array.isArray(val) || val.length === 0) continue;
    if (looksLikeDayList(val)) return val;
  }
  return null;
}

function dayListFromBody(body: unknown): unknown[] | null {
  if (!body || typeof body !== 'object') return null;

  if (Array.isArray(body)) {
    if (looksLikeDayList(body)) return body;
    return null;
  }

  const raw = body as Record<string, unknown>;
  const candidates = [raw.days, raw.data, raw.items, raw.results, raw.output, raw.merged];
  for (const list of candidates) {
    if (Array.isArray(list) && list.length > 0 && looksLikeDayList(list)) return list;
  }

  return findNestedDayList(raw);
}

function dayToResponse(
  day: Record<string, unknown>,
  provider?: string,
): VenueAvailabilityResponse | null {
  const dash = dateFromDay(day);
  const courts = courtsFromDay(day);
  if (!dash || !courts) return null;
  return {
    supported: true,
    date: dash,
    timezone: HK_TZ,
    provider: provider ?? (day.provider ? String(day.provider) : undefined),
    courts: normalizeCourts(courts),
  };
}

/** Expand n8n multi-day payload into YYYY-MM-DD → response map. */
export function expandAvailabilityDays(body: unknown): Record<string, VenueAvailabilityResponse> | null {
  const dayList = dayListFromBody(body);
  if (!dayList) return null;

  const raw = body && typeof body === 'object' && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};
  const provider = raw.provider ? String(raw.provider) : undefined;
  const out: Record<string, VenueAvailabilityResponse> = {};

  for (const item of dayList) {
    const day = unwrapN8nItem(item);
    if (!day) continue;
    const parsed = dayToResponse(day, provider);
    if (parsed) out[parsed.date] = parsed;
  }

  return Object.keys(out).length > 0 ? out : null;
}

/** Merge one API response into the days map (handles single-day or multi-day shapes). */
export function ingestAvailabilityBody(
  target: Record<string, VenueAvailabilityResponse>,
  body: unknown,
  fallbackDateDash: string,
  dayCount = 1,
): void {
  const expanded = expandAvailabilityDays(body);
  if (expanded) {
    Object.assign(target, expanded);
    return;
  }
  const sequential = expandSequentialCourtsAsDays(body, fallbackDateDash, dayCount);
  if (sequential) {
    Object.assign(target, sequential);
    return;
  }
  target[fallbackDateDash] = normalizeAvailabilityPayload(body, fallbackDateDash);
}

export function normalizeAvailabilityPayload(
  body: unknown,
  requestedDateDash: string,
): VenueAvailabilityResponse {
  if (!body || typeof body !== 'object') {
    return { supported: false, date: requestedDateDash, courts: [] };
  }

  const raw = body as Record<string, unknown>;

  if (raw.supported === false) {
    return {
      supported: false,
      date: requestedDateDash,
      courts: [],
      error: typeof raw.error === 'string' ? raw.error : undefined,
    };
  }

  const expanded = expandAvailabilityDays(body);
  if (expanded?.[requestedDateDash]) {
    return expanded[requestedDateDash];
  }

  if (Array.isArray(body) && looksLikeCourtList(body)) {
    return {
      supported: true,
      date: requestedDateDash,
      timezone: HK_TZ,
      courts: collapseRepeatedCourtsForSingleDay(normalizeCourts(body)),
    };
  }

  if (Array.isArray(raw.courts) || Array.isArray(raw.courts_with_reservations)) {
    const courts = courtsFromDay(raw);
    return {
      supported: raw.supported !== false,
      date: String(raw.date || raw.date_dash || requestedDateDash),
      timezone: HK_TZ,
      provider: raw.provider ? String(raw.provider) : undefined,
      courts: collapseRepeatedCourtsForSingleDay(normalizeCourts(courts ?? [])),
    };
  }

  const unwrapped = unwrapN8nItem(body);
  if (unwrapped && unwrapped !== raw) {
    const single = dayToResponse(unwrapped, raw.provider ? String(raw.provider) : undefined);
    if (single) return single;
  }

  return {
    supported: false,
    date: requestedDateDash,
    courts: [],
    error: 'Unexpected response shape',
  };
}
