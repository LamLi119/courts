# Deploy to Vercel (static frontend + direct API)

The Vercel project serves **only** the Vite build (`dist/`). The browser calls the Express API on the GCP VM directly via `VITE_API_URL` (baked in at build time).

API host: **`https://courts.api.theground.io`**

**Docs index:** [docs/README.md](docs/README.md) · **Features:** [docs/FEATURES.md](docs/FEATURES.md)

**Updating the VM API (staging vs prod):** see [docs/VM_SERVER_UPDATE.md](docs/VM_SERVER_UPDATE.md).

| Path on API host | Backend |
|------------------|---------|
| `/api/...` | Production (port 3001) — enable after prod cutover |
| `/staging/api/...` | Staging (port 3002) — for Preview / local testing |

---

## Option A — Preview tests staging first (recommended)

Use this while production on `main` may still use the old Vercel proxy. Work on branch **`vercel-static-preview`**.

### What stays the same until final cutover

- **Production** (`courts.theground.io`): can keep `PROXY_TARGET` + `api/` on `main` until you set up new prod on `:3001`.
- **Preview** deployments from this branch: static only → `https://courts.api.theground.io/staging`.

### 1. VM — staging (already done if Phase 1–3 complete)

- Staging API: `courts-api-staging` on port **3002**
- nginx: `https://courts.api.theground.io/staging/` → `127.0.0.1:3002`
- VM network tag: **`courts-api`** (for firewall `allow-courts-http-https`)
- Test: `curl https://courts.api.theground.io/staging/api/sports`

### 2. Vercel — Preview environment only

Settings → Environment Variables → **Preview**:

| Variable | Value |
|----------|--------|
| `VITE_API_URL` | `https://courts.api.theground.io/staging` |
| `VITE_GOOGLE_MAPS_API_KEY` | your key |

**Do not change Production** until prod API on `:3001` is ready behind nginx.

Remove from **Preview** (if set): `PROXY_TARGET`, `PROXY_SECRET`.

### 3. Push branch and open Preview URL

```bash
git push -u origin vercel-static-preview
```

Vercel creates a Preview deployment. Open the `*.vercel.app` URL.

Verify in DevTools → Network:

- API calls → `https://courts.api.theground.io/staging/api/...`
- **Not** `vercel.app/api/...`

### 4. GCS CORS (map icons) — **one-time on GCP**

On a machine with `gsutil` access to bucket `courts-image-bucket`:

```bash
gsutil cors set scripts/gcs-cors.json gs://courts-image-bucket
```

Add your Vercel preview hostname to `scripts/gcs-cors.json` first if it is not `court-git-dev-theground.vercel.app`. See `docs/GCS_MAP_ICONS.md`.

Preview deployments work **without** GCS CORS (icons use VM `/staging/api/image-proxy`), but CORS is recommended for production.

### 5. Google Maps API key

HTTP referrers:

- `https://courts.theground.io/*`
- `https://*.vercel.app/*`

---

## Final cutover — Production uses prod API

When Preview works and **new prod** runs on `:3001` behind nginx:

### VM

1. Prod systemd: `courts-api-prod` on port **3001**, `HOST=127.0.0.1`
2. nginx `location /` → `127.0.0.1:3001` (keep `/staging/` → 3002)
3. Test: `curl https://courts.api.theground.io/api/sports`
4. Remove `PROXY_SECRET` from prod/staging env if set
5. Close public GCP firewall for **tcp:3001** (only 80/443 public)

### Vercel — Production

| Variable | Value |
|----------|--------|
| `VITE_API_URL` | `https://courts.api.theground.io` |
| `VITE_GOOGLE_MAPS_API_KEY` | your key |

**Delete:** `PROXY_TARGET`, `PROXY_SECRET`

Redeploy Production.

### Merge

Merge `vercel-static-preview` → `main` and redeploy.

---

## Local development

**Local API:**

```env
VITE_API_URL=http://localhost:3001
```

Terminal 1: `npm run server`  
Terminal 2: `npm run dev`

**VM staging:**

```env
VITE_API_URL=https://courts.api.theground.io/staging
```

---

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Preview: no data | Preview missing `VITE_API_URL=.../staging` — redeploy |
| Production broken after merge without env | Set Production `VITE_API_URL` before merging static-only branch |
| `401` from API | `PROXY_SECRET` set on VM — unset for direct browser calls |
| Map icons via `image-proxy` | Configure GCS CORS (`docs/GCS_MAP_ICONS.md`) |
| Admin login fails cross-origin | Cookies need `SameSite=None; Secure` when frontend and API are on different hosts |
| Connection timeout to API | VM missing `courts-api` network tag or firewall 80/443 |

---

## Cost note

Vercel **Fast Origin Transfer** drops when Production no longer uses `api/` serverless proxy. Preview-only static deploys on this branch do not affect Production billing until you merge and switch Production env.
