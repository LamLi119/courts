function sendJson(res: any, status: number, payload: any) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(payload));
}

function isSupportedProtocol(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export default async function handler(req: any, res: any) {
  const method = String(req?.method || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') {
    res.statusCode = 405;
    res.setHeader('allow', 'GET, HEAD');
    return res.end();
  }

  const url = new URL(req?.url || '/', 'http://localhost');
  const target = (url.searchParams.get('url') || '').trim();
  if (!target) return sendJson(res, 400, { error: 'url query is required' });
  if (!isSupportedProtocol(target)) return sendJson(res, 400, { error: 'Only http/https URLs are allowed' });

  try {
    const targetUrl = new URL(target);
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 12000);
    const upstream = await fetch(targetUrl.toString(), {
      method: 'GET',
      redirect: 'follow',
      headers: {
        accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        // Some hosts reject requests without browser-like headers.
        'user-agent': 'Mozilla/5.0 (compatible; CourtsFinderBot/1.0; +https://vercel.com)',
        referer: `${targetUrl.origin}/`
      },
      signal: ac.signal
    }).finally(() => clearTimeout(timer));

    if (!upstream.ok) {
      return sendJson(res, 502, { error: 'Image fetch failed', status: upstream.status });
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const cacheControl = upstream.headers.get('cache-control') || 'public, max-age=86400';

    res.statusCode = 200;
    res.setHeader('content-type', contentType);
    res.setHeader('cache-control', cacheControl);
    res.setHeader('access-control-allow-origin', '*');

    if (method === 'HEAD') return res.end();

    const arr = await upstream.arrayBuffer();
    res.end(Buffer.from(arr));
  } catch (err: any) {
    return sendJson(res, 502, { error: err?.message || 'Image proxy request failed' });
  }
}
