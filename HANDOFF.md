# WuViz / Divvy — conversation handoff

Last updated: **2026-08-18**

Use this document to start a new coding-agent conversation without repeating
ingestion, analytics, map, forecast, or UI work already completed.

## Copy this into a new conversation

> Continue work in `/Users/edwardwu/stats-journal`. Read `AGENTS.md`,
> `HANDOFF.md`, and `README.md` first. Phase A ingestion is complete. The Divvy
> atlas includes period filters (year → month → day), academic calendar overlay,
> station map + demo-day replay, OD-pair hover, live GBFS, COVID/weather,
> 2020+ ridership with estimated member savings, and a next-archive-month
> forecast. Routing providers remain deferred. Do not truncate legacy tables or
> commit unless I ask. First run `git status`, `npm run divvy:validate`,
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
| `scripts/divvy/fares.js` | 2020+ walk-up vs member fare math + SQL |
| `scripts/divvy/forecast-next-month.js` | Next-archive-month baseline forecast |
| `scripts/divvy/forecast-ml-learn.js` | Educational OLS forecast lab |
| `scripts/generate-analytics.js` | Batch → `public/analytics.json` |
| `scripts/sql/001_divvy_ingestion.sql` | Ingestion schema |
| `scripts/sql/002_divvy_analysis_ready.sql` | Analysis view |
| `config/uchicago-zone.json` | Study bounds + station names |
| `config/uchicago-academic-calendar.json` | UChicago 2025–26 terms (pulse overlay) |
| `config/divvy-fares.json` | Published Divvy fare schedule for savings |
| `src/components/DivvyProject.tsx` | Divvy page |
| `src/components/divvy/*` | Charts, map/replay, period controls, TOC |
| `src/services/api.ts` | Analytics TypeScript types |
| `src/services/gbfs.ts` | Live station inventory fetch |

**Owned tables:** `divvy_uchicago_trips`, `divvy_import_runs`  
**Do not truncate** legacy `uchicago_trips` / `divvy_trips` / old aggregates without approval.

## Analytics export contents

`public/analytics.json` includes (high level):

- `summary`, `monthly`, `yearly`, `daily` — rich metrics (trips, member/casual,
  bike types, duration stats, after-dark, estimated haversine miles + coverage)
- `weekday_hour` + per-year in `by_year`
- Station rankings, OD routes, member/bike summaries
- `stations` / `stations_by_month` — map centroids (median of map-quality coords)
- `demo_days` — three curated days for station-to-station replay
- `covid` — pre (&lt; 2020-03-15) vs post (≥ 2020-07-01) summaries + hour patterns
- `weather` — Open-Meteo Hyde Park join: temp bins, wet/dry, monthly temp vs trips
- `ridership` — 2020+ member×bike rollup with estimated walk-up savings
- `forecast` — next month after latest trip (currently **2026-08**)
- `map_bounds`, `generated_at`

### Map-quality coordinates vs miles

Station map / demo replay ignore:

- name-only endpoints (no lat/lng);
- coarse **0.01°** dockless GPS junk (often lakeward);
- points outside the study zone.

Centroids use **median** lat/lng of remaining points.

Estimated miles are haversine when **all four** start/end coordinates exist.
They do **not** apply the 0.01° map-quality filter. Official CSVs had no lat/lng
until 2020, so 2013–2019 KPIs and the Est. miles pulse tab say **No miles**.

## UI features already shipped

1. Sticky TOC: Overview, Pulse, Calendar, Rhythm, COVID, Weather, Map, Riders,
   Method, Findings.
2. Period controls: All years → year → month → day. Campus pulse is the main
   chart and drills in place (month click → daily bars; day click highlights).
3. Academic calendar overlay on pulse + Calendar section (2025–26 terms/breaks/exams).
4. Multi-metric KPIs + pulse tabs (trips / member% / hours / est. miles) + brush
   on the all-years view. Pre-2020 miles show **No miles**, not a dash.
5. Hour/weekday chart with scope dropdown: all / pre-COVID / post-COVID / year.
6. Pre vs post COVID comparison section.
7. Weather: temp-bin bars, scatter (Pearson r), 12-month seasonal composed chart.
8. Station map: overview markers (archive centroids as fallback), demo-day replay,
   live GBFS. Hover an OD pair to light up start (maroon) and end (teal) with a
   dashed line. Map and OD chart sit side by side on wide screens.
9. OD flow *lines removed* (user disliked); pair hover + demo-day animation preferred.
10. Riders section is **2020–present only** (e-bike / published bike-type era).
    2013–2019, including 2014, are excluded. Headline is estimated member savings
    vs published walk-up fares (~**$2.02M** through July 2026, ~$2.78/member trip).
    Annual dues are not subtracted (no unique riders). CTA $2.50 is a comparison
    only. Pre-2020 year filters show an empty state pointing at 2020.
11. Next-archive-month forecast card (score when August 2026 archive lands).
12. Methodology (zone screenshot is `object-contain` so the box is not cropped)
    and period-scoped findings.

### Demo days

- 2023-10-03 — Busy fall Tuesday  
- 2022-05-13 — Spring surge Friday  
- 2024-09-30 — Recent September Monday  

Replay interpolates between station centroids (not routed street paths).

### Ridership savings (current numbers from last generate)

- Era: **2020–2026-07** (982,591 trips; 726,576 member)
- Estimated member savings vs walk-up: **~$2.02M**
- Member walk-up counterfactual: **~$2.42M**; member usage fees: **~$406k**
- CTA $2.50 equivalent for the same trips: **~$2.46M**
- Fare table: `config/divvy-fares.json`. 2020–2021 Hyde Park member e-bikes are
  treated as included for 45 minutes (original fee-waiver zone south of Pershing).
  2022 uses citywide paid e-bike rates after the May 2022 simplification.

After regenerating analytics, read `analytics.json` → `data.ridership.totals`.

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
| Academic calendar overlay | Done (2025–26; extend years if asked) |
| OD pair hover on map | Done |
| 2020+ ridership + fare savings | Done |
| OD flow arcs | Removed (not wanted) |
| Routed path replay (OSRM/etc.) | **Deferred** — do not wire unless asked |

## Preferred next tasks

1. Incremental updates: `npm run divvy:import -- --latest`, validate, then
   `npm run generate-data` (score prior forecast vs new month).
2. Optional: extend `config/uchicago-academic-calendar.json` beyond 2025–26
   from https://events.uchicago.edu/academic/calendar/year.php.
3. Optional: daily-feature ML upgrade; scenario explorer (wet vs dry August).
4. Review + commit logical chunks; deploy static site.
5. When Divvy publishes August 2026: import → validate → generate-data → build.

## What not to do

- Do not scrape Divvy apps or invent trip GPS / routed paths without a chosen provider.
- Do not truncate legacy overlapping tables without explicit approval.
- Do not disrupt a running `divvy:import`.
- Do not commit unless the user explicitly asks.
- Do not reintroduce OD flow line clutter unless asked.
- Do not chart 2013–2019 in the Riders section; that era has no published bike type.

## Git note

Branch: `main`. Working tree may include atlas UI, ridership/fares, map hover,
and docs. Ask before committing.
