# North Eastern Region (NER) Landslide Early-Warning — Problem Statement & Coverage Map

This document records the problem statement as given, and maps each requirement
to what exists in this codebase today vs. what is a documented gap/assumption.
Keep this file next to `supabase_schema.sql` so anyone picking up the project
can see, at a glance, what's real and what's a hackathon-stage placeholder.

## Problem Statement (as provided)

The North Eastern Region (NER) frequently faces landslides, flash floods, road
blockages, and slope failures due to heavy rainfall, fragile terrain, and
unplanned hill cutting. These incidents often disrupt connectivity, damage
infrastructure, delay emergency response, and isolate remote villages for
days. Currently, monitoring of vulnerable zones is mostly reactive and
dependent on manual reporting. There is limited use of real-time predictive
systems for identifying high-risk zones and issuing early warnings to
authorities and local communities. With increasing climate vulnerability in
the region, there is a need for an AI-enabled real-time monitoring and
prediction system that can help authorities take preventive action before
disasters occur.

**Description.** An AI-powered early warning and monitoring platform capable
of predicting and tracking landslide-prone areas in real time across NER:

- a. Collect and analyse rainfall patterns, soil moisture sensors, satellite
  imagery, terrain/slope data, historical landslide records.
- b. Use AI/ML models to identify high-risk zones and predict landslide events.
- c. Provide real-time alerts to district administrations, disaster
  management authorities, and local communities.
- d. Integrate GIS mapping for visualization of vulnerable roads, villages,
  and infrastructure.
- e. Allow citizens/field officials to upload geo-tagged photos/videos of
  cracks, slope movement, or blocked roads.
- f. Dashboards showing risk severity, road connectivity status,
  weather-linked forecasts, and emergency response prioritisation.
- g. Multilingual notifications and low-network/offline functionality.

**Expected solution:** real-time GIS dashboard + risk heatmaps, AI/ML
predictive engine, mobile/web field-reporting app, IMD/satellite/sensor
integration, automated SMS/app alerts, cloud architecture with offline sync.

## Coverage Matrix

| Requirement | Status | Implementation | Notes / Assumptions |
|---|---|---|---|
| a. Rainfall + soil moisture ingestion | **Partial** | `landslide_zones.rainfall_mm_24h`, `.soil_saturation_percent`, updated via `PATCH /api/landslide/zones/:id/telemetry` | ASSUMPTION: telemetry is pushed by a caller (sensor gateway or admin), not pulled from a real IMD/sensor feed yet. Wiring a real feed means a scheduled job calling this same PATCH endpoint. |
| a. Satellite imagery | **Not implemented** | — | Flagged gap. No satellite ingestion pipeline exists; `landslide_zones` has no imagery column. Would need a separate ingestion service + a `satellite_snapshots` table keyed by zone + timestamp. |
| a. Terrain/slope data | **Done** | `landslide_zones.slope_angle_deg` | Static per zone; real deployment would source from a DEM (digital elevation model) instead of manual entry. |
| a. Historical landslide records | **Done** | `landslide_zones.historical_incidents_5yr`, `landslide_ground_reports` | |
| b. AI/ML risk prediction | **Partial (rule-based, not ML)** | `computeRisk()` in `routes/landslide.js` — weighted formula (rainfall 40%, slope 25%, saturation 25%, history 10%) | ASSUMPTION: this is a transparent, tunable placeholder ("IDRMS Weighted Risk Index v1"), not a trained model. It was deliberately kept rule-based and dependency-free so a real ML/ensemble model can be swapped in later without changing the API shape (`risk_score`, `risk_level`, `model` fields stay the same). |
| c. Real-time alerts | **Done (in-app)** | `GET /api/landslide/alerts`, `GET /api/disasters/alerts` | Gap: no SMS/push delivery — see "Expected Solution" gaps below. |
| d. GIS mapping | **Done** | Leaflet map per-module (`/api/disasters`, `/api/landslide/zones`) **plus new unified `GET /api/livemap`** aggregating all geo layers in one call | See "Live Map API" section below. |
| e. Geo-tagged citizen/field uploads | **Done** | `POST /api/field-reports` (citizens), `POST /api/landslide/reports` (field officials) | Photos now upload to Supabase Storage when configured (see "Media Storage" below), local disk otherwise. |
| f. Dashboards | **Partial** | System summary (`/api/system/summary`), sponsor/relief dashboards, landslide risk grid | Road-connectivity-specific status and "emergency response prioritisation" scoring are not separately modeled — currently inferred from disaster `severity` + `affected_population`. |
| g. Multilingual notifications | **Not implemented** | — | Flagged gap. All UI copy and alert text is English-only. |
| g. Low-network/offline functionality | **Partial** | LoRaWAN offline mesh simulation (`/api/lorawan/*`) models SOS packets during outages | This is a **simulation** of an offline radio mesh for demo purposes, not real LoRaWAN hardware integration. Every write in this project (via `insertRecordAsync`/`updateRecordAsync`) already falls back to local JSON automatically if Supabase is unreachable, which is the same fail-open pattern the offline requirement needs. |
| Cloud architecture w/ offline sync | **Partial** | Supabase Postgres + Storage when configured; local JSON file + local disk fallback otherwise | ASSUMPTION: "offline sync" here means graceful degrade-and-retry-later on the server, not a full client-side offline-first mobile app with a local queue/sync engine. Building that is a separate mobile-app-level effort. |
| IMD weather API integration | **Done** | `server/routes/weather.js` — live OpenWeatherMap when `OPENWEATHER_API_KEY` is set, simulated telemetry otherwise | ASSUMPTION: uses OpenWeatherMap, not IMD's own API, since IMD doesn't expose a public developer API with an equivalent free tier. Swap the fetch URL in `weather.js` if an IMD feed becomes available. |
| Automated SMS alerts | **Not implemented** | — | Flagged gap. Would need an SMS gateway integration (e.g. Twilio, or an Indian aggregator like MSG91/Karix for NER carrier coverage) triggered from `POST /api/disasters/alerts` and `GET /api/landslide/alerts`. |

