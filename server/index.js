import path from 'path';
import fs from 'fs';
import express from 'express';
import mysql from 'mysql2/promise';
import crypto from 'crypto';
import axios from 'axios';
import { Storage } from '@google-cloud/storage';

const app = express();
// Venue form sends base64 images; keep payload limit high enough for multi-image saves.
app.use(express.json({ limit: '25mb' }));

let pool;
const THE_GRIND_BACKEND_URL = (process.env.THE_GRIND_BACKEND_URL || process.env.THEGRIND_BACKEND_URL || '').replace(/\/$/, '');
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'abc321A!';
const ADMIN_SESSION_COOKIE = 'courts_admin_session';
const ADMIN_SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours
const adminSessions = new Map();

/** SSL only when cert files exist (e.g. Cloud SQL); otherwise connect without SSL for local MySQL. */
function getSslOptions() {
  const certDir = path.join(process.cwd(), 'api');
  const caPath = path.join(certDir, 'server-ca.pem');
  const certPath = path.join(certDir, 'client-cert.pem');
  const keyPath = path.join(certDir, 'client-key.pem');
  try {
    if (fs.existsSync(caPath) && fs.existsSync(certPath) && fs.existsSync(keyPath)) {
      return {
        ca: fs.readFileSync(caPath),
        cert: fs.readFileSync(certPath),
        key: fs.readFileSync(keyPath),
        rejectUnauthorized: false
      };
    }
  } catch (_) {
    // ignore
  }
  const ca = process.env.MYSQL_CA;
  const cert = process.env.MYSQL_CERT;
  const key = process.env.MYSQL_KEY;
  if (!ca && !cert && !key) return undefined;
  const ssl = {};
  if (ca) ssl.ca = Buffer.from(ca, 'utf8');
  if (cert) ssl.cert = Buffer.from(cert, 'utf8');
  if (key) ssl.key = Buffer.from(key, 'utf8');
  ssl.rejectUnauthorized = false;
  return ssl;
}

const getPool = () => {
  if (!pool) {
    const ssl = getSslOptions();
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST,
      port: parseInt(process.env.MYSQL_PORT || '3306', 10),
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
      waitForConnections: true,
      connectionLimit: 1,
      ...(ssl && Object.keys(ssl).length ? { ssl } : {})
    });
  }
  return pool;
};

const GCS_BUCKET_NAME = (process.env.GCS_BUCKET_NAME || '').trim();
let gcsBucket = null;

function getGcsBucket() {
  if (!GCS_BUCKET_NAME) return null;
  if (!gcsBucket) {
    const storage = new Storage();
    gcsBucket = storage.bucket(GCS_BUCKET_NAME);
  }
  return gcsBucket;
}

function parseImageDataUrl(input) {
  if (typeof input !== 'string') return null;
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(input);
  if (!m) return null;
  return { mimeType: m[1], base64Data: m[2] };
}

function extFromMimeType(mimeType) {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/gif') return 'gif';
  if (mimeType === 'image/avif') return 'avif';
  return 'bin';
}

function looksLikeImgbbUrl(input) {
  if (typeof input !== 'string') return false;
  try {
    const u = new URL(input);
    const host = (u.hostname || '').toLowerCase();
    return host.includes('imgbb.com') || host.includes('ibb.co');
  } catch (_) {
    return false;
  }
}

async function readRemoteImage(remoteUrl) {
  const response = await axios.get(remoteUrl, {
    responseType: 'arraybuffer',
    timeout: 15000,
    maxRedirects: 5,
    validateStatus: (status) => status >= 200 && status < 300
  });
  const contentTypeRaw = String(response.headers?.['content-type'] || '').split(';')[0].trim().toLowerCase();
  const mimeType = contentTypeRaw.startsWith('image/') ? contentTypeRaw : 'image/jpeg';
  return { mimeType, buffer: Buffer.from(response.data) };
}

/** Helper: Upload image input (data URL / ImgBB URL) to Google Cloud Storage. */
async function uploadToGCS(imageInput, folder = 'venues') {
  const parsed = parseImageDataUrl(imageInput);
  const shouldCopyImgbb = !parsed && looksLikeImgbbUrl(imageInput);
  // Keep other remote URLs unchanged.
  if (!parsed && !shouldCopyImgbb) return imageInput;

  const bucket = getGcsBucket();
  if (!bucket) {
    console.error('GCS upload skipped: GCS_BUCKET_NAME is not set');
    return null;
  }

  try {
    const imageData = parsed
      ? { mimeType: parsed.mimeType, buffer: Buffer.from(parsed.base64Data, 'base64') }
      : await readRemoteImage(imageInput);
    const { mimeType, buffer } = imageData;
    const ext = extFromMimeType(mimeType);
    const random = crypto.randomBytes(6).toString('hex');
    const objectPath = `${folder}/${Date.now()}-${random}.${ext}`;
    const file = bucket.file(objectPath);
    await file.save(buffer, {
      contentType: mimeType,
      resumable: false,
      metadata: {
        cacheControl: 'public, max-age=31536000, immutable'
      }
    });
    return `https://storage.googleapis.com/${GCS_BUCKET_NAME}/${encodeURIComponent(objectPath).replace(/%2F/g, '/')}`;
  } catch (err) {
    console.error('GCS upload error:', err?.message || err);
    return null;
  }
}

