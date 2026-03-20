export const runtime = 'edge';

async function proxy(request: Request): Promise<Response> {
  const targetBase = process.env.PROXY_TARGET?.trim();
  if (!targetBase) {
    return new Response(JSON.stringify({ error: 'Missing PROXY_TARGET env var' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }

  const method = (request.method || 'GET').toUpperCase();
  const url = new URL(request.url);
  const targetUrl = targetBase.replace(/\/$/, '') + url.pathname + url.search;

  const headers = new Headers(request.headers);
  // Let the upstream host header and content-length be recalculated by fetch.
  headers.delete('host');
  headers.delete('connection');
  headers.delete('content-length');

  const secret = process.env.PROXY_SECRET;
  if (secret) headers.set('x-proxy-secret', secret);

  const body = method === 'GET' || method === 'HEAD' ? undefined : request.body;

  const upstream = await fetch(targetUrl, {
    method,
    headers,
    body,
    redirect: 'manual',
  });

  const respHeaders = new Headers(upstream.headers);
  // Avoid hop-by-hop headers that might break edge responses.
  respHeaders.delete('transfer-encoding');
  respHeaders.delete('connection');

  return new Response(await upstream.arrayBuffer(), {
    status: upstream.status,
    headers: respHeaders,
  });
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

// Fallback: in case Vercel routes to the default export instead of method exports.
export default proxy;

