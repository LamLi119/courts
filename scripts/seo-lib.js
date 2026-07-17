/**
 * Shared helpers for Phase 4 SEO monitoring scripts.
 */
import http from 'node:http';
import https from 'node:https';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

export const DEFAULT_SITE = 'https://courts.theground.io';
export const DEFAULT_API = 'https://courts.api.theground.io';

export function siteBaseUrl() {
  return (process.env.SITEMAP_BASE_URL || DEFAULT_SITE).replace(/\/$/, '');
}

export function apiBaseUrl() {
  if (process.env.SITEMAP_API_URL) return process.env.SITEMAP_API_URL.replace(/\/$/, '');
  const vite = (process.env.VITE_API_URL || '').replace(/\/$/, '');
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(vite)) return vite;
  return DEFAULT_API;
}

export function fetchText(url, { timeoutMs = 30_000, method = 'GET' } = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request(
      parsed,
      {
        method,
        headers: {
          Accept: '*/*',
          'User-Agent': 'CourtsFinder-SEO-Monitor/1.0',
        },
        timeout: timeoutMs,
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          fetchText(new URL(res.headers.location, url).href, { timeoutMs, method }).then(resolve, reject);
          return;
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          resolve({
            url,
            status: res.statusCode || 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
      }
    );
    req.on('timeout', () => req.destroy(new Error(`Timeout after ${timeoutMs}ms`)));
    req.on('error', reject);
    req.end();
  });
}

export async function fetchJson(url) {
  const res = await fetchText(url);
  if (res.status !== 200) throw new Error(`HTTP ${res.status} for ${url}`);
  return JSON.parse(res.body);
}

export function parseSitemapLocs(xml) {
  const locs = [];
  const re = /<loc>\s*([^<]+)\s*<\/loc>/gi;
  let m;
  while ((m = re.exec(xml))) {
    locs.push(m[1].trim());
  }
  return [...new Set(locs)];
}

export function hasNoindex(html, headers = {}) {
  const robotsHeader = String(headers['x-robots-tag'] || '').toLowerCase();
  if (robotsHeader.includes('noindex')) return true;
  const meta = html.match(/<meta[^>]+name=["']robots["'][^>]*>/i);
  if (!meta) return false;
  const content = meta[0].match(/content=["']([^"']+)["']/i);
  return content ? content[1].toLowerCase().includes('noindex') : false;
}

/** Rough token Jaccard similarity for duplicate-content detection. */
export function textSimilarity(a, b) {
  const tokenize = (s) =>
    new Set(
      String(s || '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .filter((t) => t.length > 2)
    );
  const A = tokenize(a);
  const B = tokenize(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter += 1;
  return inter / (A.size + B.size - inter);
}

export function wordCount(s) {
  return String(s || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export function printReport(title, rows, { failIf = () => false } = {}) {
  console.log(`\n=== ${title} ===`);
  let failed = 0;
  for (const row of rows) {
    const line = typeof row === 'string' ? row : row.line;
    const bad = typeof row === 'object' && failIf(row);
    if (bad) failed += 1;
    console.log(bad ? `FAIL  ${line}` : `OK    ${line}`);
  }
  return failed;
}
