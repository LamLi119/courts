import { getPool } from '../lib/db.js';
import { setCorsHeaders } from '../lib/helpers.js';

export default async function handler(req, res) {
  setCorsHeaders(res, req);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password required' });

  try {
    const pool = getPool();
    // Find all venues that have this exact admin_password
    const [rows] = await pool.execute(
      'SELECT id FROM venues WHERE admin_password = ?',
      [password]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    // Return an array of IDs they are allowed to edit
    const allowedVenueIds = rows.map(r => r.id);
    return res.json({ allowedVenueIds });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}