/** Helper: ensure pricing image is a GCS URL (not base64) before DB write. */
async function normalizePricingForStorage(rawPricing) {
  if (rawPricing == null || rawPricing === '') return rawPricing;

  let parsed = rawPricing;
  let fromString = false;
  if (typeof rawPricing === 'string') {
    try {
      parsed = JSON.parse(rawPricing);
      fromString = true;
    } catch (_) {
      return rawPricing;
    }
  }

  if (!parsed || typeof parsed !== 'object') return rawPricing;

  const pricing = { ...parsed };
  const imageUrl = typeof pricing.imageUrl === 'string' ? pricing.imageUrl : '';
  if (pricing.type === 'image' && imageUrl.startsWith('data:')) {
    const uploadedUrl = await uploadToGCS(imageUrl, 'pricing');
    // Keep only remote URLs in DB; never keep large base64 pricing images.
    if (typeof uploadedUrl === 'string' && /^https?:\/\//i.test(uploadedUrl)) {
      pricing.imageUrl = uploadedUrl;
    } else {
      pricing.imageUrl = '';
    }
  }

  return fromString ? JSON.stringify(pricing) : pricing;
}

/** User-friendly message when DB connection fails (e.g. MySQL not running or wrong MYSQL_HOST). */
function dbErrorMessage(err) {
  if (err && (err.code === 'ECONNREFUSED' || (err.message && err.message.includes('ECONNREFUSED')))) {
    return 'Database connection failed. For local dev: ensure MySQL is running and .env has MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE (or use your Cloud SQL host).';
  }
  return err && err.message ? err.message : 'Database error';
}

function md5(str) {
  return crypto.createHash('md5').update(String(str), 'utf8').digest('hex');
}

function parseCookies(req) {
  const raw = req.headers?.cookie || '';
  const out = {};
  raw.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx <= 0) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (!k) return;
    out[k] = decodeURIComponent(v || '');
  });
  return out;
}

function cleanupAdminSessions() {
  const now = Date.now();
  for (const [sid, value] of adminSessions.entries()) {
    if (!value || value.expiresAt <= now) adminSessions.delete(sid);
  }
}

function getAdminSession(req) {
  cleanupAdminSessions();
  const sid = parseCookies(req)[ADMIN_SESSION_COOKIE];
  if (!sid) return null;
  const session = adminSessions.get(sid);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    adminSessions.delete(sid);
    return null;
  }
  return { sid, ...session };
}

function setAdminSession(res, req, payload) {
  cleanupAdminSessions();
  const sid = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + ADMIN_SESSION_TTL_MS;
  adminSessions.set(sid, { ...payload, expiresAt });
  const forwardedProto = (req.get('x-forwarded-proto') || '').split(',')[0].trim();
  const secure = req.secure || forwardedProto === 'https';
  res.cookie(ADMIN_SESSION_COOKIE, sid, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    maxAge: ADMIN_SESSION_TTL_MS,
    path: '/',
  });
}

function clearAdminSession(req, res) {
  const sid = parseCookies(req)[ADMIN_SESSION_COOKIE];
  if (sid) adminSessions.delete(sid);
  res.clearCookie(ADMIN_SESSION_COOKIE, { path: '/' });
}

function trimTrailingSlash(input) {
  return (input || '').toString().trim().replace(/\/$/, '');
}

function getPublicServerBase(req) {
  const xfProto = (req.get('x-forwarded-proto') || '').split(',')[0].trim();
  const xfHost = (req.get('x-forwarded-host') || '').split(',')[0].trim();
  const proto = xfProto || req.protocol || 'http';
  const host = xfHost || req.get('host') || '';
  return host ? `${proto}://${host}` : '';
}

function getFrontendBase(req) {
  const fromEnv = trimTrailingSlash(
    process.env.COURTS_FRONTEND_URL
    || process.env.FRONTEND_URL
  );
  if (fromEnv) return fromEnv;

  const fromQuery = trimTrailingSlash(req.query?.frontendUrl || req.query?.frontend_url);
  if (fromQuery) return fromQuery;

  const origin = trimTrailingSlash(req.get('origin'));
  if (origin) return origin;

  return '';
}

function extractOAuthTokens(query) {
  const q = query || {};
  const accessToken = (
    q.accessToken
    || q.access_token
    || q.token
    || q.jwt
    || ''
  ).toString().trim();
  const refreshToken = (
    q.refreshToken
    || q.refresh_token
    || ''
  ).toString().trim();
  return { accessToken, refreshToken };
}

function parseJwtPayload(token) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

