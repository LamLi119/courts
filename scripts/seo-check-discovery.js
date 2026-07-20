/**
 * Phase 4: verify live discovery assets (llms.txt, IndexNow key, robots, sitemap, AI catalog).
 *
 * Usage: node scripts/seo-check-discovery.js
 *        SEO_SITE_URL=https://courts.theground.io node scripts/seo-check-discovery.js
 */
import { siteBaseUrl, fetchText, printReport } from './seo-lib.js';

const INDEXNOW_KEY = (process.env.INDEXNOW_KEY || 'a7f3c9e2b18d4f6a0e5c2b9d7f1a8e3c').trim();

async function check(label, url, assertFn) {
  try {
    const res = await fetchText(url);
    const ok = assertFn(res);
    return { line: `${label} → ${res.status} ${url}${ok.detail ? ` (${ok.detail})` : ''}`, ok: !!ok.ok, severity: ok.ok ? 'ok' : 'fail' };
  } catch (err) {
    return { line: `${label} → ERROR ${url}: ${err.message}`, ok: false, severity: 'fail' };
  }
}

async function main() {
  const base = (process.env.SEO_SITE_URL || siteBaseUrl()).replace(/\/$/, '');
  console.log(`Discovery check against ${base}`);

  const rows = [];

  rows.push(
    await check('llms.txt', `${base}/llms.txt`, (res) => ({
      ok: res.status === 200 && /Courts/i.test(res.body) && /sitemap\.xml/i.test(res.body),
      detail: res.status === 200 ? `${res.body.length} bytes` : '',
    }))
  );

  rows.push(
    await check('AI catalog', `${base}/.well-known/ai-catalog.json`, (res) => {
      if (res.status !== 200) return { ok: false };
      try {
        const json = JSON.parse(res.body);
        return { ok: !!json.sitemap && !!json.llms, detail: json.name || 'parsed' };
      } catch {
        return { ok: false, detail: 'invalid JSON' };
      }
    })
  );

  rows.push(
    await check('robots.txt', `${base}/robots.txt`, (res) => ({
      ok: res.status === 200 && /Sitemap:/i.test(res.body) && !/Disallow:\s*\//i.test(res.body),
      detail: 'allows crawl + sitemap',
    }))
  );

  rows.push(
    await check('IndexNow key file', `${base}/${INDEXNOW_KEY}.txt`, (res) => ({
      ok: res.status === 200 && res.body.trim() === INDEXNOW_KEY,
      detail: res.status === 200 ? 'key matches' : '',
    }))
  );

  rows.push(
    await check('sitemap.xml', `${base}/sitemap.xml`, (res) => {
      const count = (res.body.match(/<loc>/g) || []).length;
      return {
        ok: res.status === 200 && count > 0 && /urlset/i.test(res.body),
        detail: `${count} URLs`,
      };
    })
  );

  rows.push(
    await check('OKF index', `${base}/okf`, (res) => ({
      ok: res.status === 200 && res.body.length > 50,
      detail: `${res.body.length} bytes`,
    }))
  );

  const failed = printReport('Discovery assets', rows, { failIf: (r) => !r.ok });
  console.log(`\nSummary: ${rows.length - failed}/${rows.length} passed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
