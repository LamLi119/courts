type Req = any;
type Res = any;

function readBody(req: Req): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req: Req, res: Res) {
  // Same-origin on Vercel usually means no CORS preflight, but handle OPTIONS anyway.
  if (req.method === 'OPTIONS') return res.status(204).end();

  const targetBase = process.env.PROXY_TARGET?.trim();
  if (!targetBase) return res.status(500).json({ error: 'Missing PROXY_TARGET env var' });

  const targetUrl = targetBase.replace(/\/$/, '') + (req.url || '/');

  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (!v) continue;
    const key = k.toLowerCase();
    if (key === 'host' || key === 'connection' || key === 'content-length') continue;
    headers[k] = Array.isArray(v) ? v.join(',') : String(v);
  }
  const secret = process.env.PROXY_SECRET;
  if (secret) headers['x-proxy-secret'] = secret;

  const method = (req.method || 'GET').toUpperCase();
  const bodyBuf = method === 'GET' || method === 'HEAD' ? undefined : await readBody(req);
  const body = bodyBuf ? new Uint8Array(bodyBuf) : undefined;

  const upstream = await fetch(targetUrl, {
    method,
    headers,
    body,
    redirect: 'manual',
  });

  res.status(upstream.status);
  upstream.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (k === 'transfer-encoding' || k === 'connection') return;
    res.setHeader(key, value);
  });

  const buf = Buffer.from(await upstream.arrayBuffer());
  return res.send(buf);
}

