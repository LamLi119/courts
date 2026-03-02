import express from 'express';
import axios from 'axios';
import FormData from 'form-data';
import { getPool } from './lib/db.js';

const app = express();
app.use(express.json({ limit: '5mb' })); // Increased limit for Base64

const IMGBB_API_KEY = process.env.IMGBB_API_KEY || '';

/** Helper: Upload to ImgBB */
async function uploadToImgBB(base64String) {
  if (!IMGBB_API_KEY || !base64String || !base64String.startsWith('data:')) return base64String;
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
    console.error('ImgBB Upload Error:', err.message);
    return null;
  }
}

function sanitizeRow(body) {
  const allowed = new Set([
    'name', 'description', 'mtrStation', 'mtrExit', 'walkingDistance', 'address',
    'ceilingHeight', 'startingPrice', 'pricing', 'images', 'amenities', 'whatsapp',
    'socialLink', 'orgIcon', 'coordinates', 'sort_order', 'admin_password',
    'membership_enabled', 'membership_description', 'membership_join_link',
  ]);
  const row = {};
  for (const [k, v] of Object.entries(body || {})) {
    if (allowed.has(k)) {
        // Map undefined to null for SQL compatibility
        row[k] = (v === undefined) ? null : v;
    }
  }
  return row;
}

// --- CORS ---
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});

// --- ROUTES ---

app.get('/api/venues', async (req, res) => {
  try {
    const db = getPool();
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
      rows.forEach((r) => {
        r.sport_data = byVenue[r.id] || [];
      });
    } catch (_) {
      /* sports/venue_sports tables may not exist yet */
    }
    // Include admin_password only when super admin requests with correct password (for editing form)
    const includePasswords = req.query.superAdminPassword === (process.env.SUPER_ADMIN_PASSWORD || 'abc321A!');
    if (!includePasswords) {
      rows.forEach((r) => {
        if (Object.prototype.hasOwnProperty.call(r, 'admin_password')) delete r.admin_password;
      });
    }
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/venues', async (req, res) => {
  try {
    const db = getPool();
    const row = sanitizeRow(req.body);

    // 1. Process Main Images
    if (row.images && Array.isArray(row.images)) {
      const imageUrls = await Promise.all(
        row.images.map(img => uploadToImgBB(img))
      );
      row.images = JSON.stringify(imageUrls.filter(url => url !== null));
    }

    // 2. Process orgIcon: upload data URLs to ImgBB, cap length for DB
    if (row.orgIcon != null && row.orgIcon !== '') {
      if (row.orgIcon.startsWith('data:')) {
        const uploadedUrl = await uploadToImgBB(row.orgIcon);
        row.orgIcon = uploadedUrl || null;
      }
      if (row.orgIcon && row.orgIcon.length > 2048) row.orgIcon = row.orgIcon.slice(0, 2048);
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
    if (Array.isArray(sportData) && sportData.length > 0) {
      try {
        await db.execute('DELETE FROM venue_sports WHERE venue_id = ?', [venueId]);
        for (let i = 0; i < sportData.length; i++) {
          const sid = sportData[i]?.sport_id;
          if (sid != null) await db.execute('INSERT INTO venue_sports (venue_id, sport_id, sort_order) VALUES (?, ?, ?)', [venueId, sid, sportData[i].sort_order ?? i]);
        }
      } catch (_) {}
    }
    // Return full sport_data from DB (name, name_zh, slug) so UI can display tags after save
    let outSportData = [];
    try {
      let vsRows;
      try {
        [vsRows] = await db.execute('SELECT vs.sport_id, vs.sort_order, s.name, s.name_zh, s.slug FROM venue_sports vs JOIN sports s ON s.id = vs.sport_id WHERE vs.venue_id = ? ORDER BY vs.sort_order', [venueId]);
      } catch (_) {
        const [r] = await db.execute('SELECT vs.sport_id, vs.sort_order, s.name, s.slug FROM venue_sports vs JOIN sports s ON s.id = vs.sport_id WHERE vs.venue_id = ? ORDER BY vs.sort_order', [venueId]).catch(() => [[]]);
        vsRows = (r || []).map((row) => ({ ...row, name_zh: null }));
      }
      outSportData = (vsRows || []).map((r) => ({ sport_id: r.sport_id, name: r.name, name_zh: r.name_zh ?? null, slug: r.slug, sort_order: r.sort_order }));
    } catch (_) {}
    row.sport_data = outSportData;
    res.status(201).json({ id: venueId, ...row });
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

      if (row.images && Array.isArray(row.images)) {
        const imageUrls = await Promise.all(row.images.map(img => uploadToImgBB(img)));
        row.images = JSON.stringify(imageUrls.filter(u => u !== null));
      }
      if (row.orgIcon != null && row.orgIcon !== '') {
        if (row.orgIcon.startsWith('data:')) {
          const uploadedUrl = await uploadToImgBB(row.orgIcon);
          row.orgIcon = uploadedUrl || null;
        }
        if (row.orgIcon && row.orgIcon.length > 2048) row.orgIcon = row.orgIcon.slice(0, 2048);
      }
      if (row.coordinates) row.coordinates = JSON.stringify(row.coordinates);

      const keys = Object.keys(row);
      const setClause = keys.map((k) => `\`${k}\` = ?`).join(', ');
      const values = [...Object.values(row), id];

      await db.execute(`UPDATE venues SET ${setClause} WHERE id = ?`, values);
      const sportData = req.body?.sport_data;
      if (Array.isArray(sportData)) {
        try {
          await db.execute('DELETE FROM venue_sports WHERE venue_id = ?', [id]);
          for (let i = 0; i < sportData.length; i++) {
            const sid = sportData[i]?.sport_id;
            if (sid != null) await db.execute('INSERT INTO venue_sports (venue_id, sport_id, sort_order) VALUES (?, ?, ?)', [id, sid, sportData[i].sort_order ?? i]);
          }
        } catch (_) {}
      }
      // Return full sport_data from DB so UI can display tags after save
      let outSportData = [];
      try {
        let vsRows;
        try {
          [vsRows] = await db.execute('SELECT vs.sport_id, vs.sort_order, s.name, s.name_zh, s.slug FROM venue_sports vs JOIN sports s ON s.id = vs.sport_id WHERE vs.venue_id = ? ORDER BY vs.sort_order', [id]);
        } catch (_) {
          const [r] = await db.execute('SELECT vs.sport_id, vs.sort_order, s.name, s.slug FROM venue_sports vs JOIN sports s ON s.id = vs.sport_id WHERE vs.venue_id = ? ORDER BY vs.sort_order', [id]).catch(() => [[]]);
          vsRows = (r || []).map((srow) => ({ ...srow, name_zh: null }));
        }
        outSportData = (vsRows || []).map((r) => ({ sport_id: r.sport_id, name: r.name, name_zh: r.name_zh ?? null, slug: r.slug, sort_order: r.sort_order }));
      } catch (_) {}
      res.json({ id, ...row, sport_data: outSportData });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
});

app.delete('/api/venues/:id', async (req, res) => {
  try {
    const db = getPool();
    const id = req.params.id;
    await db.execute('DELETE FROM venues WHERE id = ?', [id]);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default app;