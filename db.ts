// Database: Google Cloud SQL via backend API (see server/ and CLOUD_SQL_SETUP.md).
// Set VITE_API_URL in .env to your backend URL (e.g. http://localhost:3001).
import type { Venue, Sport } from './types';

// Empty = same-origin (e.g. Vercel: frontend and /api/* on same domain). Set for local dev or external API.
const API_BASE = (import.meta.env.VITE_API_URL ?? '').trim();

if (import.meta.env.DEV && !API_BASE) {
  console.warn(
    'VITE_API_URL is not set. For local dev with the Node server, set VITE_API_URL=http://localhost:3001 in .env'
  );
}

/** Strip ZWJ/BOM/format chars (match src/utils/slugify.ts). */
function cleanDisplayText(text: string): string {
  return text.replace(/\p{Cf}/gu, '').replace(/\uFEFF/g, '').trim().replace(/\s+/g, ' ');
}

/** Prefer camelCase app fields; MySQL/drivers may also return snake_case or lowercased keys. */
function pickStr(...vals: unknown[]): string {
  for (const v of vals) {
    if (v == null) continue;
    const s = cleanDisplayText(String(v));
    if (s) return s;
  }
  return '';
}

function pickNum(...vals: unknown[]): number {
  for (const v of vals) {
    if (v == null || v === '') continue;
    const n = typeof v === 'number' ? v : parseFloat(String(v));
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

// DB uses quoted camelCase ("mtrStation", "socialLink", "orgIcon"). App uses org_icon.
export function rowToVenue(row: any): Venue {
  if (!row) return row;

  // Parse images from string back to array
  let images = row.images;
  if (typeof images === 'string') {
    try {
      images = JSON.parse(images);
    } catch (e) {
      images = [];
    }
  }

  // Parse coordinates from string
  let coords = row.coordinates;
  if (typeof coords === 'string') {
    try {
      coords = JSON.parse(coords);
    } catch (e) {
      coords = null;
    }
  }

  // Parse pricing from string (JSON object)
  let pricing = row.pricing;
  if (typeof pricing === 'string') {
    try {
      pricing = JSON.parse(pricing);
    } catch (e) {
      pricing = { type: 'text' as const, content: '' };
    }
  }
  if (!pricing || typeof pricing !== 'object') {
    pricing = { type: 'text' as const, content: '' };
  }

  // Parse amenities from string (JSON array)
  let amenities = row.amenities;
  if (typeof amenities === 'string') {
    try {
      amenities = JSON.parse(amenities);
    } catch (e) {
      amenities = [];
    }
  }

  let sport_types = row.sport_types;
  if (typeof sport_types === 'string') {
    try {
      sport_types = JSON.parse(sport_types);
    } catch {
      sport_types = undefined;
    }
  }
  if (!Array.isArray(sport_types)) sport_types = undefined;

  let sport_data = row.sport_data;
  if (typeof sport_data === 'string') {
    try {
      sport_data = JSON.parse(sport_data);
    } catch {
      sport_data = undefined;
    }
  }
  if (Array.isArray(sport_data) && sport_data.length > 0) {
    sport_types = sport_data.map((d: any) => d.name || '').filter(Boolean);
  }
  let operating_hours = row.operating_hours;
  if (typeof operating_hours === 'string') {
    try {
      operating_hours = JSON.parse(operating_hours);
    } catch {
      operating_hours = null;
    }
  }
  if (!operating_hours || typeof operating_hours !== 'object') {
    operating_hours = null;
  }
  const sport_orders: Record<string, number> = {};
  if (Array.isArray(sport_data)) {
    sport_data.forEach((d: any) => {
      const slug = d.slug || String(d.sport_id);
      if (slug) sport_orders[slug] = typeof d.sort_order === 'number' ? d.sort_order : 0;
    });
  }

  const { orgIcon, sport_data: _sd, ...rest } = row;
  const has_admin_password = Boolean(row.has_admin_password)
    || !!(row.admin_password && String(row.admin_password).trim());
  const org_icon = orgIcon ?? row.org_icon ?? row.orgicon ?? null;
  const rawName = row.name ?? rest.name;
  return {
    ...rest,
    has_admin_password,
    // Strip ZWJ/BOM/etc. so slug resolve + display stay stable (e.g. venue id 8).
    name: typeof rawName === 'string' ? cleanDisplayText(rawName) : rawName,
    mtrStation: pickStr(row.mtrStation, row.mtr_station, row.mtrstation),
    mtrExit: pickStr(row.mtrExit, row.mtr_exit, row.mtrexit),
    walkingDistance: pickNum(row.walkingDistance, row.walking_distance, row.walkingdistance),
    images: Array.isArray(images) ? images : [],
    coordinates: coords,
    pricing: pricing,
    amenities: Array.isArray(amenities) ? amenities : [],
    org_icon,
    sport_types,
    sport_orders: Object.keys(sport_orders).length ? sport_orders : undefined,
    sport_data: Array.isArray(sport_data) ? sport_data : undefined,
    membership_enabled: Boolean(row.membership_enabled),
    membership_description: row.membership_description ?? null,
    membership_join_link: row.membership_join_link ?? null,
    court_count: row.court_count != null ? Number(row.court_count) : null,
    booking_url: row.booking_url ?? null,
    operating_hours,
    operating_hours_enabled: row.operating_hours_enabled == null ? true : Boolean(row.operating_hours_enabled),
  } as Venue;
}

const VENUE_COLUMNS = new Set([
  'name', 'description', 'mtrStation', 'mtrExit', 'walkingDistance', 'address',
  'ceilingHeight', 'startingPrice', 'pricing', 'images', 'amenities', 'whatsapp',
  'socialLink', 'orgIcon', 'coordinates', 'sort_order', 'admin_password',
  'membership_enabled', 'membership_description', 'membership_join_link',
  'court_count',
  'booking_url', 'operating_hours', 'operating_hours_enabled',
]);

function venueToRow(venue: Record<string, any>): Record<string, any> {
  const { org_icon, ...rest } = venue;
  const result: Record<string, any> = {};
  Object.entries(rest).forEach(([key, value]) => {
    if (!VENUE_COLUMNS.has(key)) return;
    if (key === 'court_count') {
      const n = value === null || value === '' || value === undefined ? null : Number(value);
      result[key] = (n != null && !Number.isNaN(n) && n >= 0) ? n : null;
      return;
    }
    if (key === 'operating_hours') {
      result[key] = value == null ? null : JSON.stringify(value);
      return;
    }
    if (key === 'operating_hours_enabled' && typeof value === 'boolean') {
      result[key] = value ? 1 : 0;
      return;
    }
    if (value === undefined) return;
    if (key === 'membership_enabled' && typeof value === 'boolean') {
      result[key] = value ? 1 : 0;
    } else {
      result[key] = value;
    }
  });
  if (org_icon !== undefined && VENUE_COLUMNS.has('orgIcon')) {
    result.orgIcon = (org_icon === '' || org_icon === null) ? null : org_icon;
  }
  return result;
}

async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  // If API_BASE is empty, use same-origin path (e.g. Vercel + `/api/*` proxy).
  const trimmedBase = API_BASE.trim();
  if (!trimmedBase) return fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...options?.headers } });

  let base = trimmedBase.replace(/\/+$/, '');
  // Prevent double "/api" when VITE_API_URL is mistakenly set to ".../api" or ".../api/api".
  base = base.replace(/(?:\/api)+$/, '');

  const url = path.startsWith('/') ? `${base}${path}` : `${base}/${path}`;
  return fetch(url, {
    ...options,
    credentials: options?.credentials ?? 'include',
    headers: { 'Content-Type': 'application/json', ...options?.headers }
  });
}

