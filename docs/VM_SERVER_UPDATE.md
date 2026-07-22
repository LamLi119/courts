# Update the API server on the GCP VM

How to deploy new backend code to **staging (dev)** or **production** without affecting the other.

Frontend (Vercel / local) is separate — see [DEPLOY_VERCEL.md](../DEPLOY_VERCEL.md) for `VITE_API_URL`.

---

## Layout on the VM

| | Staging (dev) | Production |
|---|---------------|------------|
| **systemd service** | `courts-api-staging` | `courts-api-prod` |
| **Port** | 3002 | 3001 |
| **Env file** | `/etc/courts/staging.env` | `/etc/courts/prod.env` |
| **Code folder** | `/opt/courts-new` (check your unit file) | same folder |
| **Public URL** | `https://courts.api.theground.io/staging/api/...` | `https://courts.api.theground.io/api/...` |
| **Database** | `courts_staging` (at now is the same db, use `courts-db`) | `courts-db` |

Both services run the same repo (`server/run-local.js`) with different env files. Restarting one does **not** update the other.

**Both services must use the same code folder** (`/opt/courts-new`). If prod points at another path (e.g. `/home/team/court/court`), `git pull` in `/opt/courts-new` will not update production.

Confirm paths on your VM:

```bash
sudo systemctl cat courts-api-staging | grep WorkingDirectory
sudo systemctl cat courts-api-prod | grep WorkingDirectory
```

Both should show `WorkingDirectory=/opt/courts-new`. To fix prod:

```bash
sudo nano /etc/systemd/system/courts-api-prod.service
# set WorkingDirectory=/opt/courts-new
sudo systemctl daemon-reload
sudo systemctl restart courts-api-prod
```

Or use an override:

```bash
sudo mkdir -p /etc/systemd/system/courts-api-prod.service.d
echo -e '[Service]\nWorkingDirectory=/opt/courts-new' | sudo tee /etc/systemd/system/courts-api-prod.service.d/override.conf
sudo systemctl daemon-reload
sudo systemctl restart courts-api-prod
```

---

## Update staging only (dev server)

Use this for testing before touching production.

```bash
ssh team@instance-courts   # or gcloud compute ssh ...

cd /opt/courts-new         # use WorkingDirectory from above

git fetch
git checkout Main/SEO  # e.g. dev, or main for a staging test
git pull

npm ci

sudo systemctl restart courts-api-staging
```

### Verify staging

```bash
sudo systemctl status courts-api-staging
curl -s http://127.0.0.1:3002/api/sports | head
curl -s https://courts.api.theground.io/staging/api/sports | head
```

### Logs

```bash
sudo journalctl -u courts-api-staging -n 50 --no-pager
sudo journalctl -u courts-api-staging -f
```

**Do not** run `restart courts-api-prod` unless you intend to update production.

---

## Update production only

```bash
cd /opt/courts-new

git fetch
git checkout dev          # or your production branch
git pull

npm ci

sudo systemctl restart courts-api-prod
```

### Verify production

```bash
sudo systemctl status courts-api-prod
curl -s http://127.0.0.1:3001/api/sports | head
curl -s https://courts.api.theground.io/api/sports | head
```

### Logs

```bash
sudo journalctl -u courts-api-prod -n 50 --no-pager
sudo journalctl -u courts-api-prod -f
```

**Do not** restart staging unless you want staging updated too.

---

## Update both (rare)

Only when the same release should run on dev and prod:

```bash
cd /opt/courts-new
git pull
npm ci
sudo systemctl restart courts-api-staging
sudo systemctl restart courts-api-prod
```

---

## Change env only (no code pull)

**Staging:**

```bash
sudo nano /etc/courts/staging.env
sudo systemctl restart courts-api-staging
```

**Production:**

```bash
sudo nano /etc/courts/prod.env
sudo systemctl restart courts-api-prod
```

### Required env vars (each file)

