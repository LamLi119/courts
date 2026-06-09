import { courtApiUrl } from '../../utils/courtApiUrl';

/**
 * Prefer same-origin /api proxy (Vercel). For local dev without that route on Express,
 * set VITE_N8N_AVAILABILITY_WEBHOOK_URL to your n8n Production Webhook URL.
 */
export function buildAvailabilityFetchUrl(
  venueId: number,
  startDate: string,
  days = 7,
): string {
  const n8nDirect = (import.meta.env.VITE_N8N_AVAILABILITY_WEBHOOK_URL ?? '').trim();
  if (n8nDirect) {
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
