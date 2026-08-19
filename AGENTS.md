# Agent handoff — Wu-Viz / Divvy

Practical notes for coding agents working on Divvy ingestion and visualization in this repo. Prefer this file over rediscovering pipeline behavior from scratch.

For the complete conversation handoff (completed work, UI architecture,
verification, known notes, and a copyable next-session prompt), read
[`HANDOFF.md`](HANDOFF.md).

## Project

**Wu-Viz** (`stats-journal`) — React/TypeScript portfolio with UChicago/Hyde Park Divvy analytics. Frontend charts and pages; Postgres-backed historical trip data via the Phase A importer.

- App: React + Vite + Tailwind CSS + shadcn/ui + Recharts + Leaflet
- Package name: `wu-viz`
- Sibling analysis repo (original SQL/filter ideas): `/Users/edwardwu/github/projects/Uchicago-divvy-analysis`
- Longer plan (optional): `/Users/edwardwu/.cursor/plans/divvy_history_pipeline_e0bf059a.plan.md`

## Phases

### Phase A — Historical S3 importer (complete)

Official Divvy S3 trip-archive importer for **UChicago/Hyde Park only**. Downloads public ZIPs, normalizes schemas, filters to the study zone, writes idempotent rows to Postgres.

All **94/94** official archives are imported and validated. See **Status snapshot** below.

### Phase B — Maps / replay / live / context (complete except routed replay)

| Feature | Status |
|---------|--------|
| Station map (median centroids, map-quality coords only) | Done |
| Demo-day station-to-station replay (3 curated days) | Done |
| Live GBFS station inventory toggle | Done |
| Period year/month/day filters + rich metrics | Done |
| COVID + weather analysis | Done |
| Next-archive-month forecast | Done |
| Academic calendar overlay on pulse + Calendar section | Done — `config/uchicago-academic-calendar.json` (2025–26) |
| OD pair hover → start/end points on the map | Done |
| Ridership 2020+ (e-bike era) + estimated member savings | Done — `config/divvy-fares.json` |
| OD flow arcs | Removed (user preference) |
| Routed bike-path replay | **Deferred** — do not pick OSRM/Valhalla/Mapbox unless asked |

## Study zone

Both trip endpoints must fall inside these bounds (config is source of truth):

| Bound | Value |
|-------|--------|
| lat | `41.78405419311528` → `41.80224207377386` |
| lng | `-87.60641021421114` → `-87.57517423508772` |

Config: [`config/uchicago-zone.json`](config/uchicago-zone.json)

Modern rows use coordinates; older schemas without coordinates use the station name list / aliases in that file.

**Map / replay** further drop coarse 0.01° dockless GPS and out-of-zone points. **Estimated miles** are haversine when all four coordinates exist (Divvy did not publish lat/lng until 2020, so 2013–2019 show “No miles”).

## Commands

```bash
npm run divvy:migrate
npm run divvy:discover
npm run divvy:import -- --all          # full backfill of missing archives
npm run divvy:import -- --latest       # newest published archive only
npm run divvy:import -- --archive <key>
npm run divvy:import -- --retry-failed
npm run divvy:import -- --dry-run      # parse/filter only; no DB writes
npm run divvy:status
npm run divvy:validate
npm run divvy:test
npm run generate-data                  # needs Postgres + network (Open-Meteo)
npm run divvy:forecast-learn           # educational linear ML forecast lab
```

Requires Postgres + root `.env` (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`). See README “Divvy historical ingestion”.

## Key paths

| Path | Role |
|------|------|
| `scripts/divvy/*` | Discover, migrate, import, validate, status, schema adapters, zone filter, forecasts, fares |
| `scripts/sql/001_divvy_ingestion.sql` | Ingestion schema / migration SQL |
| `scripts/sql/002_divvy_analysis_ready.sql` | Analysis view + combined-quarter metadata correction |
| `scripts/generate-analytics.js` | Batch aggregates analysis view into static frontend JSON |
| `config/uchicago-zone.json` | Zone bounds + station names/aliases |
| `config/uchicago-academic-calendar.json` | UChicago 2025–26 term/break/exam dates for overlay |
| `config/divvy-fares.json` | 2020–present walk-up vs member fare schedule for savings |

**Tables this pipeline owns:** `divvy_uchicago_trips`, `divvy_import_runs`

**Do not truncate** existing `uchicago_trips`, `divvy_trips`, or dashboard/analytics aggregate tables without explicit user approval. This importer does not modify those tables.

Use `divvy_uchicago_trips_analysis` for standard analysis. It retains trips
from 15 seconds through 24 hours and adds derived time, duration, and metadata
completeness fields. Keep `divvy_uchicago_trips` as the lossless normalized
source table.

## Data sources

| Source | URL | Use |
|--------|-----|-----|
| Historical | https://divvy-tripdata.s3.amazonaws.com/ | Official public ZIPs — **not scraping** |
| Live GBFS | https://gbfs.divvybikes.com/gbfs/2.3/gbfs.json | Station inventory only — **not trip GPS** |
| Weather | https://archive-api.open-meteo.com | Hyde Park daily temp/precip for analytics |

Open historical data has start/end + times only; no turn-by-turn rider GPS. Do not scrape Divvy/Lyft apps for tracks.

## Status snapshot

Checked via `npm run divvy:status` / `divvy:validate` / `generate-data` (**2026-08-18**). Re-run for live numbers.

| Metric | Value |
|--------|--------|
| Discovered archives | 94 |
| Successful imports | 94 |
| Missing archives | 0 |
| Failed imports | 0 |
| Running imports | 0 |
| UChicago trips | 1,245,326 |
| Analysis-ready trips | 1,236,135 |
| Trip range | 2013-07-01 → 2026-07-31 |
| Next forecast month | 2026-08 |
| Validation | Passed |

All official S3 archives are downloaded and ingested. Verbose 2018-Q1 / 2019-Q2 headers (`01 - Rental Details …`) are handled in `schema-adapters.js`. Standard analysis should use `divvy_uchicago_trips_analysis` (15s–24h filter).

## What to do next

1. Incremental updates: `npm run divvy:import -- --latest`, validate, then `npm run generate-data` (score prior forecast vs new month).
2. Prefer extending `scripts/divvy/schema-adapters.js` for new CSV layouts over one-off parse hacks.
3. Optional: extend `config/uchicago-academic-calendar.json` beyond 2025–26.
4. Routed path replay / new routing providers — only when explicitly asked.

## What not to do

- Do not scrape Divvy websites/apps or invent trip GPS.
- Do not truncate or rewrite `uchicago_trips` / analytics tables without asking.
- Do not disrupt a running `divvy:import` process.
- Do not wire OSRM/Valhalla/Mapbox unless the user requests it.
- Do not commit unless the user explicitly asks.
