/**
 * Vercel serves static files before rewrites. Remove dist/sitemap.xml so
 * /sitemap.xml is proxied to the live API (vercel.json rewrite).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(root, 'dist', 'sitemap.xml');

if (fs.existsSync(target)) {
  fs.unlinkSync(target);
  console.log('Removed dist/sitemap.xml so Vercel rewrite can proxy the live API sitemap');
}
