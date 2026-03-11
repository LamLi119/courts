import { getPool } from './lib/db.js';

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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const pool = getPool();

    if (req.method === 'GET') {
      let rows;
      try {
        [rows] = await pool.execute(
          'SELECT id, name, name_zh, slug FROM sports ORDER BY name ASC'
        );
      } catch (e) {
        if (e.code === 'ER_BAD_FIELD_ERROR') {
          const [r] = await pool.execute('SELECT id, name, slug FROM sports ORDER BY name ASC');
          rows = (r || []).map((s) => ({ ...s, name_zh: null }));
        } else throw e;
      }
      return res.json(rows);
    }

    if (req.method === 'POST') {
      const { name, name_en, name_zh } = req.body || {};
      const n = (name || name_en || '').toString().trim();
      if (!n) return res.status(400).json({ error: 'name or name_en required' });
      const zh = (name_zh || '').toString().trim() || null;
      const slug = slugify(n) || 'sport';
      const [result] = await pool.execute(
        'INSERT INTO sports (name, name_zh, slug) VALUES (?, ?, ?)',
        [n, zh, slug]
      );
      return res.status(201).json({ id: result.insertId, name: n, name_zh: zh, slug });
    }
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return res.json([]);
    if (err.code === 'ER_BAD_FIELD_ERROR' && err.message && err.message.includes('name_zh')) {
      return res.status(500).json({ error: 'Run migration: add name_zh to sports table. See scripts/add-sports-name_zh.sql' });
    }
    console.error('api/sports', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}