function normalizeText(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function extractPhone(profile) {
  return (
    normalizeText(profile?.phoneNo)
    || normalizeText(profile?.phone_no)
    || normalizeText(profile?.phone)
    || normalizeText(profile?.mobile)
    || normalizeText(profile?.mobileNo)
    || normalizeText(profile?.contactNo)
    || normalizeText(profile?.contact_no)
    || normalizeText(profile?.user?.phoneNo)
    || normalizeText(profile?.user?.phone_no)
    || ''
  );
}

function extractCountryCode(profile) {
  return (
    normalizeText(profile?.countryCode)
    || normalizeText(profile?.country_code)
    || normalizeText(profile?.dialCode)
    || normalizeText(profile?.dial_code)
    || '852'
  );
}

/**
 * Product/platform string from a Grind user profile (e.g. usersNonOdoo).
 * Prefer `platform` over `type`: OAuth flows may set `type` to a role-like value (coach)
 * while `platform` reflects the app the user signed into (courts).
 */
function grindProfileAppType(profile) {
  return normalizeText(profile?.platform)
    || normalizeText(profile?.type)
    || 'courts';
}

async function grindFetch(pathname, options) {
  if (!THE_GRIND_BACKEND_URL) {
    throw new Error('THE_GRIND_BACKEND_URL is not set');
  }
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const base = THE_GRIND_BACKEND_URL.replace(/\/$/, '');

  const tryUrls = [];
  // Try both "with /api" and "without /api" mounting styles.
  // This repo has had deployments where THE_GRIND_BACKEND_URL includes or omits `/api`.
  // We try both to avoid brittle 404s.
  tryUrls.push(`${base}${normalizedPath}`);
  if (base.endsWith('/api')) {
    // If base already includes `/api`, also try stripping it.
    tryUrls.push(`${base.replace(/\/api$/, '')}${normalizedPath}`);
  } else {
    // Otherwise, also try mounting under `/api`.
    tryUrls.push(`${base}/api${normalizedPath}`);
  }
  // Deduplicate while preserving order.
  const uniqueTryUrls = [];
  const seen = new Set();
  for (const u of tryUrls) {
    if (seen.has(u)) continue;
    seen.add(u);
    uniqueTryUrls.push(u);
  }

  let lastText = '';
  let lastStatus = 0;
  let lastUrl = uniqueTryUrls[0];

  for (const url of uniqueTryUrls) {
    lastUrl = url;
    let res;
    try {
      res = await fetch(url, {
        method: options?.method || 'GET',
        headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
        body: options?.body ? JSON.stringify(options.body) : undefined,
      });
    } catch (e) {
      // Important: fetch() errors (DNS/connection refused/etc) would otherwise lose context.
      lastStatus = 0;
      lastText = e?.message || 'fetch failed';
      continue;
    }
    if (res.ok) return res.json();

    lastStatus = res.status;
    lastText = await res.text().catch(() => '');

    // If it's not a 404, don't try alternate mount points.
    if (res.status !== 404) break;
  }

  let msg = lastText && lastText.length < 500 ? lastText : 'Request failed';
  if (lastText) {
    try {
      const parsed = JSON.parse(lastText);
      if (parsed && typeof parsed === 'object') {
        if (typeof parsed.message === 'string' && parsed.message.trim()) {
          msg = parsed.message.trim();
        } else if (typeof parsed.error === 'string' && parsed.error.trim()) {
          msg = parsed.error.trim();
        }
      }
    } catch (_) {
      // Non-JSON response body; keep original text.
    }
  }
  const err = new Error(msg);
  err.statusCode = lastStatus || 500;
  throw err;
}

/** Fetch a single venue by id with sport_data populated (name, name_zh, slug, sort_order). Strips admin_password. */
async function getVenueWithSports(db, venueId) {
  const [rows] = await db.execute('SELECT * FROM venues WHERE id = ?', [venueId]);
  if (!rows.length) return null;
  const r = { ...rows[0] };
  if (Object.prototype.hasOwnProperty.call(r, 'admin_password')) delete r.admin_password;
  try {
    let vsRows;
    try {
      [vsRows] = await db.execute(
        'SELECT vs.sport_id, vs.sort_order, s.name, s.name_zh, s.slug FROM venue_sports vs JOIN sports s ON s.id = vs.sport_id WHERE vs.venue_id = ? ORDER BY vs.sort_order',
        [venueId]
      );
    } catch (_) {
      [vsRows] = await db.execute(
        'SELECT vs.sport_id, vs.sort_order, s.name, s.slug FROM venue_sports vs JOIN sports s ON s.id = vs.sport_id WHERE vs.venue_id = ? ORDER BY vs.sort_order',
        [venueId]
      ).catch(() => [[]]);
      vsRows = (vsRows || []).map((row) => ({ ...row, name_zh: null }));
    }
    r.sport_data = (vsRows || []).map((row) => ({
      sport_id: row.sport_id,
      name: row.name,
      name_zh: row.name_zh ?? null,
      slug: row.slug,
      sort_order: row.sort_order
    }));
  } catch (_) {
    r.sport_data = [];
  }
  return r;
}

function sanitizeRow(body) {
  const allowed = new Set([
    'name', 'description', 'mtrStation', 'mtrExit', 'walkingDistance', 'address',
    'ceilingHeight', 'startingPrice', 'pricing', 'images', 'amenities', 'whatsapp',
    'socialLink', 'orgIcon', 'coordinates', 'sort_order', 'admin_password',
    'membership_enabled', 'membership_description', 'membership_join_link',
    'court_count',
    'booking_url', 'operating_hours', 'operating_hours_enabled',
  ]);
  const row = {};
  for (const [k, v] of Object.entries(body || {})) {
    if (allowed.has(k)) {
      if (k === 'membership_enabled' && typeof v === 'boolean') {
        row[k] = v ? 1 : 0;
      } else if (k === 'operating_hours_enabled' && typeof v === 'boolean') {
        row[k] = v ? 1 : 0;
      } else if (k === 'court_count') {
        const n = v === undefined || v === null || v === '' ? null : parseInt(v, 10);
        row[k] = (Number.isNaN(n) || n < 0) ? null : n;
      } else if (k === 'operating_hours') {
        if (v == null || v === '') row[k] = null;
        else if (typeof v === 'string') row[k] = v;
        else row[k] = JSON.stringify(v);
      } else {
        row[k] = (v === undefined) ? null : v;
      }
    }
  }
  return row;
}

// --- CORS ---
app.use((req, res, next) => {
  const origin = req.get('origin') || '';
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});

// Optional: protect API when running behind a proxy (e.g. Vercel).
// If PROXY_SECRET is set on the server, require callers to send matching x-proxy-secret.
const PROXY_SECRET = process.env.PROXY_SECRET || '';
app.use('/api', (req, res, next) => {
  if (!PROXY_SECRET) return next();
  if (req.method === 'OPTIONS') return next();
  // Public, allowlisted image proxy used by the frontend to avoid GCS CORS.
  // Safe because `/api/image-proxy` only allows storage.googleapis.com URLs.
  if (req.path === '/image-proxy') return next();
  const incoming = req.get('x-proxy-secret') || '';
  if (incoming !== PROXY_SECRET) return res.status(401).json({ error: 'Unauthorized' });
  return next();
});

// --- ROUTES ---

function isAllowedImageProxyUrl(rawUrl) {
  if (!rawUrl) return false;
  try {
    const u = new URL(String(rawUrl));
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    const host = (u.hostname || '').toLowerCase();
    // Allow GCS public object URLs only (prevents SSRF).
    if (host === 'storage.googleapis.com') return true;
    if (host.endsWith('.storage.googleapis.com')) return true;
    return false;
  } catch {
    return false;
  }
}

app.get('/api/image-proxy', async (req, res) => {
  try {
    const raw = (req.query?.url || '').toString().trim();
    if (!raw) return res.status(400).json({ error: 'Missing url' });
    if (!isAllowedImageProxyUrl(raw)) return res.status(400).json({ error: 'Invalid image url' });

    const response = await axios.get(raw, {
      responseType: 'arraybuffer',
      timeout: 15000,
      maxRedirects: 3,
      validateStatus: (status) => status >= 200 && status < 300
    });

    const contentType = String(response.headers?.['content-type'] || 'application/octet-stream');
    // Keep cache-friendly defaults; the underlying GCS objects are immutable in this app.
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.status(200).send(Buffer.from(response.data));
  } catch (err) {
    const msg = err?.message || 'Proxy failed';
    return res.status(502).json({ error: msg });
  }
});

// --- USER AUTH (proxy to TheGround backend) ---
app.post('/api/user/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    const loginId = (username || '').toString().trim();
    const rawPassword = (password || '').toString();
    if (!loginId || rawPassword.length < 1) return res.status(400).json({ error: 'username and password required' });

    const data = await grindFetch('/authentication/login', {
      method: 'POST',
      body: {
        loginId,
        password: md5(rawPassword),
      },
    });

    const accessToken = data.accessToken || data.access_token;
    const refreshToken = data.refreshToken || data.refresh_token;
    if (!accessToken) return res.status(500).json({ error: 'Missing access token from backend' });

    return res.json({
      token: accessToken,
      refreshToken,
      user: {
        id: data.id,
        name: data.name,
        username: data.loginId,
        email: data.email,
      },
    });
  } catch (err) {
    const code = err.statusCode || 500;
    return res.status(code).json({ error: err.message || 'Login failed' });
  }
});

