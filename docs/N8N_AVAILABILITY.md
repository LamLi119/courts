# n8n availability for Courts Finder

Courts Finder loads **live bookable slots** via your **n8n Production Webhook**. The GCP Express API is **not** changed.

Only venues listed in `src/components/availability/venueAvailabilityConfig.ts` show the **Available to book** tab (currently **venue id `4`** → 212HK facility `1347`).

## Architecture

```text
Browser (Vercel)
  GET /api/venues/4/availability?date=2026-05-27&days=7
       ↓
  Vercel function api/venues/[id]/availability.ts
       ↓
  n8n Production Webhook (?venueId=4&date=2026-05-27&days=7)
       ↓
  212HK API → your Code node → JSON back to app
```

Local dev (optional): set `VITE_N8N_AVAILABILITY_WEBHOOK_URL` in `.env` to call n8n directly.

---

## Part 1 — Build the n8n workflow

### Step 1: Create workflow

1. Open n8n → **Workflows** → **Add workflow**.
2. Name: `Courts-AvailableTime-Webhook`.

### Step 2: Webhook trigger (replaces Manual Trigger)

1. Add node **Webhook**.
2. **HTTP Method**: `GET`.
3. **Path**: `courts-availability` (you will get a URL like `https://<host>/webhook/courts-availability`).
4. **Authentication**: None (or Header Auth if you prefer).
5. **Response mode**: `Using 'Respond to Webhook' Node`.

Copy the **Production URL** — you need it for Vercel env `N8N_AVAILABILITY_WEBHOOK_URL`.

Optional secret: you will check query `secret` in a Code node (see Step 3).

### Step 3: Code — resolve venue + date

Add **Code** node after Webhook. Name: `Resolve venue`.

```javascript
const query = $json.query || {};
const secret = (query.secret || '').toString();
const expected = 'YOUR_LONG_SECRET'; // match N8N_WEBHOOK_SECRET on Vercel
if (expected && secret !== expected) {
  return [{ json: { supported: false, error: 'Unauthorized', courts: [], date: query.date || '' } }];
}

const venueId = Number(query.venueId);
const date_dash = (query.date || '').toString().trim();

if (!/^\d{4}-\d{2}-\d{2}$/.test(date_dash)) {
  return [{ json: { supported: false, error: 'Invalid date', courts: [], date: date_dash } }];
}

// Add more venues here — same pattern as Courts Finder venueAvailabilityConfig.ts
const VENUES = {
  4: { facilityId: 1347, provider: '212hk' },
};

const cfg = VENUES[venueId];
if (!cfg) {
  return [{ json: { supported: false, date: date_dash, courts: [], venueId } }];
}

return [{
  json: {
    supported: true,
    venueId,
    date_dash,
    facilityId: cfg.facilityId,
    provider: cfg.provider,
  },
}];
```

### Step 4: IF — supported?

- **IF** node: `{{ $json.supported }}` is true.
- **False** branch → go to **Respond to Webhook** (unsupported JSON).

### Step 5: HTTP Request (212HK)

On the **true** branch, add **HTTP Request** (reuse your existing settings):

- **Method**: GET  
- **URL**:
  ```text
  https://book.212hk.com/api/facilities/{{ $json.facilityId }}/courts_reservations_for_players?date={{ $json.date_dash }}
  ```

### Step 6: Code — transform slots (your existing logic)

Paste the same **Code in JavaScript** from `Courts-AvailableTime.json` (the loop over `meta` + `courts_with_reservations`).

Output per item: `{ date: "20260527", courts: [{ court_id, court_name, available_hours: [{start,end}] }] }`.

### Step 7: Code — format for Courts Finder app

Add **Code** node: `Format response`.

```javascript
const resolved = $('Resolve venue').first().json;
const transformed = $input.first().json;
const dateDash = resolved.date_dash;

function formatHm(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Hong_Kong',
  });
}

const compact = dateDash.replace(/-/g, '');
let day = transformed;

if (Array.isArray(transformed)) {
  day = transformed.find((d) => String(d.date) === compact) || transformed[0];
}

const courts = (day.courts || []).map((c) => ({
  courtId: c.court_id,
  courtName: c.court_name,
  slots: (c.available_hours || []).map((h) => ({
    start: formatHm(h.start),
    end: formatHm(h.end),
  })),
}));

return [{
  json: {
    supported: true,
    date: dateDash,
    timezone: 'Asia/Hong_Kong',
    provider: resolved.provider || '212hk',
    courts,
  },
}];
```

### Step 8: Respond to Webhook

Add **Respond to Webhook**:

- **Respond With**: JSON  
- **Response Body**: `{{ $json }}`

Connect:

- `Format response` → `Respond to Webhook`
- IF false (unsupported) → `Respond to Webhook` with static body:
  ```json
  { "supported": false, "date": "={{ $('Resolve venue').item.json.date_dash }}", "courts": [] }
  ```

### Step 9: Activate

1. **Save** workflow.  
2. Toggle **Active** (top right).  
3. Test in browser or curl:

```bash
curl "https://YOUR-N8N-HOST/webhook/courts-availability?venueId=4&date=2026-05-27&days=7&secret=YOUR_LONG_SECRET"
```

You should get JSON with `days[].courts[].slots[]` (or a top-level array of day objects).

---

## Part 2 — Vercel environment variables

In Vercel → Project → Settings → Environment variables:

| Variable | Example |
|----------|---------|
| `N8N_AVAILABILITY_WEBHOOK_URL` | `https://your-n8n-host/webhook/courts-availability` |
| `N8N_WEBHOOK_SECRET` | same string as in n8n `Resolve venue` node |

Redeploy after saving.

---

## Part 3 — Local development

**Option A — call n8n directly** (easiest if Express has no availability route)

In `.env`:

```env
VITE_N8N_AVAILABILITY_WEBHOOK_URL=https://your-n8n-host/webhook/courts-availability
VITE_N8N_WEBHOOK_SECRET=YOUR_LONG_SECRET
```

`npm run dev` → open venue **4** detail → tab **Available to book**.

**Option B — use Vercel preview**

Set `VITE_API_URL` to your Vercel preview URL so `/api/venues/4/availability` hits the Vercel proxy.

---

## Part 4 — Add another venue later

1. In n8n `Resolve venue` → add to `VENUES` map (facility id, provider).  
2. In `src/components/availability/venueAvailabilityConfig.ts` → add venue id to `AVAILABILITY_VENUE_IDS`.  
3. No Express changes.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `N8N_AVAILABILITY_WEBHOOK_URL is not configured` | Set env on Vercel and redeploy |
| 401 Unauthorized | Match `secret` query param in n8n and Vercel |
| Empty courts | Check 212HK URL / date; run HTTP node alone in n8n |
| CORS error in local dev | Use `VITE_N8N_*` or Vercel proxy, not Express :3001 |
| Live Vercel site calls `http://…:5678/webhook` directly | Remove `VITE_N8N_*` from Vercel; set `N8N_AVAILABILITY_WEBHOOK_URL` only. Redeploy. |
| Tab not visible | Venue id must be in `AVAILABILITY_VENUE_IDS` (only `4` now) |

Reference: your original export `docs/reference/Courts-AvailableTime.json`.
