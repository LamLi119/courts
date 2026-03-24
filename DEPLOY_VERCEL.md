# Deploy to Vercel (方案 A：前端 + 反向代理)

The static app is served from Vercel. **`/api/*` is handled by a Vercel serverless function** (`api/[...path].ts`) that **proxies** to your Express API running on a **public URL** (VPS, Railway, Render, Fly.io, etc.). The Express process is what connects to MySQL.

## 1. Deploy the Express API first

1. Run `server/index.js` (e.g. `node server/run-local.js` or your host’s start command) on a host with a **stable HTTPS URL**.
2. On **that host only**, set the database and app env vars:

| Variable | Description |
|----------|-------------|
| `MYSQL_HOST` | Cloud SQL / MySQL host |
| `MYSQL_PORT` | `3306` (if not default) |
| `MYSQL_USER` | DB user |
| `MYSQL_PASSWORD` | DB password |
| `MYSQL_DATABASE` | DB name |
| `MYSQL_CA` | (If using Cloud SQL SSL) full PEM text of server CA |
| `MYSQL_CERT` | Full PEM text of client cert |
| `MYSQL_KEY` | Full PEM text of client key |
| `IMGBB_API_KEY` | (Optional) image uploads |
| `PROXY_SECRET` | (Optional) shared secret; must match Vercel if set |

PEM values: paste the entire file including `-----BEGIN ...` / `-----END ...` lines.

3. Confirm from **outside** your laptop (e.g. phone on cellular data): `http://YOUR_VM_IP:3001/api/sports` returns JSON. If this fails, Vercel will fail too.

### Google Cloud VM (firewall + OS)

The VM **external IP** must allow **TCP 3001** from the internet.

**GCP – VPC firewall (required)**

- Console: **VPC network → Firewall → Create firewall rule**
  - **Direction**: Ingress  
  - **Targets**: this VM (use the same **Network tags** as the VM, or “All instances in the network” for a quick test)  
  - **Source IPv4 ranges**: `0.0.0.0/0` (tighten later)  
  - **Protocols and ports**: `tcp:3001`  

Or **gcloud** (replace `NETWORK_NAME` and tag if you use tags):

```bash
gcloud compute firewall-rules create allow-courts-api-3001 \
  --network=default \
  --direction=INGRESS \
  --action=ALLOW \
  --rules=tcp:3001 \
  --source-ranges=0.0.0.0/0 \
  --target-tags=courts-api
```

If you use `--target-tags`, add the same tag to the VM under **Edit → Network tags**.

**VM – Ubuntu `ufw` (if enabled)**

```bash
sudo ufw allow 3001/tcp
sudo ufw reload
```

**`http://IP:3001` is OK for `PROXY_TARGET`:** the browser talks to Vercel over HTTPS; only Vercel’s servers call your VM over HTTP (no mixed-content block in the browser).

## 2. Connect the repo to Vercel and deploy

- Vercel uses `vercel.json` (SPA rewrites + Vite build).
- **Do not** set `VITE_API_URL` in Vercel (or leave it empty). The browser must call **`/api/*` on the same Vercel domain** so the proxy runs.

## 3. Vercel environment variables

Set for **Production** (and Preview if you use it), then **Redeploy**:

| Variable | Required | Description |
|----------|----------|-------------|
| `PROXY_TARGET` | **Yes** | Base URL of your Express API **with no trailing slash**, e.g. `http://34.x.x.x:3001` (GCP VM) or `https://your-api.example.com`. Requests to `https://your-app.vercel.app/api/sports` are forwarded to `{PROXY_TARGET}/api/sports`. |
| `PROXY_SECRET` | No | If set, must equal `PROXY_SECRET` on the Express server. The proxy sends it as `x-proxy-secret`. |

**Do not** put `MYSQL_*` on Vercel for this setup unless you change the code—the proxy does not talk to MySQL.

## 4. Redeploy after changes

Saving env vars does not always rebuild the frontend; trigger a **Redeploy** from the Vercel dashboard so `PROXY_TARGET` is picked up.

## 5. Local dev without a local API

- `npm run dev`
- In `.env`: `VITE_API_URL=https://your-app.vercel.app` (or your preview URL) so the browser hits Vercel’s proxy, which forwards to `PROXY_TARGET`.

## 6. Local dev with local API

- `.env`: `VITE_API_URL=http://localhost:3001`
- Terminal 1: `npm run server`
- Terminal 2: `npm run dev`

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| `Missing PROXY_TARGET env var` | `PROXY_TARGET` not set on Vercel or deploy is stale—redeploy. |
| Browser calls `localhost` from the live site | `VITE_API_URL` was set at build time to localhost—remove it on Vercel and redeploy. |
| `401` from API | `PROXY_SECRET` mismatch or set on server but not on Vercel. |
| Mixed content in the **browser** | Rare with this proxy: the page calls same-origin `/api`. If you set `VITE_API_URL` to `http://...`, the **browser** may block it from HTTPS—use empty `VITE_API_URL` on Vercel or HTTPS for direct API URLs. |
| Works on laptop, fails on Vercel | GCP firewall / `ufw` not allowing **3001** from the internet, or VM not listening on **0.0.0.0** (this repo’s `server/run-local.js` defaults to `0.0.0.0`; redeploy/restart the process on the VM). |