app.post('/api/user/auth/register', async (req, res) => {
  try {
    const {
      email,
      loginId,
      name,
      phoneNo,
      password,
      type,
      country_code,
      description,
      page,
    } = req.body || {};

    const emailTrimmed = (email || '').toString().trim();
    const loginIdTrimmed = (loginId || '').toString().trim();
    const nameTrimmed = (name || '').toString().trim();
    const phoneTrimmed = (phoneNo || '').toString().trim();
    const rawPassword = (password || '').toString();

    if (!emailTrimmed || !loginIdTrimmed || !nameTrimmed || !phoneTrimmed || !rawPassword) {
      return res.status(400).json({ error: 'email, loginId, name, phoneNo and password are required' });
    }

    const payload = {
      email: emailTrimmed,
      loginId: loginIdTrimmed,
      name: nameTrimmed,
      phoneNo: phoneTrimmed,
      type: (type || 'courts').toString(),
      country_code: (country_code || '852').toString(),
      description: (description || '').toString(),
      page: (page || '').toString(),
      password: md5(rawPassword),
    };

    const data = await grindFetch('/authentication/register', {
      method: 'POST',
      body: payload,
    });

    const accessToken = data.accessToken || data.access_token;
    const refreshToken = data.refreshToken || data.refresh_token;
    if (!accessToken) return res.status(500).json({ error: 'Missing access token from backend' });

    return res.json({
      token: accessToken,
      refreshToken,
      user: {
        id: data.id,
        name: data.name,
        username: data.loginId || loginIdTrimmed,
        email: data.email || emailTrimmed,
        type: (data.type || payload.type || 'courts').toString(),
        role: data.role || data.userRole || null,
      },
    });
  } catch (err) {
    const code = err.statusCode || 500;
    const message = err.message || 'Register failed';
    return res.status(code).json({ error: message });
  }
});