## What changed in this pass ("fix all APIs")

Several routes previously bypassed the Supabase-aware data layer in `db.js`
and read/wrote the local JSON file directly and **only**, even when Supabase
credentials were configured — meaning users, disasters, shelters, volunteers,
and landslide data would silently never reach Supabase. These were converted
to the same Supabase-first / local-fallback pattern already used by
`sponsors.js`, `field-reports.js`, and `policies.js`:

- `server/routes/auth.js` — register/login/me/users now go through Supabase's
  `users` table (via new `findByFieldAsync`/`insertRecordAsync` helpers)
  instead of only the local JSON file.
- `server/routes/disasters.js`, `shelters.js`, `volunteers.js`,
  `landslide.js` — all GET/POST/PATCH endpoints now use
  `getCollectionAsync` / `insertRecordAsync` / the new `updateRecordAsync`.
- `server/routes/lorawan.js` — message/alert writes now also go through
  `insertRecordAsync` (still falls back locally instantly, preserving the
  offline-mesh guarantee) instead of the local-only file.
- `server/db.js` — added `updateRecordAsync()` (generic Supabase-or-local
  record update by id) and `findByFieldAsync()` (single-record lookup by an
  arbitrary column, used for email login lookups).

## Media Storage (Supabase Storage for uploaded images)

Sponsor equipment/delivery-proof photos, landslide ground-report photos, and
citizen field-report photos previously saved **only** to local disk
(`public/uploads/...`) via `multer.diskStorage`, regardless of Supabase
config. This doesn't survive redeploys on most hosts and isn't shared across
multiple server instances.

New: `server/lib/mediaStorage.js` uploads the file buffer to Supabase Storage
(bucket `idrms-media` by default, override with `SUPABASE_MEDIA_BUCKET`) and
returns a public URL, automatically falling back to the old local-disk
behavior if Supabase Storage isn't configured or the upload fails. Wired into:

- `POST /api/sponsors/equipment` (equipment photo)
- `POST /api/sponsors/equipment/:id/verify` (delivery proof photo)
- `POST /api/landslide/reports` (ground observation photo)
- `POST /api/field-reports` (citizen/field hazard photo)

Run the storage bucket + policy statements at the bottom of
`supabase_schema.sql` once in the Supabase SQL editor to enable this.
ASSUMPTION: bucket is public-read (dashboards show `<img>` tags directly with
no signed-URL step) — switch to `createSignedUrl()` in `mediaStorage.js` if
these photos need to be access-controlled instead.

## Login / Authentication backend

`server/routes/auth.js` already did its own password hashing (bcrypt) + JWT
issuance — this is **not** Supabase Auth (no `supabase.auth.signUp`/`signIn`).
ASSUMPTION: kept it this way rather than migrating to Supabase Auth, because
switching would change the token format the frontend (`public/js/app.js`)
expects and would require an email-confirmation flow decision. What *was*
missing — and is now fixed — is that the `users` table lives in Supabase
Postgres (schema already existed in `supabase_schema.sql`) but the app never
actually read/wrote it; it silently used the local JSON file even with
Supabase configured. That's corrected above. If real Supabase Auth
(magic links, social login, RLS-per-user) is wanted instead of this
custom JWT approach, that's a bigger follow-up — flag it and we can scope it
separately.

## Live Map API

New endpoint: **`GET /api/livemap`** (optionally `?layers=disasters,landslide_zones,...`)
returns every geo-located entity — active disasters, NER landslide risk
zones (with live-computed risk score), shelters, hospitals, volunteers,
citizen field reports, and sponsor equipment delivery points — as one flat
list of point features, so a single map component can render the whole
"current live map" instead of stitching together 6+ separate fetches.
ASSUMPTION: "live" means short-interval polling (`recommended_poll_interval_seconds: 30`
in the response) rather than a websocket/SSE push; the tables already live in
Postgres so Supabase Realtime channels are a natural upgrade path if
sub-second updates are needed later.

## Open follow-ups (explicitly out of scope for this pass)

1. Real ML/predictive model to replace the rule-based risk index.
2. Satellite imagery ingestion + storage.
3. SMS/push delivery for alerts (currently in-app/API only).
4. Multilingual UI + notification templates.
5. A true offline-first mobile client with local write queue (server-side
   fail-open to local JSON is not the same as client-side offline capture).
