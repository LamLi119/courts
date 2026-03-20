// Database: Google Cloud SQL via backend API (see server/ and CLOUD_SQL_SETUP.md).
// Set VITE_API_URL in .env to your backend URL (e.g. http://localhost:3001).
import type { Venue, Sport } from './types';

// Empty = same-origin (e.g. Vercel: frontend and /api/* on same domain). Set for local dev or external API.
const API_BASE = import.meta.env.VITE_API_URL ?? '';

if (import.meta.env.DEV && !API_BASE) {
  console.warn(
    'VITE_API_URL is not set. For local dev with the Node server, set VITE_API_URL=http://localhost:3001 in .env'
  );
}

// DB uses quoted camelCase ("mtrStation", "socialLink", "orgIcon"). App uses org_icon.
function rowToVenue(row: any): Venue {
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
  const sport_orders: Record<string, number> = {};
  if (Array.isArray(sport_data)) {
    sport_data.forEach((d: any) => {
      const slug = d.slug || String(d.sport_id);
      if (slug) sport_orders[slug] = typeof d.sort_order === 'number' ? d.sort_order : 0;
    });
  }

  const { orgIcon, sport_data: _sd, ...rest } = row;
  return {
    ...rest,
    images: Array.isArray(images) ? images : [],
    coordinates: coords,
    pricing: pricing,
    amenities: Array.isArray(amenities) ? amenities : [],
    org_icon: orgIcon ?? null,
    sport_types,
    sport_orders: Object.keys(sport_orders).length ? sport_orders : undefined,
    sport_data: Array.isArray(sport_data) ? sport_data : undefined,
    membership_enabled: Boolean(row.membership_enabled),
    membership_description: row.membership_description ?? null,
    membership_join_link: row.membership_join_link ?? null,
    court_count: row.court_count != null ? Number(row.court_count) : null,
  } as Venue;
}

const VENUE_COLUMNS = new Set([
  'name', 'description', 'mtrStation', 'mtrExit', 'walkingDistance', 'address',
  'ceilingHeight', 'startingPrice', 'pricing', 'images', 'amenities', 'whatsapp',
  'socialLink', 'orgIcon', 'coordinates', 'sort_order', 'admin_password',
  'membership_enabled', 'membership_description', 'membership_join_link',
  'court_count',
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
  let base = API_BASE.replace(/\/$/, '');
  // Prevent double "/api" when VITE_API_URL is mistakenly set to something like ".../api".
  if (base.endsWith('/api') && path.startsWith('/api/')) base = base.replace(/\/api$/, '');
  const url = path.startsWith('/') ? `${base}${path}` : `${base}/${path}`;
  return fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...options?.headers } });
}

export const db = {
  async getSports(): Promise<Sport[]> {
    const res = await apiFetch('/api/sports');
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
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

  async upsertVenue(venue: Partial<Venue>, options?: { isSuperAdmin?: boolean }): Promise<Venue> {
    const { sort_order: _so, id, sport_data, ...rest } = venue as any;
    const needsOrgIconClear = (rest.org_icon === null || rest.org_icon === '');
    const dataToSave = venueToRow(rest);
    if (needsOrgIconClear) (dataToSave as Record<string, unknown>).orgIcon = null;
    const body: Record<string, unknown> = { ...dataToSave };
    // When editing, do not send empty admin_password so server keeps existing (list API strips it)
    // Exception: when super admin explicitly clears password, send '' so server sets no court admin
    if (id && (body.admin_password === '' || body.admin_password === undefined) && !options?.isSuperAdmin) {
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
