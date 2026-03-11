import { getPool } from '../lib/db.js';
import { sanitizeRow, setCorsHeaders, processOrgIcon } from '../lib/helpers.js';

export const config = { api: { bodyParser: { sizeLimit: '2mb' } } };

export default async function handler(req, res) {
  setCorsHeaders(res, req);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const id = parseInt(req.query.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

  if (!['GET', 'PUT', 'DELETE'].includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const pool = getPool();

    if (req.method === 'GET') {
      const [rows] = await pool.execute('SELECT * FROM venues WHERE id = ?', [id]);
      if (rows.length === 0) return res.status(404).send();
      const venue = rows[0];
      try {
        let vsRows;
        try {
          [vsRows] = await pool.execute('SELECT vs.sport_id, vs.sort_order, s.name, s.name_zh, s.slug FROM venue_sports vs JOIN sports s ON s.id = vs.sport_id WHERE vs.venue_id = ? ORDER BY vs.sort_order', [id]);
        } catch (_) {
          const [r] = await pool.execute('SELECT vs.sport_id, vs.sort_order, s.name, s.slug FROM venue_sports vs JOIN sports s ON s.id = vs.sport_id WHERE vs.venue_id = ? ORDER BY vs.sort_order', [id]).catch(() => [[]]);
          vsRows = (r || []).map((row) => ({ ...row, name_zh: null }));
        }
        venue.sport_data = (vsRows || []).map((r) => ({ sport_id: r.sport_id, name: r.name, name_zh: r.name_zh ?? null, slug: r.slug, sort_order: r.sort_order }));
      } catch (_) {
        venue.sport_data = [];
      }
      return res.json(venue);
    }

    if (req.method === 'PUT') {
      const row = sanitizeRow(req.body);
      if (row.orgIcon !== undefined) {
        row.orgIcon = await processOrgIcon(row.orgIcon);
      }
      const keys = Object.keys(row);
      if (keys.length === 0) {
        const [rows] = await pool.execute('SELECT * FROM venues WHERE id = ?', [id]);
        if (Array.isArray(rows) && rows.length === 0) return res.status(404).json({ error: 'Not found' });
        return res.json(rows[0]);
      }
      if (row.coordinates && typeof row.coordinates === 'object') {
        row.coordinates = JSON.stringify(row.coordinates);
      }
      const setClause = keys.map((k) => (k === 'sort_order' ? 'sort_order' : `\`${k}\``) + ' = ?').join(', ');
      const values = [...Object.values(row), id];
      const [result] = await pool.execute(`UPDATE venues SET ${setClause} WHERE id = ?`, values);
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
      const sportData = req.body?.sport_data;
      if (Array.isArray(sportData)) {
        try {
          await pool.execute('DELETE FROM venue_sports WHERE venue_id = ?', [id]);
          for (let i = 0; i < sportData.length; i++) {
            const sid = sportData[i]?.sport_id;
            if (sid != null) await pool.execute('INSERT INTO venue_sports (venue_id, sport_id, sort_order) VALUES (?, ?, ?)', [id, sid, sportData[i].sort_order ?? i]);
          }
        } catch (_) {}
      }
      const [rows] = await pool.execute('SELECT * FROM venues WHERE id = ?', [id]);
      const out = rows[0];
      // Return full sport_data from DB (name, name_zh, slug) so UI can display tags after save
      try {
        let vsRows;
        try {
          [vsRows] = await pool.execute('SELECT vs.sport_id, vs.sort_order, s.name, s.name_zh, s.slug FROM venue_sports vs JOIN sports s ON s.id = vs.sport_id WHERE vs.venue_id = ? ORDER BY vs.sort_order', [id]);
        } catch (_) {
          const [r] = await pool.execute('SELECT vs.sport_id, vs.sort_order, s.name, s.slug FROM venue_sports vs JOIN sports s ON s.id = vs.sport_id WHERE vs.venue_id = ? ORDER BY vs.sort_order', [id]).catch(() => [[]]);
          vsRows = (r || []).map((row) => ({ ...row, name_zh: null }));
        }
        out.sport_data = (vsRows || []).map((r) => ({ sport_id: r.sport_id, name: r.name, name_zh: r.name_zh ?? null, slug: r.slug, sort_order: r.sort_order }));
      } catch (_) {
        out.sport_data = [];
      }
      return res.json(out);
    }

    if (req.method === 'DELETE') {
      const [result] = await pool.execute('DELETE FROM venues WHERE id = ?', [id]);
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
      return res.status(204).send();
    }
  } catch (err) {
    console.error('api/venues/[id]', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}
