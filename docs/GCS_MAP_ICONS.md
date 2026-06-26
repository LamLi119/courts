# GCS CORS for map marker icons

Map pins load venue icons from **Google Cloud Storage**. The browser must be allowed by **bucket CORS** to read them directly.

| Frontend origin | Without CORS | With CORS |
|-----------------|--------------|-----------|
| `courts.theground.io` | Uses VM `/api/image-proxy` | Direct GCS (best) |
| `localhost:3000` | Uses image-proxy if direct fails | Direct GCS |
| Vercel preview (`*.vercel.app`) | Uses VM `/api/image-proxy` (code skips doomed direct GCS) | Direct GCS if origin added below |

If CORS is missing on a preview URL, icons still load via **`https://courts.api.theground.io/staging/api/image-proxy`** (requires `VITE_API_URL` on Preview).

---

## One-time setup (GCP — you must run this)

Someone with access to bucket **`courts-image-bucket`** runs:

```bash
cd /path/to/court
gsutil cors set scripts/gcs-cors.json gs://courts-image-bucket
gsutil cors get gs://courts-image-bucket
```

Or Cloud Console → **Cloud Storage** → `courts-image-bucket` → **Permissions** → **CORS**.

### Add more Vercel preview URLs

GCS does **not** support `https://*.vercel.app`. Edit `scripts/gcs-cors.json` and add each preview hostname, then run `gsutil cors set` again.

Example preview host: `https://court-git-dev-theground.vercel.app`

---

## Verify

1. Open the site → map view.
2. DevTools → **Network**:
   - **With CORS:** `storage.googleapis.com` → **200**
   - **Without CORS (preview):** `courts.api.theground.io/.../image-proxy` → **200** (not failed GCS rows)
3. Map pins show venue icons (not only default numbered pins).

---

## Notes

- Gallery photos (`ImageCarousel`) use GCS URLs directly; map pins use the logic in `MapView.vue`.
- After changing CORS, hard-refresh the browser (CORS preflight may be cached up to 1 hour).