export const db = {
  async getSports(): Promise<Sport[]> {
    const res = await apiFetch('/api/sports');
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data.slice().sort((a: Sport, b: Sport) => {
      const ao = a.sort_order ?? 9999;
      const bo = b.sort_order ?? 9999;
      if (ao !== bo) return ao - bo;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
  },

  async createSport(payload: { name_en: string; name_zh?: string }): Promise<Sport> {
    const name_en = (payload.name_en || '').trim();
    if (!name_en) throw new Error('English name required');
    const res = await apiFetch('/api/sports', {
      method: 'POST',
      body: JSON.stringify({ name: name_en, name_en, name_zh: (payload.name_zh || '').trim() || undefined }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || res.statusText);
    }
    return res.json();
  },

  async updateSport(id: number, payload: { name: string; name_zh?: string }): Promise<Sport> {
    const res = await apiFetch(`/api/sports/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name: payload.name.trim(), name_zh: payload.name_zh?.trim() || undefined }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || res.statusText);
    }
    return res.json();
  },

  async deleteSport(id: number): Promise<void> {
    const res = await apiFetch(`/api/sports/${id}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 204) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || res.statusText);
    }
  },

  async updateSportsOrder(orderedIds: number[]): Promise<void> {
    const res = await apiFetch('/api/sports/order', {
      method: 'PATCH',
      body: JSON.stringify({ orderedIds }),
    });
    if (!res.ok && res.status !== 204) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || res.statusText);
    }
  },

  async getVenues(superAdminPassword?: string): Promise<Venue[]> {
    const path = '/api/venues' + (superAdminPassword != null && superAdminPassword !== '' ? `?superAdminPassword=${encodeURIComponent(superAdminPassword)}` : '');
    const res = await apiFetch(path);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || res.statusText);
    }
    const data = await res.json();
    return (Array.isArray(data) ? data : []).map((row: any) => rowToVenue(row));
  },

  async upsertVenue(venue: Partial<Venue>, _options?: { isSuperAdmin?: boolean }): Promise<Venue> {
    const {
      sort_order: _so,
      id,
      sport_data,
      clear_admin_password,
      has_admin_password: _hap,
      ...rest
    } = venue as any;
    const needsOrgIconClear = (rest.org_icon === null || rest.org_icon === '');
    const dataToSave = venueToRow(rest);
    if (needsOrgIconClear) (dataToSave as Record<string, unknown>).orgIcon = null;
    const body: Record<string, unknown> = { ...dataToSave };
    if (clear_admin_password) {
      body.admin_password = '';
    } else if (id && (body.admin_password === '' || body.admin_password === undefined)) {
      delete body.admin_password;
    }
    if (Array.isArray(sport_data)) {
      body.sport_data = sport_data.map((d) => ({ sport_id: Number(d.sport_id), sort_order: d.sort_order ?? 0 }));
    }

    const method = id ? 'PUT' : 'POST';
    const path = id ? `/api/venues/${id}` : '/api/venues';
    const res = await apiFetch(path, {
      method,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || res.statusText);
    }
    const data = await res.json();
    return rowToVenue(data);
  },

  async deleteVenue(id: number): Promise<void> {
    // Empty API_BASE = same-origin (e.g. Vercel). No throw.
    const res = await apiFetch(`/api/venues/${id}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 204) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || res.statusText);
    }
  },

  async updateVenueOrder(orderedIds: number[], sportId?: number | null): Promise<void> {
    const res = await apiFetch('/api/venues/order', {
      method: 'PATCH',
      body: JSON.stringify({ orderedIds, sportId: sportId ?? undefined }),
    });
    if (!res.ok && res.status !== 204) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || res.statusText);
    }
  },
};
