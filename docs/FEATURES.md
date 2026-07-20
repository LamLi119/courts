# Courts Finder — Features & Technical Reference

## 1. Overview

Courts Finder helps users discover sports venues in Hong Kong (pickleball, tennis, etc.), view details on a map or list, save favourites, and (when logged in via The Grind) see upcoming events. Admins can manage venues, sports, images, and display order.

### Architecture

```
Browser (Vercel)
    │  VITE_API_URL
    ▼
nginx on GCP VM (courts.api.theground.io)
    ├── /api/...         → courts-api-prod   (:3001)
    └── /staging/api/... → courts-api-staging (:3002)
            │
            ├── Cloud SQL (MySQL) — venues, sports
            ├── GCS (courts-image-bucket) — photos, icons, pricing images
            └── The Grind API — user auth, public events
```

| Layer | Tech |
|-------|------|
| Frontend | Vue 3, TypeScript, Tailwind, Vue Router, PWA |
| Backend | Node.js, Express (`server/index.js`) |
| Database | Google Cloud SQL (MySQL) |
| Images | Google Cloud Storage |
| Maps | Google Maps JavaScript API |
| User auth | The Grind backend (OAuth, login, register) |

---

## 2. Public features (all users)

### 2.1 Explore

- **Map view** (desktop & mobile): Google Maps with custom venue pins (org icons from GCS).
- **List view** (mobile): swipe between map and card list.
- **Search**: text search across venue names and details.
- **Filters**:
  - Sport type (multi-select)
  - MTR station
  - Walking distance
  - Special offer (venues with membership enabled)
  - Saved only (logged-in or local saved list)
- **Pin clustering**: clicking a pin can filter the list to venues at that location.
- **Language**: English / 中文 (toggle in header).
- **Dark mode**: persisted in `localStorage`.

### 2.2 Venue detail (`/venues/:slug`)

Each venue page shows:

| Section | Details |
|---------|---------|
| Photos | Image carousel (up to 12 images from GCS) |
| Basic info | Name, address, MTR station & exit, walking distance |
| Sports | Tags for supported sport types |
| Pricing | Text or image pricing |
| Amenities | List of facilities |
| Operating hours | Weekly schedule, public holiday rules, notes |
| Court count | Number of courts (if set) |
| Membership | Description + join link (if enabled) |
| Booking | External booking URL button |
| Contact | WhatsApp, social links (Instagram, Facebook, X, Threads, YouTube, website) |
| Upcoming events | Events from The Grind (when venue has company ID) |
| Navigation | Prev/next venue within current filter |
| Save | Heart icon to save venue locally |

**SEO**: dynamic meta tags and Open Graph per venue (`lib/venueOgMeta.js`). After shipping public features, follow [SEO_AFTER_FEATURE.md](./SEO_AFTER_FEATURE.md).

### 2.3 Saved venues

- **Saved tab**: venues bookmarked via heart icon.
- Stored in browser `localStorage` (no account required).

### 2.4 Sport search routes

- `/search/:sport` — filtered explore view for a sport slug.

### 2.5 PWA

- Installable web app (manifest, service worker via `vite-plugin-pwa`).
- Offline-friendly shell; data requires network.

---

## 3. User authentication (The Grind)

End-user login integrates with **The Grind** (`api.thegrind-app.com`).

### Routes

| Path | Purpose |
|------|---------|
| `/login` | Email/password login |
| `/signup` | Registration |
| `/token-login` | OAuth callback token handoff |
| `/auth/google/callback` | Redirects to token-login |
| `/complete-phone` | Phone number completion after OAuth |

### Auth flow

- Tokens stored in `localStorage` (`theground_access_token`, `theground_refresh_token`).
- Session refresh via `/api/user/auth/refresh`.
- Google sign-in: `/api/user/auth/google/start` → callback → frontend token login.

### Env

| Variable | Purpose |
|----------|---------|
| `VITE_API_URL` | Courts API base (auth proxied through it) |
| `VITE_THE_GRIND_API_URL` | Optional override for auth base |
| `THE_GRIND_BACKEND_URL` | Server-side Grind API (VM env) |

