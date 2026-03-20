// Vercel "serverless function" handler style for Node:
// export default (req, res) => ...
// This avoids runtime/handler signature mismatches that can cause FUNCTION_INVOCATION_FAILED.
export const config = { runtime: 'nodejs' };

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
  // If frontend accidentally requests `/api/api/...`, normalize it to `/api/...`.
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

export default async function handler(req: any, res: any) {
  const started = Date.now();
  try {
    const targetBase = process.env.PROXY_TARGET?.trim();
    if (!targetBase) return sendJson(res, 500, { error: 'Missing PROXY_TARGET env var' });

    const method = String(req?.method || 'GET').toUpperCase();

    // req.url typically contains pathname + query.
    // Ensure upstream path always starts with `/api`.
    const url = new URL(req?.url || '/', 'http://localhost');
    let pathname = url.pathname || '/';
    if (!pathname.startsWith('/api')) pathname = `/api${pathname}`;
    pathname = normalizeUpstreamPath(pathname);
    const targetUrl = `${targetBase.replace(/\/$/, '')}${pathname}${url.search}`;

    // Build outgoing headers.
    const headers = new Headers();
    const incomingHeaders = req?.headers || {};
    for (const [k, v] of Object.entries(incomingHeaders)) {
      if (v === undefined) continue;
      const key = k.toLowerCase();
      if (key === 'host' || key === 'connection' || key === 'content-length') continue;
      if (Array.isArray(v)) headers.set(k, v.join(','));
      else headers.set(k, String(v));
    }
    if (process.env.PROXY_SECRET) headers.set('x-proxy-secret', process.env.PROXY_SECRET);

    // Read JSON body when needed (POST/PUT/PATCH/DELETE).
    let body: any = undefined;
    if (method !== 'GET' && method !== 'HEAD') {
      if (req.body !== undefined) {
        if (Buffer.isBuffer(req.body) || typeof req.body === 'string') body = req.body;
        else body = JSON.stringify(req.body);
      }
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

      // Forward status + headers.
      res.statusCode = upstream.status;
      for (const [k, v] of upstream.headers.entries()) {
        const key = k.toLowerCase();
        if (HOP_BY_HOP_HEADERS.has(key)) continue;
        res.setHeader(k, v);
      }

      const buf = Buffer.from(await upstream.arrayBuffer());
      res.end(buf);
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

