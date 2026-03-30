import fs from 'fs';
import path from 'path';
import { buildVenueOgMeta, injectVenueOgIntoHtml } from '../lib/venueOgMeta.js';

function sendJson(res: any, status: number, payload: any) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(payload));
}

function readIndexHtml(): string {
  const candidates = [
    path.join(process.cwd(), 'dist', 'index.html'),
    path.join(process.cwd(), 'index.html'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
  }
  throw new Error('index.html not found (expected dist/index.html after build)');
}

export default async function handler(req: any, res: any) {
  const method = String(req?.method || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') {
    res.statusCode = 405;
    res.setHeader('allow', 'GET, HEAD');
    return res.end();
  }

  const url = new URL(req?.url || '/', 'http://localhost');
  const rawSlug = (url.searchParams.get('slug') || '').trim();
  const slug = rawSlug.replace(/^\/+|\/+$/g, '').split('/')[0];
  if (!slug) return sendJson(res, 400, { error: 'slug required' });
  // Header values must be ASCII-safe in Node; keep a percent-encoded version for debugging.
  const safeSlugHeader = encodeURIComponent(slug);
  let decodedSlug = slug;
  try {
    decodedSlug = decodeURIComponent(slug);
  } catch {
    decodedSlug = slug;
  }

  const targetBase = process.env.PROXY_TARGET?.trim();
  if (!targetBase) return sendJson(res, 500, { error: 'Missing PROXY_TARGET env var' });

  const upstreamUrl = `${targetBase.replace(/\/$/, '')}/api/venues/slug/${encodeURIComponent(decodedSlug)}`;
  const headers: Record<string, string> = {};
  if (process.env.PROXY_SECRET) headers['x-proxy-secret'] = process.env.PROXY_SECRET;

  let venue: any;
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 12000);
    const r = await fetch(upstreamUrl, { headers, signal: ac.signal }).finally(() => clearTimeout(timer));
    if (r.status === 404) {
      let html: string;
      try {
        html = readIndexHtml();
      } catch (e: any) {
        return sendJson(res, 500, { error: e?.message || 'index.html missing' });
      }
      res.statusCode = 200;
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.setHeader('x-og-handler', 'html-venue');
      res.setHeader('x-og-slug', safeSlugHeader);
      if (method === 'HEAD') return res.end();
      return res.end(html);
    }
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      return sendJson(res, 502, { error: 'Upstream venue fetch failed', status: r.status, detail: t.slice(0, 200) });
    }
    venue = await r.json();
  } catch (err: any) {
    return sendJson(res, 502, { error: err?.message || 'Upstream request failed' });
  }

  const xfProto = (req.headers['x-forwarded-proto'] || '').toString().split(',')[0].trim();
  const xfHost = (req.headers['x-forwarded-host'] || '').toString().split(',')[0].trim();
  const host = xfHost || req.headers.host || '';
  const proto = xfProto || 'https';
  const origin = host ? `${proto}://${host}` : '';

  const normalizedSlug = decodedSlug.replace(/^\/+/, '');
  const pagePath = `/venues/${normalizedSlug}`;
  const pageUrl = origin ? `${origin.replace(/\/$/, '')}${pagePath}` : pagePath;

  const meta = buildVenueOgMeta(venue, { pageUrl, origin: origin || 'https://courts.theground.io', lang: 'en' });
  let html: string;
  try {
    html = readIndexHtml();
  } catch (e: any) {
    return sendJson(res, 500, { error: e?.message || 'index.html missing' });
  }
  const out = injectVenueOgIntoHtml(html, meta);

  res.statusCode = 200;
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.setHeader('x-og-handler', 'html-venue');
  res.setHeader('x-og-slug', safeSlugHeader);
  res.setHeader('cache-control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400');
  if (method === 'HEAD') return res.end();
  res.end(out);
}