---

## 4. Admin features

### 4.1 Admin types

| Type | Login | Access |
|------|-------|--------|
| **Super admin** | Global password (`SUPER_ADMIN_PASSWORD` on server) | All venues, all sports, create/delete |
| **Court admin** | Per-venue `admin_password` | Edit only assigned venue(s) |

Admin session: cookie `courts_admin_session` (12-hour TTL).

### 4.2 Admin panel (`/admin`, `/admin/manage`)

- List venues (filtered by sport for super admin).
- Add / edit / delete venues (permissions apply).
- Drag-and-drop **venue sort order** (global or per-sport); saved via `PATCH /api/venues/order`.
- **Sport management** (super admin): add, rename (EN/ZH), delete sport types.

### 4.3 Venue form (create & edit)

| Field | Notes |
|-------|-------|
| Name, description | Rich HTML description |
| Address, coordinates | Google Maps pin picker |
| MTR station & exit | HK MTR station list |
| Walking distance | Minutes from station |
| Ceiling height | Meters |
| Starting price | HKD |
| Pricing | Text (rich HTML) or image (uploaded to GCS `pricing/`) |
| Photos | Up to 12 images, max 2MB each → GCS `venues/` |
| Org icon | Map pin icon → GCS `org-icons/` |
| Amenities | Multi-value list |
| WhatsApp | Contact number |
| Social links | Instagram, Facebook, X, Threads, YouTube, website |
| Sports | Multi-sport assignment with per-venue sort order |
| Court admin password | Per-venue admin access |
| Membership | Enable + description + join link |
| Court count | Integer |
| Booking URL | External link |
| Operating hours | Weekly slots, public holiday mode, timezone, notes |
| Operating hours enabled | Toggle display on detail page |

**Image upload flow**: browser sends base64 → API uploads to GCS → stores HTTPS URL in DB. Never stores large base64 in MySQL.

---

## 5. API reference

Base URLs:

- Production: `https://courts.api.theground.io`
- Staging: `https://courts.api.theground.io/staging`

### Venues

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/venues` | List all venues |
| POST | `/api/venues` | Create venue (uploads images to GCS) |
| PUT | `/api/venues/:id` | Update venue |
| PATCH | `/api/venues/order` | Reorder venues `{ orderedIds, sportId? }` |
| DELETE | `/api/venues/:id` | Delete venue |

### Sports

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/sports` | List sports |
| POST | `/api/sports` | Create sport |
| PUT | `/api/sports/:id` | Update sport |
| DELETE | `/api/sports/:id` | Delete sport |

### Admin auth

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Admin login |
| GET | `/api/auth/session` | Admin session check |
| POST | `/api/auth/logout` | Admin logout |

### User auth (The Grind proxy)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/user/auth/login` | Login |
| POST | `/api/user/auth/register` | Register |
| GET | `/api/user/auth/session` | Session |
| POST | `/api/user/auth/complete-phone` | Complete phone |
| POST | `/api/user/auth/refresh` | Refresh token |
| GET | `/api/user/auth/google/start` | Google OAuth |
| GET | `/api/user/auth/google/callback` | Google callback |
| POST | `/api/user/auth/logout` | Logout |

### Other

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/events/public` | Aggregated public events (cached 90s) |
| GET | `/api/image-proxy?url=` | Proxy GCS images (CORS workaround) |

---

## 6. Infrastructure & deployment

### 6.1 Frontend (Vercel)

Static Vite build only. See [DEPLOY_VERCEL.md](../DEPLOY_VERCEL.md).

| Vercel env | Production | Preview |
|------------|------------|---------|
| `VITE_API_URL` | `https://courts.api.theground.io` | `https://courts.api.theground.io/staging` |
| `VITE_GOOGLE_MAPS_API_KEY` | required | required |

Redeploy after changing env vars (baked in at build time).

### 6.2 Backend (GCP VM)

See [VM_SERVER_UPDATE.md](./VM_SERVER_UPDATE.md).

