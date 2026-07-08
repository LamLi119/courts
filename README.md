# Courts Finder

Discover sports courts in Hong Kong — map, list, venue details, and admin tools for venue managers.

**Production:** [courts.theground.io](https://courts.theground.io)

## Documentation

See **[docs/README.md](docs/README.md)** for the full doc index:

- [Features & technical reference](docs/FEATURES.md)
- [Deploy frontend (Vercel)](DEPLOY_VERCEL.md)
- [Update API server (GCP VM)](docs/VM_SERVER_UPDATE.md)
- [GCS map icons / CORS](docs/GCS_MAP_ICONS.md)

## Run locally

**Prerequisites:** Node.js 20+

```bash
npm install
```

Create `.env` (see `.env.example`):

```env
VITE_API_URL=http://localhost:3001
VITE_GOOGLE_MAPS_API_KEY=your-key

# Server only — for the landing courts form (Webflow proxy)
WEBFLOW_API_TOKEN=your-webflow-site-api-token
WEBFLOW_SITE_ID=64a3d87da25bdfc447bb9470
WEBFLOW_FORM_NAME=Courts Form
WEBFLOW_PAGE_ID=6a4cc976d5d448ff93b2b52c
```

Terminal 1 — API:

```bash
npm run server
```

Terminal 2 — frontend:

```bash
npm run dev
```

Open `http://localhost:3000`.

To use the staging API instead of a local server, set `VITE_API_URL=https://courts.api.theground.io/staging`.

## Stack

Vue 3 · TypeScript · Vite · Tailwind · Express · MySQL (Cloud SQL) · GCS · Vercel · GCP VM
