// Shared Vercel serverless proxy: forwards /api/* to PROXY_TARGET (your Node/MySQL backend).

export const config = { runtime: 'nodejs' as const };

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

export default async function nodeHandler(req: any, res: any) {
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

const HOP_BY_HOP_HEADERS_FETCH = HOP_BY_HOP_HEADERS;

function filterHopByHopHeadersFetch(headers: Headers): Headers {
  const next = new Headers(headers);
  for (const h of HOP_BY_HOP_HEADERS_FETCH) next.delete(h);
  return next;
}

async function proxyFetch(request: Request): Promise<Response> {
  const targetBase = process.env.PROXY_TARGET?.trim();
  if (!targetBase) {
    return new Response(JSON.stringify({ error: 'Missing PROXY_TARGET env var' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }

  const method = (request.method || 'GET').toUpperCase();
  const url = new URL(request.url);
  const pathname = normalizeUpstreamPath(url.pathname);
  const targetUrl = `${targetBase.replace(/\/$/, '')}${pathname}${url.search}`;

  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('content-length');
  headers.delete('connection');
  if (process.env.PROXY_SECRET) headers.set('x-proxy-secret', process.env.PROXY_SECRET);

  const body = method === 'GET' || method === 'HEAD' ? undefined : await request.arrayBuffer();

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

    return new Response(await upstream.arrayBuffer(), {
      status: upstream.status,
      headers: filterHopByHopHeadersFetch(upstream.headers),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isAbort = (err as any)?.name === 'AbortError';
    return new Response(
      JSON.stringify({
        error: isAbort ? 'Upstream request timeout' : 'Upstream request failed',
        detail: msg,
        targetUrl,
        method,
      }),
      {
        status: isAbort ? 504 : 502,
        headers: { 'content-type': 'application/json' },
      }
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function GET(request: Request): Promise<Response> {
  return proxyFetch(request);
}
export async function POST(request: Request): Promise<Response> {
  return proxyFetch(request);
}
export async function PUT(request: Request): Promise<Response> {
  return proxyFetch(request);
}
export async function PATCH(request: Request): Promise<Response> {
  return proxyFetch(request);
}
export async function DELETE(request: Request): Promise<Response> {
  return proxyFetch(request);
}
export async function OPTIONS(request: Request): Promise<Response> {
  return proxyFetch(request);
}
