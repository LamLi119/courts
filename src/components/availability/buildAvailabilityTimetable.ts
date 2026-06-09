import type { OperatingDayKey, OperatingHours } from '../../../types';
import type { AvailabilityCourt, AvailabilitySlot } from './types';

export const HK_TZ = 'Asia/Hong_Kong';
export const SLOT_MINUTES = 60;
/** Minutes from midnight; 1440 = end of calendar day (exclusive upper bound for buckets). */
export const MINUTES_PER_DAY = 24 * 60;
const DEFAULT_GRID_START = 7 * 60;
const DEFAULT_GRID_END = 23 * 60;

export type TimetableCellStatus = 'available' | 'unavailable';

export type TimetableCell = {
  status: TimetableCellStatus;
};

export type TimetableRow = {
  courtId: number;
  courtName: string;
  cells: TimetableCell[];
};

export type AvailabilityTimetable = {
  timeLabels: string[];
  rows: TimetableRow[];
  dayClosed: boolean;
};

const WEEKDAY_KEYS: OperatingDayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export function todayDashHk(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: HK_TZ }).format(now);
}

export function nowMinutesHk(now = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: HK_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}

export function dayKeyFromDateDash(dateDash: string): OperatingDayKey {
  const d = new Date(`${dateDash}T12:00:00+08:00`);
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: HK_TZ, weekday: 'short' }).format(d);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const idx = map[wd] ?? 0;
  return WEEKDAY_KEYS[idx];
}

