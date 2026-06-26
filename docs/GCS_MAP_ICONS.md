# GCS CORS for map marker icons

Every map pin loads its venue icon on first render. Icons are fetched **directly from Google Cloud Storage** in the browser when CORS is configured.

If CORS is not configured, the app falls back to `/api/image-proxy` on the VM API (configure CORS below to avoid that extra hop).

## Configure CORS on your GCS bucket

Google Cloud Console → **Cloud Storage** → your venues bucket → **Permissions** tab → **CORS** → **Edit** (or use `gsutil`).

Example policy (replace origins with your real frontend URLs):

```json
[
  {
    "origin": [
      "https://courts.theground.io",
      "https://your-vercel-preview-url.vercel.app",
      "http://localhost:3000"
    ],
    "method": ["GET", "HEAD"],
    "responseHeader": ["Content-Type"],
    "maxAgeSeconds": 3600
  }
]
```

### Using gsutil

Save the JSON above as `cors.json`, then:

```bash
gsutil cors set cors.json gs://YOUR_BUCKET_NAME
```

## Verify

1. Open your live site → open the map view.
2. DevTools → **Network** → filter by `storage.googleapis.com`.
3. You should see icon requests go **directly to GCS**, not `vercel.app/api/image-proxy`.

If direct load fails, check the browser console for CORS errors and add the missing origin to the bucket policy.

## Notes

- Wildcards like `https://*.vercel.app` are **not** supported in GCS CORS. Add each Vercel preview URL you use, or rely on proxy fallback for previews.
- Venue gallery photos (`ImageCarousel`) already use GCS URLs directly; this doc is only for **map pin** icons.