app.get('/api/user/auth/session', async (req, res) => {
  try {
    const auth = req.headers?.authorization || '';
    const m = /^Bearer\s+(.+)$/.exec(auth);
    const token = m ? m[1] : '';
    if (!token) return res.status(401).json({ error: 'Missing token' });

    // Use the same endpoint TheGround uses for profile hydration.
    const profile = await grindFetch('/usersNonOdoo/v2', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });

    return res.json({
      user: {
        id: profile?.id,
        name: profile?.name,
        username: profile?.loginId || profile?.login_id || profile?.username || '',
        email: profile?.email,
        type: grindProfileAppType(profile),
        role: profile?.role || profile?.userRole || profile?.accountType || null,
        phoneNo: extractPhone(profile),
        countryCode: extractCountryCode(profile),
        avatarSrc: profile?.profile?.filePath,
      },
    });
  } catch (err) {
    const code = err.statusCode || 401;
    return res.status(code).json({ error: err.message || 'Invalid session' });
  }
});

app.post('/api/user/auth/complete-phone', async (req, res) => {
  try {
    const auth = req.headers?.authorization || '';
    const m = /^Bearer\s+(.+)$/.exec(auth);
    const token = m ? m[1] : '';
    if (!token) return res.status(401).json({ error: 'Missing token' });

    const phoneNo = (req.body?.phoneNo || '').toString().trim();
    const countryCode = (req.body?.country_code || req.body?.countryCode || '852').toString().trim();
    if (!phoneNo) return res.status(400).json({ error: 'phoneNo is required' });

    const tokenPayload = parseJwtPayload(token);
    const userId = Number(tokenPayload?.id);
    if (Number.isNaN(userId) || userId <= 0) {
      return res.status(400).json({
        error: 'Unable to resolve user id from token',
        debug: { endpoint: '/api/user/auth/complete-phone' },
      });
    }

    let currentUser;
    try {
      currentUser = await grindFetch(`/usersNonOdoo/${userId}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (e) {
      const code = e?.statusCode || 500;
      return res.status(code).json({
        error: e?.message || 'Failed to load user before update',
        debug: {
          endpoint: '/api/user/auth/complete-phone',
          step: 'get-user',
          path: `/usersNonOdoo/${userId}`,
        },
      });
    }

    const updateBody = {
      ...(currentUser && typeof currentUser === 'object' ? currentUser : {}),
      id: userId,
      // Send both key styles for backend compatibility across deployments.
      countryCode,
      country_code: countryCode,
      phoneNo,
      phone_no: phoneNo,
    };
    try {
      await grindFetch(`/usersNonOdoo/${userId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: updateBody,
      });
    } catch (e) {
      const code = e?.statusCode || 500;
      return res.status(code).json({
        error: e?.message || 'Failed to update phone info',
        debug: {
          endpoint: '/api/user/auth/complete-phone',
          step: 'patch-phone-and-country',
          path: `/usersNonOdoo/${userId}`,
          payloadKeys: Object.keys(updateBody),
        },
      });
    }

    const profile = await grindFetch('/usersNonOdoo/v2', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });

    return res.json({
      success: true,
      user: {
        id: profile?.id,
        name: profile?.name,
        username: profile?.loginId || profile?.login_id || profile?.username || '',
        email: profile?.email,
        type: grindProfileAppType(profile),
        role: profile?.role || profile?.userRole || profile?.accountType || null,
        phoneNo: extractPhone(profile) || phoneNo,
        countryCode: extractCountryCode(profile) || countryCode,
        avatarSrc: profile?.profile?.filePath,
      },
    });
  } catch (err) {
    const code = err.statusCode || 500;
    return res.status(code).json({
      error: err.message || 'Failed to complete phone number',
      debug: { endpoint: '/api/user/auth/complete-phone' },
    });
  }
});

app.post('/api/user/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body || {};
    const rt = (refreshToken || '').toString().trim();
    if (!rt) return res.status(400).json({ error: 'refreshToken required' });

    // Use the same proxy URL-mounting logic as login/session.
    const data = await grindFetch(
      `/authentication/refreshToken?refreshToken=${encodeURIComponent(rt)}`,
      { method: 'GET' }
    );
    return res.json({ token: data.access_token, refreshToken: data.refresh_token });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Refresh failed' });
  }
});

