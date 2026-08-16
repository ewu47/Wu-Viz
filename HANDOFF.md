# WuViz / Divvy — conversation handoff

Last updated: **2026-08-15**

Use this document to start a new coding-agent conversation without repeating
ingestion, analytics, map, forecast, or UI work already completed.

## Copy this into a new conversation

> Continue work in `/Users/edwardwu/stats-journal`. Read `AGENTS.md`,
> `HANDOFF.md`, and `README.md` first. Phase A ingestion is complete. The Divvy
> UI now includes period filters, station map + demo-day replay, live GBFS,
> COVID/weather analysis, and a next-archive-month forecast. Academic calendar
> overlay is the preferred next UI feature (`config/uchicago-academic-calendar.json`
> already exists). Routing providers remain deferred. Do not truncate legacy
> tables or commit unless I ask. First run `git status`, `npm run divvy:validate`,
> `npm run lint`, and `npm run build:static-only` (or full `npm run build` if
> Postgres + network are available for `generate-data`).

## Current outcome

- All **94/94 official Divvy archives** imported and validated.
- Normalized source: **1,245,326** trips in `divvy_uchicago_trips`.
- Analysis view: **1,236,135** trips in `divvy_uchicago_trips_analysis`.
- Covered dates: **2013-07-01 → 2026-07-31**.
- Static export: `public/analytics.json` from the analysis view (needs Postgres;
  weather join needs network to Open-Meteo).
- UI: Tailwind + shadcn-style + Recharts + Leaflet map.
- Working tree may still be **uncommitted** — do not commit unless asked.

## Cleaning policy

Lossless source:

```text
divvy_uchicago_trips
```

Standard analysis:

```text
divvy_uchicago_trips_analysis
```

- Durations **15s–24h** only.
- Derived date/month/year/weekday/hour + metadata completeness flags.
- Chicago local wall-clock as `timestamp without time zone`.

## Pipeline & commands

```bash
npm run divvy:migrate
npm run divvy:discover
npm run divvy:import -- --latest    # after a new official archive
npm run divvy:validate
npm run generate-data               # DB + network (Open-Meteo weather)
npm run divvy:forecast-learn        # educational linear ML lab
npm run lint
npm run build:static-only           # UI only
npm run build                       # generate-data + tsc + vite
```

Requires root `.env`: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`.

### Key paths

| Path | Role |
|------|------|
| `scripts/divvy/*` | Import / validate / zone filter / schema adapters |
| `scripts/divvy/forecast-next-month.js` | Next-archive-month baseline forecast |
| `scripts/divvy/forecast-ml-learn.js` | Educational OLS forecast lab |
| `scripts/generate-analytics.js` | Batch → `public/analytics.json` |
| `scripts/sql/001_divvy_ingestion.sql` | Ingestion schema |
| `scripts/sql/002_divvy_analysis_ready.sql` | Analysis view |
| `config/uchicago-zone.json` | Study bounds + station names |
| `config/uchicago-academic-calendar.json` | UChicago 2025–26 terms (overlay foundation) |
| `src/components/DivvyProject.tsx` | Divvy page |
| `src/components/divvy/*` | Charts, map/replay, period controls |
| `src/services/api.ts` | Analytics TypeScript types |
| `src/services/gbfs.ts` | Live station inventory fetch |

**Owned tables:** `divvy_uchicago_trips`, `divvy_import_runs`  
**Do not truncate** legacy `uchicago_trips` / `divvy_trips` / old aggregates without approval.

## Analytics export contents

`public/analytics.json` includes (high level):

- `summary`, `monthly`, `yearly` — rich metrics (trips, member/casual, bike types,
  duration stats, after-dark, estimated haversine miles + coverage)
- `weekday_hour` + per-year in `by_year`
- Station rankings, OD routes, member/bike summaries
- `stations` / `stations_by_month` — map centroids (median of map-quality coords)
- `demo_days` — three curated days for station-to-station replay
- `covid` — pre (&lt; 2020-03-15) vs post (≥ 2020-07-01) summaries + hour patterns
- `weather` — Open-Meteo Hyde Park join: temp bins, wet/dry, monthly temp vs trips
- `forecast` — next month after latest trip (currently **2026-08**)
- `map_bounds`, `generated_at`

### Map-quality coordinates

Station map / demo replay / estimated miles ignore:

- name-only endpoints (no lat/lng);
- coarse **0.01°** dockless GPS junk (often lakeward);
- points outside the study zone.

Centroids use **median** lat/lng of remaining points.

## UI features already shipped

1. Period controls: All years → year → month (month KPIs from monthly rows;
   station/route/hour rankings year-scoped when a month is selected).
2. Multi-metric KPIs + Campus pulse (trips / member% / hours / est. miles) + brush.
3. Hour/weekday chart with scope dropdown: all / pre-COVID / post-COVID / year.
4. Pre vs post COVID comparison section.
5. Weather section (temp bins, wet-day drop, monthly trips vs temp).
6. Station map: overview markers, **demo-day replay** (play/scrub/speed), live GBFS.
7. OD flow *lines removed* (user disliked); demo-day animation preferred.
8. Next-archive-month forecast card (score when August 2026 archive lands).
9. Rider mix, bike evolution, duration, rankings, methodology, findings.

### Demo days

- 2023-10-03 — Busy fall Tuesday  
- 2022-05-13 — Spring surge Friday  
- 2024-09-30 — Recent September Monday  

Replay interpolates between station centroids (not routed street paths).

### Forecast (current numbers from last generate)

- Target: **2026-08**
- Baseline predicted trips: **~13,421** (band ~11.5k–15.4k)
- Backtest MAPE: **~12%**
- Learning script often *worse* than baseline — useful teaching point

After next archive:

```bash
npm run divvy:import -- --latest
npm run divvy:validate
npm run generate-data
# compare actual 2026-08 trips to previous forecast.predicted_trips
```

## Phase B status

| Item | Status |
|------|--------|
| Station map (centroids) | Done |
| Demo-day station-to-station replay | Done |
| Live GBFS inventory toggle | Done |
| OD flow arcs | Removed (not wanted) |
| Routed path replay (OSRM/etc.) | **Deferred** — do not wire unless asked |
| Academic calendar overlay | **Next preferred** — config exists, UI not wired |

## Preferred next tasks

1. **Academic calendar overlay** on Campus pulse using
   `config/uchicago-academic-calendar.json` (shade instruction / break / exams;
   extend years from https://events.uchicago.edu/academic/calendar/year.php).
2. Auto-score previous month’s forecast after each `--latest` import.
3. Optional: daily-feature ML upgrade; scenario explorer (wet vs dry August).
4. Review + commit logical chunks; deploy static site.
5. When Divvy publishes August 2026: import → validate → generate-data → build.

## What not to do

- Do not scrape Divvy apps or invent trip GPS / routed paths without a chosen provider.
- Do not truncate legacy overlapping tables without explicit approval.
- Do not disrupt a running `divvy:import`.
- Do not commit unless the user explicitly asks.
- Do not reintroduce OD flow line clutter unless asked.

## Git note

Branch: `main`. Large uncommitted set may include pipeline, UI rebuild, map,
forecast, and docs. Ask before committing.
