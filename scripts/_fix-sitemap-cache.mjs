import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CACHE_DIR = path.join(ROOT, 'scripts', '.sitemap-cache');
const SOURCE = '/mnt/c/Users/lily/.cursor/projects/wsl-localhost-Ubuntu-home-lily119-doc-the-grind-Courts-Finder-court/agent-tools/4e3d9c37-95ba-4d1b-88da-42e555941246.txt';
const API = 'https://courts.api.theground.io';

function size(p) {
  try { return fs.statSync(p).size; } catch { return null; }
}

console.log('=== Source file ===');
console.log('size:', size(SOURCE));
if (fs.existsSync(SOURCE)) {
  const tail = fs.readFileSync(SOURCE).subarray(-200).toString('utf8');
  console.log('--- tail ---');
  console.log(tail);
}

console.log('\n=== Current venues.json ===');
console.log('size:', size(path.join(CACHE_DIR, 'venues.json')));

fs.mkdirSync(CACHE_DIR, { recursive: true });

const sourceSize = size(SOURCE) ?? 0;
const cacheSize = size(path.join(CACHE_DIR, 'venues.json')) ?? 0;
console.log(`SOURCE_SIZE=${sourceSize} CACHE_SIZE=${cacheSize}`);

console.log('\n=== Fetching from API ===');
for (const name of ['sports', 'venues']) {
  const url = `${API}/api/${name}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const data = await res.json();
  const out = path.join(CACHE_DIR, `${name}.json`);
  fs.writeFileSync(out, JSON.stringify(data));
  console.log(`Fetched ${name}: ${fs.statSync(out).size} bytes, ${data.length} items`);
}

console.log('\n=== JSON parse check ===');
const venues = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'venues.json'), 'utf8'));
const sports = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'sports.json'), 'utf8'));
console.log('OK venues', venues.length, 'sports', sports.length);

console.log('\n=== Generate sitemap ===');
const { spawnSync } = await import('child_process');
const gen = spawnSync('node', ['scripts/generate-sitemap.js', '--cache-only'], {
  cwd: ROOT,
  encoding: 'utf8',
  stdio: ['inherit', 'pipe', 'pipe'],
});
process.stdout.write(gen.stdout || '');
process.stderr.write(gen.stderr || '');
if (gen.status !== 0) process.exit(gen.status ?? 1);

const sitemapPath = path.join(ROOT, 'public', 'sitemap.xml');
const xml = fs.readFileSync(sitemapPath, 'utf8');
const urlCount = (xml.match(/<loc>/g) || []).length;
console.log('\n=== Sitemap ===');
console.log('size:', fs.statSync(sitemapPath).size);
console.log('URL_COUNT=', urlCount);
console.log(xml.split('\n').slice(0, 20).join('\n'));
