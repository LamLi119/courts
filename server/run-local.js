import 'dotenv/config';
import app from './index.js';

const PORT = process.env.PORT || 3001;
// Bind all interfaces so GCP VM / Docker accepts traffic from Vercel (not only 127.0.0.1).
const LISTEN_HOST = process.env.LISTEN_HOST || '0.0.0.0';
const dbHost = process.env.MYSQL_HOST || '(not set)';
app.listen(PORT, LISTEN_HOST, () => {
  console.log(`Server listening on http://${LISTEN_HOST}:${PORT}`);
  console.log(`DB host: ${dbHost} (from MYSQL_HOST)`);
});