```bash
PORT=3001          # prod — use 3002 in staging.env
HOST=127.0.0.1

MYSQL_HOST=...
MYSQL_PORT=3306
MYSQL_USER=...
MYSQL_PASSWORD='...'   # use single quotes if password has $ ! & etc.
MYSQL_DATABASE=...   # courts-db (prod) or courts_staging (staging)

GCS_BUCKET_NAME=courts-image-bucket   # no spaces around =
THE_GRIND_BACKEND_URL=https://api.thegrind-app.com
COURTS_FRONTEND_URL=https://courts.theground.io

# Notion blog sync (internal integration token + database id)
NOTION_API_TOKEN=secret_xxxxxxxx
NOTION_BLOG_DATABASE_ID=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
```

**Blog:** run `scripts/add-blog_posts.sql` once on the database, then set Notion env vars. Super-admin → **Sync blog from Notion** in `/admin` after publishing posts in Notion.

```bash
# Example: apply blog migration (adjust host/user as needed)
mysql -h "$MYSQL_HOST" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" < scripts/add-blog_posts.sql
```

**Image uploads** require `GCS_BUCKET_NAME` and GCS write access (VM service account or a service-account JSON in `api/`). The server defaults to `courts-image-bucket` if unset. If staging saves venues but `images` comes back as `[]`, deploy latest code and run on the VM:

```bash
cd /opt/courts-new
git pull
npm ci
sudo systemctl restart courts-api-staging
sudo bash scripts/check-gcs-upload.sh /etc/courts/staging.env
```

Run the check script from `/opt/courts-new` with `sudo` (env files are root-readable). If the check script fails, add `GCS_BUCKET_NAME=courts-image-bucket` to staging env (copy from prod if needed) and grant the VM service account **Storage Object Creator** on the bucket.

Do **not** set `PROXY_SECRET` when the browser calls the API directly (causes `401`).

---

## Recommended workflow

1. Push changes to GitHub from your laptop.
2. On VM: `git pull` in the code folder.
3. `npm ci` if dependencies changed.
4. `sudo systemctl restart courts-api-staging`
5. Test via Preview / local with `VITE_API_URL=https://courts.api.theground.io/staging`
6. When satisfied: `sudo systemctl restart courts-api-prod`
7. Frontend: redeploy Vercel if you changed UI (API-only changes do not need Vercel)

---

## Troubleshooting

| Symptom | Check |
|---------|--------|
| Service won’t start | `sudo journalctl -u courts-api-staging -n 30` |
| `EADDRINUSE :3002` on prod | `prod.env` has `PORT=3001`, not `3002` |
| 502 Bad Gateway (OPTIONS/PUT) | Prod API down — `sudo systemctl status courts-api-prod`; nothing on `:3001` |
| Prod not updated after `git pull` | `WorkingDirectory` still points at old folder — use `/opt/courts-new` |
| `CHDIR` error | `WorkingDirectory` in systemd doesn’t exist — fix path |
| HTTPS 404 | nginx config — `/staging/` → 3002, `/` → 3001 |
| HTTPS timeout | VM network tag `courts-api` + firewall 80/443 |
| `401` from API | Remove `PROXY_SECRET` from env file |
| Save OK but `images: "[]"` | Add `GCS_BUCKET_NAME=courts-image-bucket` to env; check `journalctl` for `GCS upload error` |
| `Image upload failed` / stream destroyed | Remove stale `api/*.json` in code folder; use VM service account; check bucket permissions |
| `MYSQL_PASSWORD: command not found` | Quote password in env file: `MYSQL_PASSWORD='...'` |
| `Image upload failed` on save | VM service account needs **Storage Object Creator** on `courts-image-bucket` |

### Service status (both)

```bash
sudo systemctl status courts-api-staging courts-api-prod
sudo ss -tlnp | grep -E '3001|3002'
```

---

## Point the frontend at staging vs prod

Not part of the VM update, but for reference:

| Where | `VITE_API_URL` |
|-------|----------------|
| Local dev → staging | `https://courts.api.theground.io/staging` |
| Local dev → prod | `https://courts.api.theground.io` |
| Local dev → local | `http://localhost:3001` (+ `npm run server`) |
| Vercel Preview | `https://courts.api.theground.io/staging` |
| Vercel Production | `https://courts.api.theground.io` |

Restart `npm run dev` or **Redeploy** Vercel after changing env vars.
