export const runtime = 'nodejs';

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

function filterHopByHopHeaders(headers: Headers): Headers {
  const next = new Headers(headers);
  for (const h of HOP_BY_HOP_HEADERS) next.delete(h);
  return next;
}

async function proxy(request: Request): Promise<Response> {
  const targetBase = process.env.PROXY_TARGET?.trim();
  if (!targetBase) {
    return new Response(
      JSON.stringify({ error: 'Missing PROXY_TARGET env var' }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }

  const method = (request.method || 'GET').toUpperCase();
  const url = new URL(request.url);
  const pathname = normalizeUpstreamPath(url.pathname);
  const targetUrl = `${targetBase.replace(/\/$/, '')}${pathname}${url.search}`;

  // Copy headers, but remove hop-by-hop and fields that should be recalculated.
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('content-length');
  headers.delete('connection');
  if (process.env.PROXY_SECRET) headers.set('x-proxy-secret', process.env.PROXY_SECRET);

  // IMPORTANT: read body fully to avoid stream/duplex issues in Node fetch.
  const body =
    method === 'GET' || method === 'HEAD' ? undefined : Buffer.from(await request.arrayBuffer());

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

    const respHeaders = filterHopByHopHeaders(upstream.headers);
    return new Response(await upstream.arrayBuffer(), {
      status: upstream.status,
      headers: respHeaders,
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
  return proxy(request);
}
export async function POST(request: Request): Promise<Response> {
  return proxy(request);
}
export async function PUT(request: Request): Promise<Response> {
  return proxy(request);
}
export async function PATCH(request: Request): Promise<Response> {
  return proxy(request);
}
export async function DELETE(request: Request): Promise<Response> {
  return proxy(request);
}
export async function OPTIONS(request: Request): Promise<Response> {
  return proxy(request);
}

export default proxy;

