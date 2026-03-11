import { getPool } from '../lib/db.js';
import { setCorsHeaders } from '../lib/helpers.js';

function slugify(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export default async function handler(req, res) {
  setCorsHeaders(res, req);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const id = parseInt(req.query.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

  if (req.method !== 'PUT' && req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const pool = getPool();

    if (req.method === 'PUT') {
      const { name, name_zh } = req.body || {};
      const n = (name ?? '').toString().trim();
      if (!n) return res.status(400).json({ error: 'name required' });
      const zh = (name_zh ?? '').toString().trim() || null;
      const slug = slugify(n) || 'sport';
      const [result] = await pool.execute(
        'UPDATE sports SET name = ?, name_zh = ?, slug = ? WHERE id = ?',
        [n, zh, slug, id]
      );
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
      return res.json({ id, name: n, name_zh: zh, slug });
    }

    if (req.method === 'DELETE') {
      await pool.execute('DELETE FROM venue_sports WHERE sport_id = ?', [id]);
      const [result] = await pool.execute('DELETE FROM sports WHERE id = ?', [id]);
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
      return res.status(204).send();
    }
  } catch (err) {
    console.error('api/sports/[id]', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}
