/**
 * Apply scripts/gcs-cors.json to the GCS bucket (one-time or after editing origins).
 *
 * Requires credentials: GOOGLE_APPLICATION_CREDENTIALS, api/*.json service account,
 * or gcloud application-default credentials.
 *
 * Usage: node scripts/apply-gcs-cors.js
 *    or: npm run gcs:cors
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Storage } from '@google-cloud/storage';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(root, '.env') });

const BUCKET = (process.env.GCS_BUCKET_NAME || 'courts-image-bucket').trim();
const corsPath = path.join(__dirname, 'gcs-cors.json');

function ensureGcsCredentials() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return;
  const apiDir = path.join(root, 'api');
  if (!fs.existsSync(apiDir)) return;
  for (const name of fs.readdirSync(apiDir)) {
    if (!name.endsWith('.json')) continue;
    const fullPath = path.join(apiDir, name);
    try {
      const raw = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      if (raw?.type === 'service_account' && raw?.private_key) {
        process.env.GOOGLE_APPLICATION_CREDENTIALS = fullPath;
        return;
      }
    } catch {
      /* skip */
    }
  }
}

async function main() {
  const cors = JSON.parse(fs.readFileSync(corsPath, 'utf8'));
  ensureGcsCredentials();

  const storage = new Storage();
  const bucket = storage.bucket(BUCKET);

  await bucket.setMetadata({ cors });

  const [updated] = await bucket.getMetadata();
  console.log(`CORS applied to gs://${BUCKET}`);
  console.log(JSON.stringify(updated.cors, null, 2));
}

main().catch((err) => {
  console.error('Failed to apply GCS CORS:', err?.message || err);
  console.error(
    'Ensure you have Storage Admin (or bucket update) on',
    BUCKET,
    'then retry: npm run gcs:cors'
  );
  process.exit(1);
});