export function parseHm(hm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hm ?? '').trim());
  if (!m) return NaN;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function minutesToHm(minutes: number): string {
  const clamped = Math.min(Math.max(0, minutes), MINUTES_PER_DAY - 1);
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Same-calendar-day range; extends past midnight (e.g. 23:00–00:00 → [1380, 1440]). */
export function normalizeHmRange(start: number, end: number): [number, number] | null {
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  let endNorm = end;
  if (endNorm <= start) endNorm += MINUTES_PER_DAY;
  if (endNorm > MINUTES_PER_DAY) endNorm = MINUTES_PER_DAY;
  if (endNorm <= start) return null;
  return [start, endNorm];
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function isoToDateDashHk(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', { timeZone: HK_TZ }).format(d);
}

function isoToMinutesHk(iso: string): number {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return NaN;
  const hm = d.toLocaleTimeString('en-GB', {
    timeZone: HK_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return parseHm(hm);
}

function slotIsoStart(slot: AvailabilitySlot): string | null {
  if (slot.startIso) return String(slot.startIso);
  const start = String(slot.start ?? '');
  return start.includes('T') ? start : null;
}

/** Keep slot when it has no calendar date, or when its HK date matches the selected day. */
export function slotBelongsToDate(slot: AvailabilitySlot, dateDash: string): boolean {
  const iso = slotIsoStart(slot);
  if (!iso) return true;
  const slotDate = isoToDateDashHk(iso);
  if (!slotDate) return true;
  return slotDate === dateDash;
}

function filterCourtsByDate(courts: AvailabilityCourt[], dateDash: string): AvailabilityCourt[] {
  return courts.map((court) => ({
    ...court,
    slots: court.slots.filter((slot) => slotBelongsToDate(slot, dateDash)),
  }));
}

function mergeCourtsById(courts: AvailabilityCourt[]): AvailabilityCourt[] {
  const byId = new Map<number, AvailabilityCourt>();
  for (const court of courts) {
    const existing = byId.get(court.courtId);
    if (!existing) {
      byId.set(court.courtId, { ...court, slots: [...court.slots] });
      continue;
    }
    existing.slots.push(...court.slots);
    if (!existing.courtName && court.courtName) existing.courtName = court.courtName;
  }
  return Array.from(byId.values());
}

function courtsForSelectedDay(courts: AvailabilityCourt[], dateDash: string): AvailabilityCourt[] {
  return mergeCourtsById(filterCourtsByDate(courts, dateDash));
}

function slotRangeMinutes(slot: AvailabilitySlot): [number, number] | null {
  let start = parseHm(slot.start);
  let end = parseHm(slot.end);
  if (Number.isFinite(start) && Number.isFinite(end)) {
    const fromDisplay = normalizeHmRange(start, end);
    if (fromDisplay) return fromDisplay;
  }

  if (slot.startIso) {
    const startIso = String(slot.startIso);
    const endIso = String(slot.endIso ?? slot.startIso);
    start = isoToMinutesHk(startIso);
    end = isoToMinutesHk(endIso);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
    return normalizeHmRange(start, end);
  }

  return null;
}

function isBucketAvailable(courtSlots: AvailabilitySlot[], bucketStart: number, bucketEnd: number): boolean {
  return courtSlots.some((slot) => {
    const range = slotRangeMinutes(slot);
    if (!range) return false;
    return overlaps(range[0], range[1], bucketStart, bucketEnd);
  });
}

function boundsFromOperatingHours(
  operatingHours: OperatingHours | null | undefined,
  dateDash: string,
): { startMin: number; endMin: number; closed: boolean } | null {
  if (!operatingHours?.weekly) return null;
  const dayKey = dayKeyFromDateDash(dateDash);
  const day = operatingHours.weekly[dayKey];
  if (!day || day.closed) {
    return { startMin: 0, endMin: 0, closed: true };
  }
  const ranges = (day.slots || [])
    .map(([a, b]) => normalizeHmRange(parseHm(a), parseHm(b)))
    .filter((r): r is [number, number] => r != null);
  if (ranges.length === 0) return null;
  const startMin = Math.min(...ranges.map((r) => r[0]));
  const endMin = Math.max(...ranges.map((r) => r[1]));
  return { startMin, endMin, closed: false };
}

function boundsFromCourts(courts: AvailabilityCourt[]): { startMin: number; endMin: number } | null {
  let startMin = Infinity;
  let endMin = -Infinity;
  for (const court of courts) {
    for (const slot of court.slots) {
      const range = slotRangeMinutes(slot);
      if (!range) continue;
      startMin = Math.min(startMin, range[0]);
      endMin = Math.max(endMin, range[1]);
    }
  }
  if (!Number.isFinite(startMin) || !Number.isFinite(endMin) || endMin <= startMin) {
    return null;
  }
  return { startMin, endMin };
}

function buildTimeLabels(gridStart: number, gridEnd: number): string[] {
  const labels: string[] = [];
  const start = Math.floor(gridStart / SLOT_MINUTES) * SLOT_MINUTES;
  const end = Math.min(
    Math.ceil(gridEnd / SLOT_MINUTES) * SLOT_MINUTES,
    MINUTES_PER_DAY,
  );
  for (let t = start; t < end; t += SLOT_MINUTES) {
    labels.push(minutesToHm(t));
  }
  return labels;
}

/** On today (HK), drop columns whose hour bucket has already ended. */
function hidePastTimeLabels(labels: string[], isToday: boolean, nowMin: number): string[] {
  if (!isToday) return labels;
  return labels.filter((label) => {
    const bucketStart = parseHm(label);
    const bucketEnd = Math.min(bucketStart + SLOT_MINUTES, MINUTES_PER_DAY);
    return bucketEnd > nowMin;
  });
}

function bucketStatus(
  courtSlots: AvailabilitySlot[],
  bucketStart: number,
  bucketEnd: number,
): TimetableCellStatus {
  if (isBucketAvailable(courtSlots, bucketStart, bucketEnd)) return 'available';
  return 'unavailable';
}

export function buildAvailabilityTimetable(
  courts: AvailabilityCourt[],
  dateDash: string,
  operatingHours?: OperatingHours | null,
  now = new Date(),
): AvailabilityTimetable {
  const empty: AvailabilityTimetable = { timeLabels: [], rows: [], dayClosed: false };

  if (!courts.length) return empty;

  const courtsForDay = courtsForSelectedDay(courts, dateDash);
  if (!courtsForDay.length) return empty;

  const ohBounds = boundsFromOperatingHours(operatingHours, dateDash);
  if (ohBounds?.closed) {
    return { ...empty, dayClosed: true };
  }

  const slotBounds = boundsFromCourts(courtsForDay);
  let gridStart: number;
  let gridEnd: number;

  if (ohBounds && !ohBounds.closed) {
    gridStart = ohBounds.startMin;
    gridEnd = ohBounds.endMin;
  } else if (slotBounds) {
    gridStart = slotBounds.startMin;
    gridEnd = slotBounds.endMin;
  } else {
    gridStart = DEFAULT_GRID_START;
    gridEnd = DEFAULT_GRID_END;
  }

  const isToday = dateDash === todayDashHk(now);
  const nowMin = nowMinutesHk(now);
  const timeLabels = hidePastTimeLabels(buildTimeLabels(gridStart, gridEnd), isToday, nowMin);
  if (!timeLabels.length) return empty;

  const rows: TimetableRow[] = courtsForDay.map((court) => ({
    courtId: court.courtId,
    courtName: court.courtName,
    cells: timeLabels.map((label) => {
      const bucketStart = parseHm(label);
      const bucketEnd = Math.min(bucketStart + SLOT_MINUTES, MINUTES_PER_DAY);
      return {
        status: bucketStatus(court.slots, bucketStart, bucketEnd),
      };
    }),
  }));

  return { timeLabels, rows, dayClosed: false };
}
