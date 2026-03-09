import axios from 'axios';
import FormData from 'form-data';

const IMGBB_API_KEY = process.env.IMGBB_API_KEY || '';

/** Max length for orgIcon in DB (avoid "Data too long"). Use VARCHAR(2048) or TEXT. */
const ORG_ICON_MAX_LENGTH = 2048;

export function sanitizeRow(body) {
  const allowed = new Set([
    'name', 'description', 'mtrStation', 'mtrExit', 'walkingDistance', 'address',
    'ceilingHeight', 'startingPrice', 'pricing', 'images', 'amenities', 'whatsapp',
    'socialLink', 'orgIcon', 'coordinates', 'sort_order', 'admin_password',
    'membership_enabled', 'membership_description', 'membership_join_link',
    'court_count',
  ]);
  const row = {};
  for (const [k, v] of Object.entries(body || {})) {
    if (!allowed.has(k)) continue;
    if (k === 'membership_enabled' && typeof v === 'boolean') {
      row[k] = v ? 1 : 0;
    } else if (k === 'court_count') {
      const n = v === undefined || v === null || v === '' ? null : parseInt(v, 10);
      row[k] = (Number.isNaN(n) || n < 0) ? null : n;
    } else if (v !== undefined) {
      row[k] = v;
    }
  }
  return row;
}

export async function uploadToImgBB(base64String) {
  if (!IMGBB_API_KEY) return null;
  try {
    const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');
    const formData = new FormData();
    formData.append('image', base64Data);
    const response = await axios.post(
      `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`,
      formData,
      { headers: formData.getHeaders() }
    );
    return response.data.data?.url ?? null;
  } catch (err) {
    console.error('ImgBB Upload Error:', err.response?.data || err.message);
    return null;
  }
}

/** Ensure orgIcon value fits DB column: upload data URLs to ImgBB, cap URL length. */
export async function processOrgIcon(value) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') return null;
  let result = value;
  if (value.startsWith('data:')) {
    result = await uploadToImgBB(value);
    if (!result) return null;
  }
  if (result.length > ORG_ICON_MAX_LENGTH) result = result.slice(0, ORG_ICON_MAX_LENGTH);
  return result;
}

export function setCorsHeaders(res, req) {
  const origin = req.headers?.origin;
  const allow = origin || process.env.CORS_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', allow);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}
