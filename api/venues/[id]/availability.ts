import { buildN8nWebhookUrl, normalizeAvailabilityPayload } from '../../../lib/availability/normalizeAvailability.js';

function sendJson(res: any, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'public, max-age=120');
  res.end(JSON.stringify(payload));
}

function isMultiDayBody(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;
  const raw = body as Record<string, unknown>;
  return Array.isArray(raw.days) && raw.days.length > 0;
}

export default async function handler(req: any, res: any) {
  const method = String(req?.method || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') {
    res.statusCode = 405;
    res.setHeader('allow', 'GET, HEAD');
    return res.end();
  }

  const url = new URL(req?.url || '/', 'http://localhost');
  const parts = url.pathname.split('/').filter(Boolean);
  const idPart = parts[parts.length - 2];
  const venueId = parseInt(idPart || '', 10);
  const date = (url.searchParams.get('date') || '').trim();
  const daysRaw = parseInt(url.searchParams.get('days') || '1', 10);
  const days = Number.isFinite(daysRaw) && daysRaw > 0 ? Math.min(daysRaw, 14) : 1;

  if (!Number.isFinite(venueId) || venueId < 1) {
    return sendJson(res, 400, { error: 'Invalid venue id', supported: false });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return sendJson(res, 400, { error: 'Invalid date; use YYYY-MM-DD', supported: false });
  }

  const webhookBase = process.env.N8N_AVAILABILITY_WEBHOOK_URL?.trim();
  if (!webhookBase) {
    return sendJson(res, 503, {
      error: 'N8N_AVAILABILITY_WEBHOOK_URL is not configured on Vercel',
      supported: false,
      date,
      courts: [],
    });
  }

  const secret = process.env.N8N_WEBHOOK_SECRET?.trim() || '';
  const targetUrl = buildN8nWebhookUrl(webhookBase, venueId, date, secret, days);
  const timeoutMs = days > 1 ? 60000 : 25000;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const upstream = await fetch(targetUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });
    clearTimeout(timer);

    const text = await upstream.text();
    let body: unknown = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { error: 'Invalid JSON from n8n', raw: text.slice(0, 200) };
    }

    if (!upstream.ok) {
      return sendJson(res, upstream.status >= 400 ? upstream.status : 502, {
        ...(typeof body === 'object' && body ? body : {}),
        supported: false,
        date,
        courts: [],
        error:
          (body as { error?: string })?.error ||
          (body as { message?: string })?.message ||
          `n8n returned ${upstream.status}`,
      });
    }

    if (days > 1 || isMultiDayBody(body)) {
      return sendJson(res, 200, body);
    }

    const normalized = normalizeAvailabilityPayload(body, date);
    return sendJson(res, 200, normalized);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'n8n request failed';
    return sendJson(res, 502, { error: msg, supported: false, date, courts: [] });
  }
}
