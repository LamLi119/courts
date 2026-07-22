---
name: Venue Excel Import
overview: Add admin-side Excel export and re-import for venues using a single workbook format that can round-trip venue fields, sport ordering, and image metadata while reusing the existing GCS-backed venue save pipeline.
todos:
  - id: model-image-metadata
    content: Add a backward-compatible venue image data model that supports URL, description, and order.
    status: pending
  - id: server-bulk-helpers
    content: Refactor server venue save logic into reusable helpers shared by single-item and bulk import flows.
    status: pending
  - id: excel-endpoints
    content: Add super-admin Excel export/import endpoints with workbook parsing, validation, and venue updates by id.
    status: pending
  - id: admin-ui-actions
    content: Add admin export/import controls and import result feedback in the admin panel.
    status: pending
  - id: verify-roundtrip
    content: Verify end-to-end workbook round-trip for venue fields, sports ordering, and image metadata; then update docs.
    status: pending
isProject: false
---

# Venue Excel Import/Export Plan

## Goal
Build an admin feature that exports all venues into an Excel workbook (`.xlsx`, with import support for `.xlsx`/`.xls`/`.xlsm`) and can re-import the same workbook to update existing venues by `id`.

## Current code to leverage
- [`src/components/admin/VenueForm.vue`](src/components/admin/VenueForm.vue): already models the editable venue shape, including `pricing`, `images`, `sport_data`, `membership_*`, `operating_hours`, and local image reordering.
- [`db.ts`](db.ts): already has `rowToVenue()` and `upsertVenue()` that convert between API rows and app `Venue` objects.
- [`server/index.js`](server/index.js): already accepts venue create/update payloads, normalizes `pricing`, uploads `orgIcon` and `images` data URLs to GCS, and persists `sport_data` order through `syncVenueSportsPreservingOrder()`.
- [`types.ts`](types.ts): defines the canonical `Venue`, `Pricing`, `OperatingHours`, and `VenueSport` types to mirror in spreadsheet parsing.

## Workbook design
Use one workbook with multiple sheets so the format is stable and round-trippable:

- `venues`
  - One row per venue.
  - Includes `id` as the required update key.
  - Includes scalar/core fields: name, address, MTR, coordinates, pricing mode/text/image URL, membership fields, booking URL, `sort_order`, court count, operating-hours enabled, etc.
  - Includes structured JSON/text columns for rich fields that do not fit well into flat columns, such as `description`, `amenities`, `socialLinks`, and `operating_hours`.
- `venue_images`
  - One row per venue image.
  - Columns: `venue_id`, `image_order`, `image_url`, `image_description`.
  - Also add a `image_key`/index column if needed so repeated imports preserve deterministic ordering.
- `venue_sports`
  - One row per venue sport assignment.
  - Columns: `venue_id`, `sport_id`, `sport_slug`, `sport_sort_order`.
- Optional `readme` sheet
  - Human instructions, allowed file types, required columns, and warnings that imports update existing venues by `id`.

This avoids overloading a single sheet with repeated image/sport columns and makes `.xls`/`.xlsm` parsing simpler.

## Backend/API changes
Add dedicated bulk import/export endpoints in [`server/index.js`](server/index.js):

- `GET /api/venues/export`
  - Super-admin only.
  - Load venues + sport data.
  - Serialize current DB state into workbook sheets.
  - Return as downloadable Excel file.
- `POST /api/venues/import`
  - Super-admin only.
  - Accept uploaded workbook.
  - Parse `venues`, `venue_images`, and `venue_sports` sheets.
  - Validate required columns and reject unknown/malformed rows with a useful error summary.
  - Match rows strictly by `id`.
  - For each venue, build the same logical payload shape used by existing single-venue save flow, then reuse the existing sanitize/normalize/update path as much as possible.

Implementation detail: extract shared server-side venue normalization/update logic from the current POST/PUT handlers into reusable helpers so bulk import does not duplicate image/pricing/org icon handling.

## Import behavior rules
Apply these rules in the importer:

- Existing venue must have a valid `id`; missing or unknown IDs are reported as errors unless you explicitly choose later to support creates.
- `venue_images` fully defines the final gallery for that venue on import:
  - image URLs are imported in order
  - image descriptions are stored alongside them
  - pricing image URL and org icon URL are imported from the main `venues` sheet
- If an image-related cell contains a GCS/public URL, keep it as-is.
- If later you want embedded Excel images uploaded to GCS, treat that as a second-phase enhancement because it requires workbook media extraction, row/image anchoring logic, and a new upload path; do not rely on that for the first shipping version.
- `venue_sports` becomes the source of truth for sport assignment and per-sport sort order.
- Global `sort_order` continues to come from the `venues` sheet.
- Preserve existing single-venue validations where practical so imported data cannot silently diverge from the admin form rules.

## Data model gap to address
The current public app stores venue gallery as `images: string[]` in [`types.ts`](types.ts) and `rowToVenue()` in [`db.ts`](db.ts) parses it as plain URL strings. There is no current persisted structure for per-image descriptions.

Before implementation, add a canonical image object shape, for example:

```ts
images: Array<{ url: string; description?: string | null }>
```

Then update:
- frontend parsing/serialization in [`db.ts`](db.ts)
- form state and UI in [`src/components/admin/VenueForm.vue`](src/components/admin/VenueForm.vue)
- server normalization in [`server/index.js`](server/index.js)
- any public gallery consumers such as [`src/components/ui/ImageCarousel.vue`](src/components/ui/ImageCarousel.vue) and venue detail rendering

Backward compatibility should accept legacy `string[]` rows and upgrade them in memory.

## Frontend/admin changes
Update the admin experience in [`src/components/admin/AdminPage.vue`](src/components/admin/AdminPage.vue):

- Add `Export venues` button to download the workbook.
- Add `Import venues` button with file picker for `.xlsx`, `.xls`, `.xlsm`.
- Show import result summary: updated count, skipped rows, row-level errors.
- Warn that import overwrites venue data by `id`.

Also extend [`db.ts`](db.ts) with bulk methods such as:
- `exportVenuesWorkbook()`
- `importVenuesWorkbook(file)`

## Libraries and file handling
Use an Excel library that can both generate and parse legacy Excel formats, most likely SheetJS (`xlsx`). Plan for:

- server-side workbook generation and parsing
- multipart upload handling for import endpoint
- MIME/extension validation for `.xlsx`, `.xls`, `.xlsm`

If the current server does not already handle multipart uploads, add a small upload middleware for workbook files only.

## Validation and rollout
- Add focused tests for workbook parse/serialize helpers and image-shape backward compatibility.
- Manually verify:
  - export workbook downloads correctly
  - import updates a venue by `id`
  - global `sort_order` changes persist
  - per-sport order changes persist
  - gallery order and descriptions round-trip correctly
  - pricing image and org icon URLs round-trip correctly
- Update docs:
  - [`docs/FEATURES.md`](docs/FEATURES.md) admin features/API section
  - [`docs/VM_SERVER_UPDATE.md`](docs/VM_SERVER_UPDATE.md) only if new env/deploy steps are needed

## Recommended implementation sequence
1. Add canonical image metadata model with backward-compatible parsing.
2. Extract reusable server helpers for venue normalization/update.
3. Implement workbook export serializer.
4. Implement workbook import parser + validation + bulk updater.
5. Add admin UI buttons and result messaging.
6. Update docs and run manual round-trip verification.