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

Create `.env`:

```env
VITE_API_URL=http://localhost:3001
VITE_GOOGLE_MAPS_API_KEY=your-key
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