app.get('/api/user/auth/google/start', async (req, res) => {
  try {
    if (!THE_GRIND_BACKEND_URL) {
      return res.status(500).json({ error: 'THE_GRIND_BACKEND_URL is not set' });
    }

    const backendBase = trimTrailingSlash(THE_GRIND_BACKEND_URL);
    const serverBase = getPublicServerBase(req);
    const callbackUrl = `${serverBase}/api/user/auth/google/callback`;
    const frontendUrl = getFrontendBase(req);
    const platform = (req.query?.platform || 'courts').toString();

    const params = new URLSearchParams();
    params.set('platform', platform);
    if (frontendUrl) params.set('frontendUrl', frontendUrl);
    if (callbackUrl) {
      // Keep multiple common callback keys for backend compatibility.
      params.set('redirectUrl', callbackUrl);
      params.set('callbackUrl', callbackUrl);
      params.set('redirect_uri', callbackUrl);
    }

    const target = `${backendBase}/authentication/google?${params.toString()}`;
    return res.redirect(302, target);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to start Google sign-in' });
  }
});

app.get('/api/user/auth/google/callback', async (req, res) => {
  try {
    const { accessToken, refreshToken } = extractOAuthTokens(req.query);
    const frontendBase = getFrontendBase(req);
    const tokenLoginPath = frontendBase ? `${frontendBase}/token-login` : '/token-login';
    const hash = new URLSearchParams();

    if (accessToken) hash.set('accessToken', accessToken);
    if (refreshToken) hash.set('refreshToken', refreshToken);

    const error = (req.query?.error || req.query?.message || '').toString().trim();
    if (!accessToken && error) hash.set('error', error);
    if (!accessToken && !error) hash.set('error', 'Google login callback missing access token');

    const redirectTo = `${tokenLoginPath}#${hash.toString()}`;
    return res.redirect(302, redirectTo);
  } catch (err) {
    const frontendBase = getFrontendBase(req);
    const tokenLoginPath = frontendBase ? `${frontendBase}/token-login` : '/token-login';
    const hash = new URLSearchParams({
      error: err.message || 'Google login callback failed',
    });
    return res.redirect(302, `${tokenLoginPath}#${hash.toString()}`);
  }
});

// --- USER LOGOUT (client-side token storage; server-side no-op for now) ---
app.post('/api/user/auth/logout', async (_req, res) => {
  // Tokens are stored in the client (localStorage). There is no server session to clear.
  // This endpoint exists for API symmetry and future token revocation support.
  return res.json({ success: true });
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { password } = req.body || {};
    if (!password) return res.status(400).json({ error: 'Password required' });
    const rawPassword = String(password);
    if (rawPassword === SUPER_ADMIN_PASSWORD) {
      setAdminSession(res, req, { type: 'super', allowedIds: [] });
      return res.json({ type: 'super', allowedVenueIds: [] });
    }
    const db = getPool();
    const [rows] = await db.execute(
      'SELECT id FROM venues WHERE admin_password = ?',
      [rawPassword]
    );
    if (rows.length === 0) return res.status(401).json({ error: 'Invalid password' });
    const allowedVenueIds = rows.map((r) => r.id);
    setAdminSession(res, req, { type: 'court', allowedIds: allowedVenueIds });
    return res.json({ type: 'court', allowedVenueIds });
  } catch (err) {
    res.status(500).json({ error: dbErrorMessage(err) });
  }
});

app.get('/api/auth/session', (_req, res) => {
  const session = getAdminSession(_req);
  if (!session) return res.status(401).json({ error: 'Not logged in' });
  return res.json({ type: session.type, allowedVenueIds: session.allowedIds || [] });
});

app.post('/api/auth/logout', (req, res) => {
  clearAdminSession(req, res);
  return res.json({ success: true });
});

app.get('/api/sports', async (req, res) => {
  try {
    const db = getPool();
    let rows;
    try {
      [rows] = await db.execute('SELECT id, name, name_zh, slug FROM sports ORDER BY name ASC');
    } catch (e) {
      if (e.code === 'ER_BAD_FIELD_ERROR') {
        const [r] = await db.execute('SELECT id, name, slug FROM sports ORDER BY name ASC');
        rows = (r || []).map((s) => ({ ...s, name_zh: null }));
      } else throw e;
    }
    res.json(rows);
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return res.json([]);
    res.status(500).json({ error: dbErrorMessage(err) });
  }
});

