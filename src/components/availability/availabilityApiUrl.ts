import { courtApiUrl } from '../../utils/courtApiUrl';

/**
 * Production (Vercel): same-origin `/api/venues/:id/availability` → server calls n8n.
 * Local dev only: set VITE_N8N_AVAILABILITY_WEBHOOK_URL to call n8n directly.
 * Do not set VITE_N8N_* on Vercel — HTTPS pages cannot call HTTP n8n from the browser.
 */
export function buildAvailabilityFetchUrl(
  venueId: number,
  startDate: string,
  days = 7,
): string {
  const n8nDirect = (import.meta.env.VITE_N8N_AVAILABILITY_WEBHOOK_URL ?? '').trim();
  if (n8nDirect && import.meta.env.DEV) {
    const u = new URL(n8nDirect);
    u.searchParams.set('venueId', String(venueId));
    u.searchParams.set('date', startDate);
    u.searchParams.set('days', String(days));
    const secret = (import.meta.env.VITE_N8N_WEBHOOK_SECRET ?? '').trim();
    if (secret) u.searchParams.set('secret', secret);
    return u.toString();
  }
  const qs = new URLSearchParams({
    date: startDate,
    days: String(days),
  });
  return courtApiUrl(`/api/venues/${venueId}/availability?${qs.toString()}`);
}
