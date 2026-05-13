import type { Language } from '../../types';
import { encryptGrindEventId } from './grindEventId';

export type GrindEventRow = {
  id: number;
  name: string;
  companyName?: string;
  company?: { id?: number; name?: string };
  startDate: string;
  endDate: string;
  location: string;
  joinCount: number;
  isDisplayHeadCount: boolean;
  profile?: { filePath?: string | null } | null;
};

function sameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
  );
}

/** One line like "Tue, May 12 • 7:15 PM – 8:45 PM" (en) or zh-HK equivalents. */
export function formatGrindEventCardLine(
  startIso: string,
  endIso: string,
  language: Language,
): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const locale = language === 'zh' ? 'zh-HK' : 'en-US';
  const dow = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  const md = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' });
  const time = new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const startPart = `${dow.format(start)}, ${md.format(start)} • ${time.format(start)}`;
  if (sameCalendarDay(start, end)) {
    return `${startPart} – ${time.format(end)}`;
  }
  return `${startPart} – ${dow.format(end)}, ${md.format(end)} • ${time.format(end)}`;
}

export function grindAppOrigin(): string {
  const raw = (import.meta.env.VITE_THE_GRIND_APP_URL ?? 'https://theground.io')
    .toString()
    .trim()
    .replace(/\/$/, '');
  return raw || 'https://theground.io';
}

export function grindPublicEventUrl(eventNumericId: number): string {
  const enc = encryptGrindEventId(eventNumericId);
  return `${grindAppOrigin()}/events/public/${encodeURIComponent(enc)}`;
}

export function grindExploreEventsUrl(): string {
  return `${grindAppOrigin()}/explore/events`;
}

export function eventImageSrc(filePath: string | null | undefined): string {
  if (!filePath || !String(filePath).trim()) return '/placeholder.svg';
  const s = String(filePath).trim();
  if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('data:')) return s;
  const base = grindAppOrigin();
  return s.startsWith('/') ? `${base}${s}` : `${base}/${s}`;
}