function slugify(text) {
  if (!text || typeof text !== 'string') return '';
  return text.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

app.post('/api/sports', async (req, res) => {
  try {
    const db = getPool();
    const { name, name_en, name_zh } = req.body || {};
    const n = (name || name_en || '').toString().trim();
    if (!n) return res.status(400).json({ error: 'name or name_en required' });
    const zh = (name_zh || '').toString().trim() || null;
    const slug = slugify(n) || 'sport';
    // Avoid duplicate slug insert (uq_sports_slug): if exists, update it.
    const [result] = await db.execute(
      'INSERT INTO sports (name, name_zh, slug) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), name_zh = VALUES(name_zh)',
      [n, zh, slug]
    );

    // If it was an update, insertId may be 0; fetch current row id.
    const [rows] = await db.execute('SELECT id FROM sports WHERE slug = ?', [slug]);
    const id = rows?.[0]?.id;
    return res.status(201).json({ id, name: n, name_zh: zh, slug });
  } catch (err) {
    if (err.code === 'ER_BAD_FIELD_ERROR' && err.message && err.message.includes('name_zh')) {
      return res.status(500).json({ error: 'Run migration: add name_zh to sports. See scripts/add-sports-name_zh.sql' });
    }
    res.status(500).json({ error: dbErrorMessage(err) });
  }
});

app.put('/api/sports/:id', async (req, res) => {
  try {
    const db = getPool();
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    const { name, name_zh } = req.body || {};
    const n = (name || '').toString().trim();
    if (!n) return res.status(400).json({ error: 'name is required' });

    const slug = slugify(n) || 'sport';
    if (name_zh === undefined) {
      await db.execute('UPDATE sports SET name = ?, slug = ? WHERE id = ?', [n, slug, id]);
    } else {
      const zh = (name_zh || '').toString().trim() || null;
      try {
        await db.execute('UPDATE sports SET name = ?, name_zh = ?, slug = ? WHERE id = ?', [n, zh, slug, id]);
      } catch (err) {
        // Backward compatibility: sports table may not have name_zh column.
        if (err && err.code === 'ER_BAD_FIELD_ERROR' && err.message && err.message.includes('name_zh')) {
          await db.execute('UPDATE sports SET name = ?, slug = ? WHERE id = ?', [n, slug, id]);
        } else {
          // Helpful error when slug collides with another row.
          if (err && err.message && err.message.includes("Duplicate entry") && err.message.includes('uq_sports_slug')) {
            return res.status(409).json({ error: 'Slug already exists for another sport type' });
          }
          throw err;
        }
      }
    }

    // Return updated row (support both schemas: with/without name_zh).
    try {
      const [rows] = await db.execute('SELECT id, name, name_zh, slug FROM sports WHERE id = ?', [id]);
      return res.json(rows?.[0] ?? null);
    } catch (err) {
      if (err && err.code === 'ER_BAD_FIELD_ERROR' && err.message && err.message.includes('name_zh')) {
        const [rows] = await db.execute('SELECT id, name, slug FROM sports WHERE id = ?', [id]);
        const r = rows?.[0] ?? null;
        if (!r) return res.status(404).json({ error: 'Sport not found' });
        return res.json({ ...r, name_zh: null });
      }
      throw err;
    }
  } catch (err) {
    if (err && err.message && err.message.includes("Duplicate entry") && err.message.includes('uq_sports_slug')) {
      return res.status(409).json({ error: 'Slug already exists for another sport type' });
    }
    res.status(500).json({ error: dbErrorMessage(err) });
  }
});

app.delete('/api/sports/:id', async (req, res) => {
  try {
    const db = getPool();
    const id = req.params.id;
    await db.execute('DELETE FROM venue_sports WHERE sport_id = ?', [id]);
    await db.execute('DELETE FROM sports WHERE id = ?', [id]);
    return res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: dbErrorMessage(err) });
  }
});

app.get('/api/venues', async (req, res) => {
  try {
    const db = getPool();
    const adminSession = getAdminSession(req);
    const includePasswords = (adminSession && adminSession.type === 'super')
      || req.query.superAdminPassword === SUPER_ADMIN_PASSWORD;
    const [rows] = await db.execute(
      `SELECT * FROM venues ORDER BY sort_order IS NULL, sort_order ASC, name ASC`
    );
    try {
      let sportsRows;
      try {
        [sportsRows] = await db.execute('SELECT id, name, name_zh, slug FROM sports ORDER BY name');
      } catch (_) {
        const [r] = await db.execute('SELECT id, name, slug FROM sports ORDER BY name').catch(() => [[]]);
        sportsRows = (r || []).map((s) => ({ ...s, name_zh: null }));
      }
      const [vsRows] = await db.execute('SELECT venue_id, sport_id, sort_order FROM venue_sports');
      const sportsById = Object.fromEntries((sportsRows || []).map((s) => [s.id, s]));
      const byVenue = {};
      (vsRows || []).forEach((vs) => {
        if (!byVenue[vs.venue_id]) byVenue[vs.venue_id] = [];
        const s = sportsById[vs.sport_id];
        if (s) byVenue[vs.venue_id].push({ sport_id: s.id, name: s.name, name_zh: s.name_zh ?? null, slug: s.slug, sort_order: vs.sort_order });
      });
      rows.forEach((r) => { r.sport_data = byVenue[r.id] || []; });
    } catch (_) {}
    if (!includePasswords) {
      rows.forEach((r) => {
        if (Object.prototype.hasOwnProperty.call(r, 'admin_password')) delete r.admin_password;
      });
    }
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: dbErrorMessage(err) });
  }
});

