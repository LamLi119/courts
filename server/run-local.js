import 'dotenv/config';
import app from './index.js';

const PORT = process.env.PORT || 3001;
const host = process.env.MYSQL_HOST || '(not set)';
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
  console.log(`DB host: ${host} (from MYSQL_HOST)`);
});