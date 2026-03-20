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

3. Confirm from your machine: `https://your-api.example.com/api/sports` (or your real path) returns JSON.

## 2. Connect the repo to Vercel and deploy

- Vercel uses `vercel.json` (SPA rewrites + Vite build).
- **Do not** set `VITE_API_URL` in Vercel (or leave it empty). The browser must call **`/api/*` on the same Vercel domain** so the proxy runs.

## 3. Vercel environment variables

Set for **Production** (and Preview if you use it), then **Redeploy**:

| Variable | Required | Description |
|----------|----------|-------------|
| `PROXY_TARGET` | **Yes** | Base URL of your Express API **with no trailing slash**, e.g. `https://your-api.example.com`. Requests to `https://your-app.vercel.app/api/sports` are forwarded to `https://your-api.example.com/api/sports`. |
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
| Mixed content / blocked request | Use **HTTPS** for `PROXY_TARGET`; the Vercel site is HTTPS. |