app.post('/api/venues', async (req, res) => {
  try {
    const db = getPool();
    const row = sanitizeRow(req.body);

    // 1. Process Main Images
    if (row.images && Array.isArray(row.images)) {
      const imageUrls = await Promise.all(
        row.images.map((img) => uploadToGCS(img, 'venues'))
      );
      row.images = JSON.stringify(imageUrls.filter(url => url !== null));
    }

    // 2. Process orgIcon: upload data URLs to GCS, cap length for DB
    if (row.orgIcon != null && row.orgIcon !== '') {
      if (row.orgIcon.startsWith('data:')) {
        const uploadedUrl = await uploadToGCS(row.orgIcon, 'org-icons');
        row.orgIcon = uploadedUrl || null;
      }
      if (row.orgIcon && row.orgIcon.length > 2048) row.orgIcon = row.orgIcon.slice(0, 2048);
    }

    // 3. Process pricing image: upload base64 imageUrl to GCS when pricing.type === 'image'
    if (row.pricing != null && row.pricing !== '') {
      row.pricing = await normalizePricingForStorage(row.pricing);
    }

    if (row.coordinates) row.coordinates = JSON.stringify(row.coordinates);

    const keys = Object.keys(row);
    const values = keys.map((k) => row[k]);
    const placeholders = keys.map(() => '?').join(', ');

    const [result] = await db.execute(
      `INSERT INTO venues (${keys.map(k => `\`${k}\``).join(', ')}) VALUES (${placeholders})`,
      values
    );
    const venueId = result.insertId;
    const sportData = req.body?.sport_data;
    if (Array.isArray(sportData)) {
      try {
        await db.execute('DELETE FROM venue_sports WHERE venue_id = ?', [venueId]);
        for (let i = 0; i < sportData.length; i++) {
          const sid = Number(sportData[i]?.sport_id);
          if (!Number.isNaN(sid) && sid > 0) {
            await db.execute('INSERT INTO venue_sports (venue_id, sport_id, sort_order) VALUES (?, ?, ?)', [venueId, sid, sportData[i].sort_order ?? i]);
          }
        }
      } catch (_) {}
    }
    const out = await getVenueWithSports(db, venueId);
    res.status(201).json(out || { id: venueId, ...row });
  } catch (err) {
    console.error('POST Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/venues/:id', async (req, res) => {
    try {
      const db = getPool();
      const id = parseInt(req.params.id, 10);
      const row = sanitizeRow(req.body);
      // Do not overwrite admin_password when not provided (list API strips it; keep existing when re-editing)
      if (req.body.admin_password === undefined) {
        delete row.admin_password;
      }

      if (row.images && Array.isArray(row.images)) {
        const imageUrls = await Promise.all(row.images.map((img) => uploadToGCS(img, 'venues')));
        row.images = JSON.stringify(imageUrls.filter(u => u !== null));
      }
      if (row.orgIcon != null && row.orgIcon !== '') {
        if (row.orgIcon.startsWith('data:')) {
          const uploadedUrl = await uploadToGCS(row.orgIcon, 'org-icons');
          row.orgIcon = uploadedUrl || null;
        }
        if (row.orgIcon && row.orgIcon.length > 2048) row.orgIcon = row.orgIcon.slice(0, 2048);
      }
      if (row.pricing != null && row.pricing !== '') {
        row.pricing = await normalizePricingForStorage(row.pricing);
      }
      if (row.coordinates) row.coordinates = JSON.stringify(row.coordinates);

      const keys = Object.keys(row);
      if (keys.length === 0) {
        const out = await getVenueWithSports(db, id);
        return res.json(out || { id, ...row });
      }
      const setClause = keys.map((k) => `\`${k}\` = ?`).join(', ');
      const values = [...Object.values(row), id];

      await db.execute(`UPDATE venues SET ${setClause} WHERE id = ?`, values);
      const sportData = req.body?.sport_data;
      if (Array.isArray(sportData)) {
        try {
          await db.execute('DELETE FROM venue_sports WHERE venue_id = ?', [id]);
          for (let i = 0; i < sportData.length; i++) {
            const sid = Number(sportData[i]?.sport_id);
            if (!Number.isNaN(sid) && sid > 0) {
              await db.execute('INSERT INTO venue_sports (venue_id, sport_id, sort_order) VALUES (?, ?, ?)', [id, sid, sportData[i].sort_order ?? i]);
            }
          }
        } catch (_) {}
      }
      const out = await getVenueWithSports(db, id);
      res.json(out || { id, ...row });
  } catch (err) {
    res.status(500).json({ error: dbErrorMessage(err) });
  }
});

app.patch('/api/venues/order', async (req, res) => {
  try {
    const db = getPool();
    const { orderedIds, sportId } = req.body || {};
    if (!Array.isArray(orderedIds)) return res.status(400).json({ error: 'orderedIds array required' });
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      if (sportId != null && sportId !== '') {
        const sid = parseInt(sportId, 10);
        if (!Number.isNaN(sid)) {
          for (let i = 0; i < orderedIds.length; i++) {
            await connection.execute(
              'INSERT INTO venue_sports (venue_id, sport_id, sort_order) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE sort_order = ?',
              [orderedIds[i], sid, i, i]
            );
          }
          await connection.commit();
          return res.status(204).send();
        }
      }
      for (let i = 0; i < orderedIds.length; i++) {
        await connection.execute('UPDATE venues SET sort_order = ? WHERE id = ?', [i, orderedIds[i]]);
      }
      await connection.commit();
      return res.status(204).send();
    } finally {
      connection.release();
    }
  } catch (err) {
    res.status(500).json({ error: dbErrorMessage(err) });
  }
});

app.delete('/api/venues/:id', async (req, res) => {
  try {
    const db = getPool();
    const id = req.params.id;
    await db.execute('DELETE FROM venues WHERE id = ?', [id]);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: dbErrorMessage(err) });
  }
});

export default app;