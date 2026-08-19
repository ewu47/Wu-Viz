# Wu-Viz

This is my page for the different stats/data visualization projects that I am curious to do!

------------------
## UChicago / Hyde Park Divvy Mobility Atlas
This project analyzes official Divvy bike-share trips around the University of Chicago and Hyde Park from July 2013 through July 2026:
- Campus pulse with year → month → day drill-down and a 2025–26 academic calendar overlay
- Station map, demo-day replay, live GBFS, and hover-to-pair origin–destination routes
- Weather, COVID, and after-hours patterns
- 2020+ ridership (when e-bikes and bike type were published) with estimated member savings vs walk-up fares
- Estimated straight-line miles only when coordinates exist (2020 onward)

### Current dataset
- **1,245,326** normalized zone trips
- **1,236,135** analysis-ready trips after the 15-second–24-hour duration rule
- **94/94** official archives imported and validated

### Tech Stack
- **Frontend:** React, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Charts:** Recharts via shadcn Charts
- **Data:** maintained PostgreSQL database from open-sourced Divvy data

## Divvy historical ingestion

For agent/session handoff (phases, zone bounds, commands, known issues), see
[`AGENTS.md`](AGENTS.md). For a full record of the ingestion, cleaning, analytics
export, and UI rebuild, see [`HANDOFF.md`](HANDOFF.md).

The ingestion pipeline downloads official public archives from the
[`divvy-tripdata` S3 bucket](https://divvy-tripdata.s3.amazonaws.com/index.html),
normalizes historical CSV schemas, and stores only trips whose start **and**
end are inside the configured UChicago/Hyde Park study area.

### Prerequisites

- PostgreSQL is running and the root `.env` contains `DB_HOST`, `DB_PORT`,
  `DB_NAME`, `DB_USER`, and `DB_PASSWORD`.
- The database user can create tables and indexes.
- Enough temporary disk space for one citywide ZIP at a time. Archives are
  downloaded to the operating-system temp directory and deleted after import.

### Initial setup and backfill

```bash
npm run divvy:migrate
npm run divvy:test
npm run divvy:import -- --all
npm run divvy:validate
npm run divvy:status
```

The importer is idempotent:

- Successful archives are skipped.
- Rows are deduplicated by Divvy ride ID; older rows use a deterministic key.
- Each archive is merged transactionally.
- Failed archives are recorded and can be retried with:

```bash
npm run divvy:import -- --retry-failed
```

### Analysis-ready data

The lossless normalized table is `divvy_uchicago_trips`. For standard analysis,
use `divvy_uchicago_trips_analysis`. The view:

- retains trips from 15 seconds through 24 hours;
- excludes false starts/docking retries and extreme undocked-bike records;
- adds duration, date, month, year, weekday, and start-hour fields;
- exposes station and coordinate metadata-completeness flags.

`npm run divvy:validate` verifies unique IDs, positive durations, endpoint zone
membership, coordinate pairs, normalized categories, archive row counts, and
source lineage. Legacy null coordinates and bike types are expected because
those columns were not published in older Divvy schemas.

### Monthly update

After Divvy publishes the newest archive:

```bash
npm run divvy:import -- --latest
npm run divvy:validate
npm run generate-data
```

Useful development commands:

```bash
# List official archives
npm run divvy:discover

# Test a single archive without writing trips or import state
npm run divvy:import -- --archive 202607-divvy-tripdata.zip --dry-run

# Import a specific archive
npm run divvy:import -- --archive 202607-divvy-tripdata.zip
```

`npm run generate-data` rebuilds `public/analytics.json` from the analysis view
(Postgres + Open-Meteo). The export includes a daily series and a 2020+
`ridership` block with fare savings from
[`config/divvy-fares.json`](config/divvy-fares.json). Academic calendar dates
live in [`config/uchicago-academic-calendar.json`](config/uchicago-academic-calendar.json)
and are applied on the client.

The study area is versioned in
[`config/uchicago-zone.json`](config/uchicago-zone.json). Modern records use
coordinates; older records without coordinates fall back to the known station
name list. Existing `divvy_trips`, `uchicago_trips`, and dashboard aggregate
tables are not modified by this pipeline.