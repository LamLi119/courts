// Shared Vercel proxy → PROXY_TARGET. Matches api/venues.ts style (Record headers, no config export).

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

function normalizeUpstreamPath(pathname: string): string {
  if (pathname === '/api/api') return '/api';
  if (pathname.startsWith('/api/api/')) return pathname.replace(/^\/api\/api/, '/api');
  return pathname;
}

function sendJson(res: any, status: number, payload: any) {
  try {
    if (typeof res.status === 'function' && typeof res.json === 'function') {
      res.status(status).json(payload);
      return;
    }
  } catch {
    // ignore
  }
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(payload));
}

export default async function proxyToBackend(req: any, res: any) {
  const started = Date.now();
  try {
    const targetBase = process.env.PROXY_TARGET?.trim();
    if (!targetBase) return sendJson(res, 500, { error: 'Missing PROXY_TARGET env var' });

    const method = String(req?.method || 'GET').toUpperCase();
    const url = new URL(req?.url || '/', 'http://localhost');
    let pathname = url.pathname || '/';
    if (!pathname.startsWith('/api')) pathname = `/api${pathname}`;
    pathname = normalizeUpstreamPath(pathname);
    const targetUrl = `${targetBase.replace(/\/$/, '')}${pathname}${url.search}`;

    const headers: Record<string, string> = {};
    const incomingHeaders = req?.headers || {};
    for (const [k, v] of Object.entries(incomingHeaders)) {
      if (v === undefined) continue;
      const lk = k.toLowerCase();
      if (lk === 'host' || lk === 'connection' || lk === 'content-length') continue;
      headers[k] = Array.isArray(v) ? v.join(',') : String(v);
    }
    if (process.env.PROXY_SECRET) headers['x-proxy-secret'] = process.env.PROXY_SECRET;

    let body: any = undefined;
    if (method !== 'GET' && method !== 'HEAD' && req.body !== undefined) {
      if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) body = req.body;
      else body = JSON.stringify(req.body);
    }

    const controller = new AbortController();
    const timeoutMs = 12000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const upstream = await fetch(targetUrl, {
        method,
        headers,
        body,
        redirect: 'manual',
        signal: controller.signal,
      });

      res.statusCode = upstream.status;
      upstream.headers.forEach((value, key) => {
        const lk = key.toLowerCase();
        if (HOP_BY_HOP_HEADERS.has(lk)) return;
        res.setHeader(key, value);
      });

      const buf = Buffer.from(await upstream.arrayBuffer());
      res.end(buf);
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : String(err);
      const isAbort = err?.name === 'AbortError';
      sendJson(res, isAbort ? 504 : 502, {
        error: isAbort ? 'Upstream request timeout' : 'Upstream request failed',
        detail: msg,
        targetUrl,
        method,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return sendJson(res, 500, {
      error: 'Proxy crashed',
      detail: msg,
      durationMs: Date.now() - started,
    });
  }
}