| | Staging | Production |
|---|---------|------------|
| Service | `courts-api-staging` | `courts-api-prod` |
| Port | **3002** | **3001** |
| Code folder | `/opt/courts-new` | `/opt/courts-new` |
| Env file | `/etc/courts/staging.env` | `/etc/courts/prod.env` |

**Deploy prod:**

```bash
cd /opt/courts-new
git pull && npm ci
sudo systemctl restart courts-api-prod
```

### 6.3 Required server env vars

```bash
PORT=3001              # prod (3002 for staging)
HOST=127.0.0.1

MYSQL_HOST=...
MYSQL_PORT=3306
MYSQL_USER=...
MYSQL_PASSWORD='...'   # quote if special chars
MYSQL_DATABASE=courts-db

GCS_BUCKET_NAME=courts-image-bucket
THE_GRIND_BACKEND_URL=https://api.thegrind-app.com
COURTS_FRONTEND_URL=https://courts.theground.io
SUPER_ADMIN_PASSWORD=...   # optional, has default in code
```

**Do not set** `PROXY_SECRET` when the browser calls the API directly (causes 401).

### 6.4 Images (GCS)

- Bucket: `courts-image-bucket`
- Folders: `venues/`, `org-icons/`, `pricing/`
- VM service account needs **Storage Object Creator**
- Map icons CORS: [GCS_MAP_ICONS.md](./GCS_MAP_ICONS.md)

**Health check on VM:**

```bash
cd /opt/courts-new
sudo bash scripts/check-gcs-upload.sh /etc/courts/prod.env
```

### 6.5 Database migrations

SQL scripts in `scripts/`:

| Script | Purpose |
|--------|---------|
| `add-sports-name_zh.sql` | Chinese sport names |
| `migrate-sports-venue_sports.sql` | Multi-sport venues |
| `add-venue-membership.sql` | Membership fields |
| `add-membership-settings.sql` | Membership settings |
| `add-venues-admin_password.sql` | Court admin passwords |
| `add-venues-court_count.sql` | Court count |
| `add-venues-operating-hours-booking-url.sql` | Hours & booking |
| `add-venues-operating-hours-enabled.sql` | Hours toggle |

---

## 7. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| 502 Bad Gateway | Prod API down | `sudo systemctl status courts-api-prod` |
| `EADDRINUSE :3002` on prod | `prod.env` has wrong PORT | Set `PORT=3001` in prod.env |
| Prod not updated after `git pull` | Wrong WorkingDirectory | `systemctl cat` → must be `/opt/courts-new` |
| `GCS upload error` | Bad credentials or permissions | Remove stale `api/*.json`; check VM SA on bucket |
| Save OK but `images: []` | GCS upload failed silently | Check `journalctl` for GCS errors |
| `401` from API | `PROXY_SECRET` set | Remove from env file |
| Map icons missing | GCS CORS | See GCS_MAP_ICONS.md or image-proxy fallback |
| Preview has no data | Wrong `VITE_API_URL` | Preview → `/staging` URL, redeploy |
| `MYSQL_PASSWORD: command not found` | Unquoted password in env | Use `MYSQL_PASSWORD='...'` |

### Useful commands

```bash
sudo systemctl status courts-api-staging courts-api-prod
sudo ss -tlnp | grep -E '3001|3002'
sudo journalctl -u courts-api-prod -n 30 --no-pager
curl -s http://127.0.0.1:3001/api/sports | head
```

---

## 8. Project structure

```
court/
├── src/                    # Vue frontend
│   ├── components/
│   │   ├── admin/          # AdminPage, VenueForm
│   │   ├── auth/           # Login, signup, OAuth
│   │   ├── explore/        # Map, list, cards
│   │   ├── venue/          # Detail, upcoming events
│   │   └── layout/         # Header, footer, nav
│   ├── composables/        # auth, grind events
│   └── utils/              # API URL, SEO, translations
├── server/
│   ├── index.js            # Express API
│   └── run-local.js        # Entry point
├── scripts/                # SQL migrations, GCS tools
├── docs/                   # This documentation
├── db.ts                   # Frontend API client
└── DEPLOY_VERCEL.md
```
