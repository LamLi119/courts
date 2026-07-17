# Courts Finder — Documentation

**Courts** (`courts.theground.io`) is a Vue 3 app for discovering sports courts in Hong Kong. The frontend is hosted on **Vercel**; the API and database run on a **GCP VM** with **Cloud SQL** and **GCS** for images.

## Docs

| Doc | Audience | Contents |
|-----|----------|----------|
| [FEATURES.md](./FEATURES.md) | Everyone | Product features, admin, API overview |
| [SEO_AFTER_FEATURE.md](./SEO_AFTER_FEATURE.md) | Developers | SEO checklist to run after shipping features |
| [../DEPLOY_VERCEL.md](../DEPLOY_VERCEL.md) | Developers | Vercel frontend deploy, env vars |
| [VM_SERVER_UPDATE.md](./VM_SERVER_UPDATE.md) | DevOps | GCP VM API deploy (staging vs prod) |
| [GCS_MAP_ICONS.md](./GCS_MAP_ICONS.md) | DevOps | GCS CORS for map icons |

## Quick links

| Environment | Frontend | API |
|-------------|----------|-----|
| Production | `https://courts.theground.io` | `https://courts.api.theground.io/api/...` |
| Staging / Preview | `*.vercel.app` | `https://courts.api.theground.io/staging/api/...` |
| Local | `http://localhost:3000` | `http://localhost:3001` |

## Local dev

```bash
npm install
# .env: VITE_API_URL=http://localhost:3001
npm run server   # terminal 1 — API on :3001
npm run dev      # terminal 2 — Vite on :3000
```
