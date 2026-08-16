import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPool } from './divvy/db.js';
import { buildNextMonthForecast } from './divvy/forecast-next-month.js';

const directory = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.resolve(directory, '../public/analytics.json');
const pool = createPool();

const MAP_BOUNDS = {
  minLat: 41.78405419311528,
  maxLat: 41.80224207377386,
  minLng: -87.60641021421114,
  maxLng: -87.57517423508772,
};

/** Curated high-activity days for station-to-station replay demos. */
const DEMO_DAYS = [
  {
    date: '2023-10-03',
    label: 'Busy fall Tuesday',
    blurb: 'One of the densest mapped campus days in the archive.',
  },
  {
    date: '2022-05-13',
    label: 'Spring surge Friday',
    blurb: 'A warm-season weekday when Hyde Park stations stay busy into the afternoon.',
  },
  {
    date: '2024-09-30',
    label: 'Recent September Monday',
    blurb: 'A recent term-time Monday with strong coordinate coverage.',
  },
];

/** Exclude acute lockdown spring when comparing “pre” vs “new normal” post patterns. */
const COVID_PRE_END = '2020-03-15';
const COVID_POST_START = '2020-07-01';

const HYDE_PARK_WEATHER = {
  latitude: 41.794,
  longitude: -87.591,
};

/**
 * Keep only map-worthy endpoint coordinates:
 * - inside the study zone
 * - not coarse 0.01° grid points (common dockless / GPS junk that drifts into the lake)
 */
function mapQualityCoordSql(latCol, lngCol) {
  return `
    ${latCol} IS NOT NULL
    AND ${lngCol} IS NOT NULL
    AND ${latCol} >= ${MAP_BOUNDS.minLat}
    AND ${latCol} <= ${MAP_BOUNDS.maxLat}
    AND ${lngCol} >= ${MAP_BOUNDS.minLng}
    AND ${lngCol} <= ${MAP_BOUNDS.maxLng}
    AND NOT (
      abs(${latCol} * 100 - round(${latCol} * 100)) < 1e-9
      AND abs(${lngCol} * 100 - round(${lngCol} * 100)) < 1e-9
    )
  `;
}

/** Great-circle miles when all four coordinates are present. */
const HAVERSINE_MILES = `
  CASE
    WHEN start_lat IS NOT NULL
      AND start_lng IS NOT NULL
      AND end_lat IS NOT NULL
      AND end_lng IS NOT NULL
    THEN 3958.7613 * acos(least(1::double precision, greatest(-1::double precision,
      cos(radians(start_lat)) * cos(radians(end_lat)) *
      cos(radians(end_lng) - radians(start_lng)) +
      sin(radians(start_lat)) * sin(radians(end_lat))
    )))
    ELSE NULL
  END
`;

const PERIOD_METRIC_FIELDS = new Set([
  'trips',
  'member',
  'casual',
  'classic',
  'electric',
  'not_published',
  'member_share',
  'electric_share_among_typed',
  'avg_duration_minutes',
  'median_duration_minutes',
  'p90_duration_minutes',
  'total_duration_hours',
  'member_duration_hours',
  'casual_duration_hours',
  'after_dark_trips',
  'after_dark_share',
  'estimated_miles_total',
  'estimated_miles_avg',
  'estimated_miles_trip_coverage',
  'coordinate_metadata_complete_share',
  'station_metadata_complete_share',
]);

const SUMMARY_NUMERIC_FIELDS = new Set([
  ...PERIOD_METRIC_FIELDS,
  'total_stations',
  'stationless_starts',
  'unique_routes',
  'active_days',
  'trips_per_active_day',
  'total_trips',
]);

function numericRows(rows, numericFields) {
  return rows.map((row) => Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      numericFields.has(key) && value !== null && value !== undefined ? Number(value) : value,
    ]),
  ));
}

function periodSeriesSelect(groupExpr, groupAlias) {
  return `
    SELECT
      ${groupExpr} AS ${groupAlias},
      count(*)::bigint AS trips,
      count(*) FILTER (WHERE member_casual = 'member')::bigint AS member,
      count(*) FILTER (WHERE member_casual = 'casual')::bigint AS casual,
      count(*) FILTER (WHERE rideable_type = 'classic_bike')::bigint AS classic,
      count(*) FILTER (WHERE rideable_type = 'electric_bike')::bigint AS electric,
      count(*) FILTER (WHERE rideable_type IS NULL)::bigint AS not_published,
      round(
        100.0 * count(*) FILTER (WHERE member_casual = 'member') / nullif(count(*), 0),
        1
      ) AS member_share,
      round(
        100.0 * count(*) FILTER (WHERE rideable_type = 'electric_bike')
          / nullif(count(*) FILTER (WHERE rideable_type IN ('classic_bike', 'electric_bike')), 0),
        1
      ) AS electric_share_among_typed,
      round(avg(duration_seconds)::numeric / 60, 2) AS avg_duration_minutes,
      round((percentile_cont(0.5) WITHIN GROUP (ORDER BY duration_seconds) / 60)::numeric, 2)
        AS median_duration_minutes,
      round((percentile_cont(0.9) WITHIN GROUP (ORDER BY duration_seconds) / 60)::numeric, 2)
        AS p90_duration_minutes,
      round(sum(duration_seconds)::numeric / 3600, 1) AS total_duration_hours,
      round(
        coalesce(sum(duration_seconds) FILTER (WHERE member_casual = 'member'), 0)::numeric / 3600,
        1
      ) AS member_duration_hours,
      round(
        coalesce(sum(duration_seconds) FILTER (WHERE member_casual = 'casual'), 0)::numeric / 3600,
        1
      ) AS casual_duration_hours,
      count(*) FILTER (WHERE start_hour >= 21)::bigint AS after_dark_trips,
      round(
        100.0 * count(*) FILTER (WHERE start_hour >= 21) / nullif(count(*), 0),
        1
      ) AS after_dark_share,
      round(sum(${HAVERSINE_MILES})::numeric, 1) AS estimated_miles_total,
      round(avg(${HAVERSINE_MILES})::numeric, 2) AS estimated_miles_avg,
      round(
        100.0 * count(${HAVERSINE_MILES}) / nullif(count(*), 0),
        1
      ) AS estimated_miles_trip_coverage,
      round(
        100.0 * count(*) FILTER (WHERE coordinate_metadata_complete) / nullif(count(*), 0),
        1
      ) AS coordinate_metadata_complete_share,
      round(
        100.0 * count(*) FILTER (WHERE station_metadata_complete) / nullif(count(*), 0),
        1
      ) AS station_metadata_complete_share
    FROM divvy_uchicago_trips_analysis
    GROUP BY ${groupExpr}
    ORDER BY ${groupExpr}
  `;
}

const CORE_SUMMARY_METRICS = `
  count(*)::bigint AS trips,
  count(*) FILTER (WHERE member_casual = 'member')::bigint AS member,
  count(*) FILTER (WHERE member_casual = 'casual')::bigint AS casual,
  count(*) FILTER (WHERE rideable_type = 'classic_bike')::bigint AS classic,
  count(*) FILTER (WHERE rideable_type = 'electric_bike')::bigint AS electric,
  count(*) FILTER (WHERE rideable_type IS NULL)::bigint AS not_published,
  round(
    100.0 * count(*) FILTER (WHERE member_casual = 'member') / nullif(count(*), 0),
    1
  ) AS member_share,
  round(
    100.0 * count(*) FILTER (WHERE rideable_type = 'electric_bike')
      / nullif(count(*) FILTER (WHERE rideable_type IN ('classic_bike', 'electric_bike')), 0),
    1
  ) AS electric_share_among_typed,
  round(avg(duration_seconds)::numeric / 60, 2) AS avg_duration_minutes,
  round((percentile_cont(0.5) WITHIN GROUP (ORDER BY duration_seconds) / 60)::numeric, 2)
    AS median_duration_minutes,
  round((percentile_cont(0.9) WITHIN GROUP (ORDER BY duration_seconds) / 60)::numeric, 2)
    AS p90_duration_minutes,
  round(sum(duration_seconds)::numeric / 3600, 1) AS total_duration_hours,
  round(
    sum(duration_seconds) FILTER (WHERE member_casual = 'member')::numeric / 3600,
    1
  ) AS member_duration_hours,
  round(
    sum(duration_seconds) FILTER (WHERE member_casual = 'casual')::numeric / 3600,
    1
  ) AS casual_duration_hours,
  count(*) FILTER (WHERE start_station_name IS NULL)::bigint AS stationless_starts,
  count(DISTINCT (start_station_name, end_station_name))
    FILTER (
      WHERE start_station_name IS NOT NULL
        AND end_station_name IS NOT NULL
        AND start_station_name <> end_station_name
    )::bigint AS unique_routes,
  count(*) FILTER (WHERE start_hour >= 21)::bigint AS after_dark_trips,
  round(
    100.0 * count(*) FILTER (WHERE start_hour >= 21) / nullif(count(*), 0),
    1
  ) AS after_dark_share,
  round(
    100.0 * count(*) FILTER (WHERE station_metadata_complete) / nullif(count(*), 0),
    1
  ) AS station_metadata_complete_share,
  round(
    100.0 * count(*) FILTER (WHERE coordinate_metadata_complete) / nullif(count(*), 0),
    1
  ) AS coordinate_metadata_complete_share,
  round(sum(${HAVERSINE_MILES})::numeric, 1) AS estimated_miles_total,
  round(avg(${HAVERSINE_MILES})::numeric, 2) AS estimated_miles_avg,
  round(
    100.0 * count(${HAVERSINE_MILES}) / nullif(count(*), 0),
    1
  ) AS estimated_miles_trip_coverage,
  to_char(min(started_at), 'YYYY-MM-DD') AS first_trip,
  to_char(max(started_at), 'YYYY-MM-DD') AS latest_trip,
  count(DISTINCT trip_date)::integer AS active_days,
  round(count(*)::numeric / nullif(count(DISTINCT trip_date), 0), 1) AS trips_per_active_day
`;

function groupByYear(rows) {
  const grouped = new Map();
  for (const row of rows) {
    const year = Number(row.year);
    if (!grouped.has(year)) grouped.set(year, []);
    const { year: _omit, ...rest } = row;
    grouped.get(year).push(rest);
  }
  return grouped;
}

function withTotalTrips(summary) {
  return { ...summary, total_trips: summary.trips };
}

async function fetchDailyWeather(startDate, endDate) {
  const url = new URL('https://archive-api.open-meteo.com/v1/archive');
  url.searchParams.set('latitude', String(HYDE_PARK_WEATHER.latitude));
  url.searchParams.set('longitude', String(HYDE_PARK_WEATHER.longitude));
  url.searchParams.set('start_date', startDate);
  url.searchParams.set('end_date', endDate);
  url.searchParams.set('daily', 'temperature_2m_mean,temperature_2m_max,precipitation_sum');
  url.searchParams.set('timezone', 'America/Chicago');
  url.searchParams.set('temperature_unit', 'fahrenheit');
  url.searchParams.set('precipitation_unit', 'inch');

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Open-Meteo weather request failed (${response.status})`);
  }
  const payload = await response.json();
  const dates = payload.daily?.time ?? [];
  const mean = payload.daily?.temperature_2m_mean ?? [];
  const max = payload.daily?.temperature_2m_max ?? [];
  const precip = payload.daily?.precipitation_sum ?? [];

  return dates.map((date, index) => ({
    date,
    temp_mean_f: mean[index] == null ? null : Number(mean[index]),
    temp_max_f: max[index] == null ? null : Number(max[index]),
    precip_in: precip[index] == null ? null : Number(precip[index]),
  }));
}

function tempBinLabel(tempF) {
  if (tempF == null || Number.isNaN(tempF)) return null;
  if (tempF < 32) return '<32°F';
  if (tempF < 45) return '32–44°F';
  if (tempF < 55) return '45–54°F';
  if (tempF < 65) return '55–64°F';
  if (tempF < 75) return '65–74°F';
  if (tempF < 85) return '75–84°F';
  return '85°F+';
}

const TEMP_BIN_ORDER = ['<32°F', '32–44°F', '45–54°F', '55–64°F', '65–74°F', '75–84°F', '85°F+'];

function buildWeatherAnalysis(dailyTrips, weatherDays) {
  const weatherByDate = new Map(weatherDays.map((row) => [row.date, row]));
  const joined = [];
  for (const row of dailyTrips) {
    const weather = weatherByDate.get(row.date);
    if (!weather || weather.temp_mean_f == null) continue;
    joined.push({
      date: row.date,
      trips: Number(row.trips),
      temp_mean_f: weather.temp_mean_f,
      temp_max_f: weather.temp_max_f,
      precip_in: weather.precip_in ?? 0,
    });
  }

  const byBin = new Map(TEMP_BIN_ORDER.map((label) => [label, { days: 0, trips: 0 }]));
  let dryDays = 0;
  let dryTrips = 0;
  let wetDays = 0;
  let wetTrips = 0;
  const monthly = new Map();

  for (const row of joined) {
    const bin = tempBinLabel(row.temp_mean_f);
    if (bin && byBin.has(bin)) {
      const bucket = byBin.get(bin);
      bucket.days += 1;
      bucket.trips += row.trips;
    }

    if (row.precip_in >= 0.1) {
      wetDays += 1;
      wetTrips += row.trips;
    } else {
      dryDays += 1;
      dryTrips += row.trips;
    }

    const month = row.date.slice(0, 7);
    if (!monthly.has(month)) {
      monthly.set(month, { month, days: 0, trips: 0, temp_sum: 0, precip_sum: 0 });
    }
    const monthRow = monthly.get(month);
    monthRow.days += 1;
    monthRow.trips += row.trips;
    monthRow.temp_sum += row.temp_mean_f;
    monthRow.precip_sum += row.precip_in;
  }

  return {
    source: 'Open-Meteo ERA5 archive (Hyde Park)',
    attribution: 'Weather data by Open-Meteo.com (CC BY 4.0)',
    days_joined: joined.length,
    by_temperature_bin: TEMP_BIN_ORDER.map((label) => {
      const bucket = byBin.get(label);
      return {
        label,
        days: bucket.days,
        trips: bucket.trips,
        avg_trips_per_day: bucket.days > 0 ? Number((bucket.trips / bucket.days).toFixed(1)) : 0,
      };
    }),
    precip: {
      dry_days: dryDays,
      wet_days: wetDays,
      dry_avg_trips: dryDays > 0 ? Number((dryTrips / dryDays).toFixed(1)) : 0,
      wet_avg_trips: wetDays > 0 ? Number((wetTrips / wetDays).toFixed(1)) : 0,
      wet_threshold_inches: 0.1,
    },
    monthly: [...monthly.values()]
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((row) => ({
        month: row.month,
        trips: row.trips,
        avg_temp_f: Number((row.temp_sum / row.days).toFixed(1)),
        precip_inches: Number(row.precip_sum.toFixed(2)),
        avg_trips_per_day: Number((row.trips / row.days).toFixed(1)),
      })),
  };
}

async function generateAnalytics() {
  try {
    console.log('Analyzing cleaned Divvy trips...');
    await pool.query(`SET statement_timeout = '300s'`);

    const [
      summaryResult,
      yearlySummaryResult,
      monthlyResult,
      yearlyResult,
      weekdayHourResult,
      weekdayHourByYearResult,
      topStartResult,
      topEndResult,
      afterDarkStartResult,
      afterDarkEndResult,
      topStartByYearResult,
      topEndByYearResult,
      afterDarkStartByYearResult,
      afterDarkEndByYearResult,
      routesResult,
      routesByYearResult,
      memberResult,
      memberByYearResult,
      bikeResult,
      bikeByYearResult,
      stationMapResult,
      stationMapByYearResult,
      stationMapByMonthResult,
      demoDayTripsResult,
      weekdayHourPreCovidResult,
      weekdayHourPostCovidResult,
      summaryPreCovidResult,
      summaryPostCovidResult,
      dailyTripsResult,
    ] = await Promise.all([
      pool.query(`
        WITH stations AS (
          SELECT start_station_name AS station_name
          FROM divvy_uchicago_trips_analysis
          WHERE start_station_name IS NOT NULL
          UNION
          SELECT end_station_name
          FROM divvy_uchicago_trips_analysis
          WHERE end_station_name IS NOT NULL
        )
        SELECT
          ${CORE_SUMMARY_METRICS},
          (SELECT count(*) FROM stations)::integer AS total_stations
        FROM divvy_uchicago_trips_analysis
      `),
      pool.query(`
        WITH station_years AS (
          SELECT trip_year AS year, start_station_name AS station_name
          FROM divvy_uchicago_trips_analysis
          WHERE start_station_name IS NOT NULL
          UNION
          SELECT trip_year, end_station_name
          FROM divvy_uchicago_trips_analysis
          WHERE end_station_name IS NOT NULL
        ),
        station_counts AS (
          SELECT year, count(*)::integer AS total_stations
          FROM station_years
          GROUP BY year
        )
        SELECT
          a.trip_year AS year,
          ${CORE_SUMMARY_METRICS},
          coalesce(s.total_stations, 0)::integer AS total_stations
        FROM divvy_uchicago_trips_analysis a
        LEFT JOIN station_counts s ON s.year = a.trip_year
        GROUP BY a.trip_year, s.total_stations
        ORDER BY a.trip_year
      `),
      pool.query(periodSeriesSelect(`to_char(trip_month, 'YYYY-MM')`, 'month')),
      pool.query(periodSeriesSelect('trip_year', 'year')),
      pool.query(`
        SELECT
          weekday_iso AS weekday,
          start_hour AS hour,
          count(*)::bigint AS trips,
          count(*) FILTER (WHERE member_casual = 'member')::bigint AS member,
          count(*) FILTER (WHERE member_casual = 'casual')::bigint AS casual
        FROM divvy_uchicago_trips_analysis
        GROUP BY weekday_iso, start_hour
        ORDER BY weekday_iso, start_hour
      `),
      pool.query(`
        SELECT
          trip_year AS year,
          weekday_iso AS weekday,
          start_hour AS hour,
          count(*)::bigint AS trips,
          count(*) FILTER (WHERE member_casual = 'member')::bigint AS member,
          count(*) FILTER (WHERE member_casual = 'casual')::bigint AS casual
        FROM divvy_uchicago_trips_analysis
        GROUP BY trip_year, weekday_iso, start_hour
        ORDER BY trip_year, weekday_iso, start_hour
      `),
      pool.query(`
        SELECT start_station_name AS station, count(*)::bigint AS trips,
          round(avg(duration_seconds)::numeric / 60, 2) AS avg_duration_minutes,
          round(avg(${HAVERSINE_MILES})::numeric, 2) AS estimated_miles_avg
        FROM divvy_uchicago_trips_analysis
        WHERE start_station_name IS NOT NULL
        GROUP BY start_station_name
        ORDER BY trips DESC, station
        LIMIT 12
      `),
      pool.query(`
        SELECT end_station_name AS station, count(*)::bigint AS trips,
          round(avg(duration_seconds)::numeric / 60, 2) AS avg_duration_minutes,
          round(avg(${HAVERSINE_MILES})::numeric, 2) AS estimated_miles_avg
        FROM divvy_uchicago_trips_analysis
        WHERE end_station_name IS NOT NULL
        GROUP BY end_station_name
        ORDER BY trips DESC, station
        LIMIT 12
      `),
      pool.query(`
        SELECT start_station_name AS station, count(*)::bigint AS trips,
          round(avg(duration_seconds)::numeric / 60, 2) AS avg_duration_minutes,
          round(avg(${HAVERSINE_MILES})::numeric, 2) AS estimated_miles_avg
        FROM divvy_uchicago_trips_analysis
        WHERE start_hour >= 21 AND start_station_name IS NOT NULL
        GROUP BY start_station_name
        ORDER BY trips DESC, station
        LIMIT 12
      `),
      pool.query(`
        SELECT end_station_name AS station, count(*)::bigint AS trips,
          round(avg(duration_seconds)::numeric / 60, 2) AS avg_duration_minutes,
          round(avg(${HAVERSINE_MILES})::numeric, 2) AS estimated_miles_avg
        FROM divvy_uchicago_trips_analysis
        WHERE start_hour >= 21 AND end_station_name IS NOT NULL
        GROUP BY end_station_name
        ORDER BY trips DESC, station
        LIMIT 12
      `),
      pool.query(`
        WITH ranked AS (
          SELECT
            trip_year AS year,
            start_station_name AS station,
            count(*)::bigint AS trips,
            round(avg(duration_seconds)::numeric / 60, 2) AS avg_duration_minutes,
            round(avg(${HAVERSINE_MILES})::numeric, 2) AS estimated_miles_avg,
            row_number() OVER (
              PARTITION BY trip_year
              ORDER BY count(*) DESC, start_station_name
            ) AS rn
          FROM divvy_uchicago_trips_analysis
          WHERE start_station_name IS NOT NULL
          GROUP BY trip_year, start_station_name
        )
        SELECT year, station, trips, avg_duration_minutes, estimated_miles_avg
        FROM ranked
        WHERE rn <= 12
        ORDER BY year, rn
      `),
      pool.query(`
        WITH ranked AS (
          SELECT
            trip_year AS year,
            end_station_name AS station,
            count(*)::bigint AS trips,
            round(avg(duration_seconds)::numeric / 60, 2) AS avg_duration_minutes,
            round(avg(${HAVERSINE_MILES})::numeric, 2) AS estimated_miles_avg,
            row_number() OVER (
              PARTITION BY trip_year
              ORDER BY count(*) DESC, end_station_name
            ) AS rn
          FROM divvy_uchicago_trips_analysis
          WHERE end_station_name IS NOT NULL
          GROUP BY trip_year, end_station_name
        )
        SELECT year, station, trips, avg_duration_minutes, estimated_miles_avg
        FROM ranked
        WHERE rn <= 12
        ORDER BY year, rn
      `),
      pool.query(`
        WITH ranked AS (
          SELECT
            trip_year AS year,
            start_station_name AS station,
            count(*)::bigint AS trips,
            round(avg(duration_seconds)::numeric / 60, 2) AS avg_duration_minutes,
            round(avg(${HAVERSINE_MILES})::numeric, 2) AS estimated_miles_avg,
            row_number() OVER (
              PARTITION BY trip_year
              ORDER BY count(*) DESC, start_station_name
            ) AS rn
          FROM divvy_uchicago_trips_analysis
          WHERE start_hour >= 21 AND start_station_name IS NOT NULL
          GROUP BY trip_year, start_station_name
        )
        SELECT year, station, trips, avg_duration_minutes, estimated_miles_avg
        FROM ranked
        WHERE rn <= 12
        ORDER BY year, rn
      `),
      pool.query(`
        WITH ranked AS (
          SELECT
            trip_year AS year,
            end_station_name AS station,
            count(*)::bigint AS trips,
            round(avg(duration_seconds)::numeric / 60, 2) AS avg_duration_minutes,
            round(avg(${HAVERSINE_MILES})::numeric, 2) AS estimated_miles_avg,
            row_number() OVER (
              PARTITION BY trip_year
              ORDER BY count(*) DESC, end_station_name
            ) AS rn
          FROM divvy_uchicago_trips_analysis
          WHERE start_hour >= 21 AND end_station_name IS NOT NULL
          GROUP BY trip_year, end_station_name
        )
        SELECT year, station, trips, avg_duration_minutes, estimated_miles_avg
        FROM ranked
        WHERE rn <= 12
        ORDER BY year, rn
      `),
      pool.query(`
        SELECT
          start_station_name AS start_station,
          end_station_name AS end_station,
          count(*)::bigint AS trips,
          round(avg(duration_seconds)::numeric / 60, 2) AS avg_duration_minutes,
          round(avg(${HAVERSINE_MILES})::numeric, 2) AS estimated_miles_avg
        FROM divvy_uchicago_trips_analysis
        WHERE start_station_name IS NOT NULL
          AND end_station_name IS NOT NULL
          AND start_station_name <> end_station_name
        GROUP BY start_station_name, end_station_name
        ORDER BY trips DESC, start_station, end_station
        LIMIT 15
      `),
      pool.query(`
        WITH ranked AS (
          SELECT
            trip_year AS year,
            start_station_name AS start_station,
            end_station_name AS end_station,
            count(*)::bigint AS trips,
            round(avg(duration_seconds)::numeric / 60, 2) AS avg_duration_minutes,
            round(avg(${HAVERSINE_MILES})::numeric, 2) AS estimated_miles_avg,
            row_number() OVER (
              PARTITION BY trip_year
              ORDER BY count(*) DESC, start_station_name, end_station_name
            ) AS rn
          FROM divvy_uchicago_trips_analysis
          WHERE start_station_name IS NOT NULL
            AND end_station_name IS NOT NULL
            AND start_station_name <> end_station_name
          GROUP BY trip_year, start_station_name, end_station_name
        )
        SELECT year, start_station, end_station, trips, avg_duration_minutes, estimated_miles_avg
        FROM ranked
        WHERE rn <= 15
        ORDER BY year, rn
      `),
      pool.query(`
        SELECT
          member_casual AS type,
          count(*)::bigint AS trips,
          round(avg(duration_seconds)::numeric / 60, 2) AS avg_duration_minutes,
          round((percentile_cont(0.5) WITHIN GROUP (ORDER BY duration_seconds) / 60)::numeric, 2)
            AS median_duration_minutes,
          round(sum(duration_seconds)::numeric / 3600, 1) AS total_duration_hours,
          round(sum(${HAVERSINE_MILES})::numeric, 1) AS estimated_miles_total,
          round(avg(${HAVERSINE_MILES})::numeric, 2) AS estimated_miles_avg
        FROM divvy_uchicago_trips_analysis
        GROUP BY member_casual
        ORDER BY member_casual
      `),
      pool.query(`
        SELECT
          trip_year AS year,
          member_casual AS type,
          count(*)::bigint AS trips,
          round(avg(duration_seconds)::numeric / 60, 2) AS avg_duration_minutes,
          round((percentile_cont(0.5) WITHIN GROUP (ORDER BY duration_seconds) / 60)::numeric, 2)
            AS median_duration_minutes,
          round(sum(duration_seconds)::numeric / 3600, 1) AS total_duration_hours,
          round(sum(${HAVERSINE_MILES})::numeric, 1) AS estimated_miles_total,
          round(avg(${HAVERSINE_MILES})::numeric, 2) AS estimated_miles_avg
        FROM divvy_uchicago_trips_analysis
        GROUP BY trip_year, member_casual
        ORDER BY trip_year, member_casual
      `),
      pool.query(`
        SELECT
          coalesce(rideable_type, 'not_published') AS type,
          count(*)::bigint AS trips,
          round(avg(duration_seconds)::numeric / 60, 2) AS avg_duration_minutes,
          round(sum(${HAVERSINE_MILES})::numeric, 1) AS estimated_miles_total,
          round(avg(${HAVERSINE_MILES})::numeric, 2) AS estimated_miles_avg
        FROM divvy_uchicago_trips_analysis
        GROUP BY rideable_type
        ORDER BY trips DESC
      `),
      pool.query(`
        SELECT
          trip_year AS year,
          coalesce(rideable_type, 'not_published') AS type,
          count(*)::bigint AS trips,
          round(avg(duration_seconds)::numeric / 60, 2) AS avg_duration_minutes,
          round(sum(${HAVERSINE_MILES})::numeric, 1) AS estimated_miles_total,
          round(avg(${HAVERSINE_MILES})::numeric, 2) AS estimated_miles_avg
        FROM divvy_uchicago_trips_analysis
        GROUP BY trip_year, rideable_type
        ORDER BY trip_year, trips DESC
      `),
      // Station map: median centroids from map-quality coordinates only.
      // Name-only trips and coarse dockless GPS (often lakeward) are excluded.
      pool.query(`
        WITH points AS (
          SELECT
            start_station_name AS station,
            start_lat AS lat,
            start_lng AS lng,
            'start'::text AS role
          FROM divvy_uchicago_trips_analysis
          WHERE start_station_name IS NOT NULL
            AND ${mapQualityCoordSql('start_lat', 'start_lng')}
          UNION ALL
          SELECT
            end_station_name,
            end_lat,
            end_lng,
            'end'::text
          FROM divvy_uchicago_trips_analysis
          WHERE end_station_name IS NOT NULL
            AND ${mapQualityCoordSql('end_lat', 'end_lng')}
        )
        SELECT
          station,
          round(percentile_cont(0.5) WITHIN GROUP (ORDER BY lat)::numeric, 6) AS lat,
          round(percentile_cont(0.5) WITHIN GROUP (ORDER BY lng)::numeric, 6) AS lng,
          count(*)::bigint AS mapped_trips,
          count(*) FILTER (WHERE role = 'start')::bigint AS mapped_starts,
          count(*) FILTER (WHERE role = 'end')::bigint AS mapped_ends
        FROM points
        GROUP BY station
        HAVING count(*) >= 5
        ORDER BY mapped_trips DESC, station
      `),
      pool.query(`
        WITH points AS (
          SELECT
            trip_year AS year,
            start_station_name AS station,
            'start'::text AS role
          FROM divvy_uchicago_trips_analysis
          WHERE start_station_name IS NOT NULL
            AND ${mapQualityCoordSql('start_lat', 'start_lng')}
          UNION ALL
          SELECT
            trip_year,
            end_station_name,
            'end'::text
          FROM divvy_uchicago_trips_analysis
          WHERE end_station_name IS NOT NULL
            AND ${mapQualityCoordSql('end_lat', 'end_lng')}
        )
        SELECT
          year,
          station,
          count(*)::bigint AS mapped_trips,
          count(*) FILTER (WHERE role = 'start')::bigint AS mapped_starts,
          count(*) FILTER (WHERE role = 'end')::bigint AS mapped_ends
        FROM points
        GROUP BY year, station
        HAVING count(*) >= 3
        ORDER BY year, mapped_trips DESC, station
      `),
      pool.query(`
        WITH points AS (
          SELECT
            to_char(trip_month, 'YYYY-MM') AS month,
            start_station_name AS station,
            'start'::text AS role
          FROM divvy_uchicago_trips_analysis
          WHERE start_station_name IS NOT NULL
            AND ${mapQualityCoordSql('start_lat', 'start_lng')}
          UNION ALL
          SELECT
            to_char(trip_month, 'YYYY-MM'),
            end_station_name,
            'end'::text
          FROM divvy_uchicago_trips_analysis
          WHERE end_station_name IS NOT NULL
            AND ${mapQualityCoordSql('end_lat', 'end_lng')}
        )
        SELECT
          month,
          station,
          count(*)::bigint AS mapped_trips,
          count(*) FILTER (WHERE role = 'start')::bigint AS mapped_starts,
          count(*) FILTER (WHERE role = 'end')::bigint AS mapped_ends
        FROM points
        GROUP BY month, station
        HAVING count(*) >= 2
        ORDER BY month, mapped_trips DESC, station
      `),
      // Demo-day replay trips: map-quality named OD only, positions filled from station centroids.
      pool.query(`
        SELECT
          to_char(trip_date, 'YYYY-MM-DD') AS date,
          start_station_name AS start_station,
          end_station_name AS end_station,
          round((
            extract(hour FROM started_at) * 60
            + extract(minute FROM started_at)
            + extract(second FROM started_at) / 60.0
          )::numeric, 2) AS start_minute,
          round(duration_seconds::numeric, 1) AS duration_seconds,
          member_casual,
          coalesce(rideable_type, 'not_published') AS rideable_type
        FROM divvy_uchicago_trips_analysis
        WHERE trip_date = ANY($1::date[])
          AND start_station_name IS NOT NULL
          AND end_station_name IS NOT NULL
          AND start_station_name <> end_station_name
          AND ${mapQualityCoordSql('start_lat', 'start_lng')}
          AND ${mapQualityCoordSql('end_lat', 'end_lng')}
        ORDER BY trip_date, started_at
      `, [DEMO_DAYS.map((day) => day.date)]),
      pool.query(`
        SELECT
          weekday_iso AS weekday,
          start_hour AS hour,
          count(*)::bigint AS trips,
          count(*) FILTER (WHERE member_casual = 'member')::bigint AS member,
          count(*) FILTER (WHERE member_casual = 'casual')::bigint AS casual
        FROM divvy_uchicago_trips_analysis
        WHERE started_at < $1::timestamp
        GROUP BY weekday_iso, start_hour
        ORDER BY weekday_iso, start_hour
      `, [COVID_PRE_END]),
      pool.query(`
        SELECT
          weekday_iso AS weekday,
          start_hour AS hour,
          count(*)::bigint AS trips,
          count(*) FILTER (WHERE member_casual = 'member')::bigint AS member,
          count(*) FILTER (WHERE member_casual = 'casual')::bigint AS casual
        FROM divvy_uchicago_trips_analysis
        WHERE started_at >= $1::timestamp
        GROUP BY weekday_iso, start_hour
        ORDER BY weekday_iso, start_hour
      `, [COVID_POST_START]),
      pool.query(`
        WITH stations AS (
          SELECT start_station_name AS station_name
          FROM divvy_uchicago_trips_analysis
          WHERE started_at < $1::timestamp AND start_station_name IS NOT NULL
          UNION
          SELECT end_station_name
          FROM divvy_uchicago_trips_analysis
          WHERE started_at < $1::timestamp AND end_station_name IS NOT NULL
        )
        SELECT
          ${CORE_SUMMARY_METRICS},
          (SELECT count(*) FROM stations)::integer AS total_stations
        FROM divvy_uchicago_trips_analysis
        WHERE started_at < $1::timestamp
      `, [COVID_PRE_END]),
      pool.query(`
        WITH stations AS (
          SELECT start_station_name AS station_name
          FROM divvy_uchicago_trips_analysis
          WHERE started_at >= $1::timestamp AND start_station_name IS NOT NULL
          UNION
          SELECT end_station_name
          FROM divvy_uchicago_trips_analysis
          WHERE started_at >= $1::timestamp AND end_station_name IS NOT NULL
        )
        SELECT
          ${CORE_SUMMARY_METRICS},
          (SELECT count(*) FROM stations)::integer AS total_stations
        FROM divvy_uchicago_trips_analysis
        WHERE started_at >= $1::timestamp
      `, [COVID_POST_START]),
      pool.query(periodSeriesSelect(`to_char(trip_date, 'YYYY-MM-DD')`, 'date')),
    ]);

    const monthly = numericRows(monthlyResult.rows, PERIOD_METRIC_FIELDS);
    const yearly = numericRows(
      yearlyResult.rows.map((row) => ({ ...row, year: Number(row.year) })),
      new Set([...PERIOD_METRIC_FIELDS, 'year']),
    );

    const weekdayHourFields = new Set(['weekday', 'hour', 'trips', 'member', 'casual']);
    const stationFields = new Set(['trips', 'avg_duration_minutes', 'estimated_miles_avg']);
    const routeFields = new Set(['trips', 'avg_duration_minutes', 'estimated_miles_avg']);
    const memberFields = new Set([
      'trips',
      'avg_duration_minutes',
      'median_duration_minutes',
      'total_duration_hours',
      'estimated_miles_total',
      'estimated_miles_avg',
    ]);
    const bikeFields = new Set([
      'trips',
      'avg_duration_minutes',
      'estimated_miles_total',
      'estimated_miles_avg',
    ]);

    const weekdayByYear = groupByYear(
      numericRows(weekdayHourByYearResult.rows, new Set([...weekdayHourFields, 'year'])),
    );
    const topStartByYear = groupByYear(
      numericRows(topStartByYearResult.rows, new Set([...stationFields, 'year'])),
    );
    const topEndByYear = groupByYear(
      numericRows(topEndByYearResult.rows, new Set([...stationFields, 'year'])),
    );
    const afterDarkStartByYear = groupByYear(
      numericRows(afterDarkStartByYearResult.rows, new Set([...stationFields, 'year'])),
    );
    const afterDarkEndByYear = groupByYear(
      numericRows(afterDarkEndByYearResult.rows, new Set([...stationFields, 'year'])),
    );
    const routesByYear = groupByYear(
      numericRows(routesByYearResult.rows, new Set([...routeFields, 'year'])),
    );
    const memberByYear = groupByYear(
      numericRows(memberByYearResult.rows, new Set([...memberFields, 'year'])),
    );
    const bikeByYear = groupByYear(
      numericRows(bikeByYearResult.rows, new Set([...bikeFields, 'year'])),
    );

    const stationMapFields = new Set(['lat', 'lng', 'mapped_trips', 'mapped_starts', 'mapped_ends']);
    const stations = numericRows(stationMapResult.rows, stationMapFields);
    const stationCentroids = new Map(
      stations.map((row) => [row.station, { lat: row.lat, lng: row.lng }]),
    );

    function attachCentroids(rows) {
      return rows.flatMap((row) => {
        const centroid = stationCentroids.get(row.station);
        if (!centroid) return [];
        return [{ ...row, lat: centroid.lat, lng: centroid.lng }];
      });
    }

    const stationsByYear = groupByYear(
      attachCentroids(
        numericRows(stationMapByYearResult.rows, new Set([...stationMapFields, 'year'])),
      ),
    );

    const stationsByMonth = new Map();
    for (const row of attachCentroids(
      numericRows(stationMapByMonthResult.rows, stationMapFields),
    )) {
      const monthKey = String(row.month)
      if (!stationsByMonth.has(monthKey)) stationsByMonth.set(monthKey, []);
      const { month: _omit, ...rest } = row;
      stationsByMonth.get(monthKey).push(rest);
    }

    function attachTripCentroids(rows) {
      return rows.flatMap((row) => {
        const start = stationCentroids.get(row.start_station);
        const end = stationCentroids.get(row.end_station);
        if (!start || !end) return [];
        return [{
          start_station: row.start_station,
          end_station: row.end_station,
          start_lat: start.lat,
          start_lng: start.lng,
          end_lat: end.lat,
          end_lng: end.lng,
          start_minute: Number(row.start_minute),
          duration_seconds: Number(row.duration_seconds),
          member_casual: row.member_casual,
          rideable_type: row.rideable_type,
          date: row.date,
        }];
      });
    }

    const demoTripsByDate = new Map();
    for (const trip of attachTripCentroids(demoDayTripsResult.rows)) {
      if (!demoTripsByDate.has(trip.date)) demoTripsByDate.set(trip.date, []);
      const { date: _omit, ...rest } = trip;
      demoTripsByDate.get(trip.date).push(rest);
    }

    const demoDays = DEMO_DAYS.map((day) => {
      const trips = demoTripsByDate.get(day.date) ?? [];
      const stationsUsed = new Set();
      for (const trip of trips) {
        stationsUsed.add(trip.start_station);
        stationsUsed.add(trip.end_station);
      }
      return {
        date: day.date,
        label: day.label,
        blurb: day.blurb,
        trip_count: trips.length,
        station_count: stationsUsed.size,
        trips,
      };
    });

    const globalSummary = withTotalTrips(numericRows(summaryResult.rows, SUMMARY_NUMERIC_FIELDS)[0]);
    const daily = numericRows(dailyTripsResult.rows, PERIOD_METRIC_FIELDS);
    console.log('Fetching Hyde Park daily weather from Open-Meteo...');
    const weatherDays = await fetchDailyWeather(globalSummary.first_trip, globalSummary.latest_trip);
    const weather = buildWeatherAnalysis(daily, weatherDays);
    const weatherByDate = new Map(weatherDays.map((row) => [row.date, row]));
    const dailyWithWeather = daily.map((row) => {
      const weatherDay = weatherByDate.get(row.date);
      return {
        ...row,
        temp_mean_f: weatherDay?.temp_mean_f ?? null,
        precip_in: weatherDay?.precip_in ?? null,
      };
    });

    const covid = {
      definition: {
        pre_end: COVID_PRE_END,
        post_start: COVID_POST_START,
        note: 'Pre-COVID ends before 15 Mar 2020. Post-COVID starts 1 Jul 2020 to skip the acute lockdown spring.',
      },
      pre: {
        summary: withTotalTrips(numericRows(summaryPreCovidResult.rows, SUMMARY_NUMERIC_FIELDS)[0]),
        weekday_hour: numericRows(weekdayHourPreCovidResult.rows, weekdayHourFields),
      },
      post: {
        summary: withTotalTrips(numericRows(summaryPostCovidResult.rows, SUMMARY_NUMERIC_FIELDS)[0]),
        weekday_hour: numericRows(weekdayHourPostCovidResult.rows, weekdayHourFields),
      },
    };

    const yearlySummaries = numericRows(
      yearlySummaryResult.rows.map((row) => ({ ...row, year: Number(row.year) })),
      new Set([...SUMMARY_NUMERIC_FIELDS, 'year']),
    );

    const byYear = {};
    for (const row of yearlySummaries) {
      const { year, ...summary } = row;
      byYear[String(year)] = {
        summary: withTotalTrips(summary),
        monthly: monthly.filter((monthRow) => monthRow.month.startsWith(`${year}-`)),
        weekday_hour: weekdayByYear.get(year) ?? [],
        top_start_stations: topStartByYear.get(year) ?? [],
        top_end_stations: topEndByYear.get(year) ?? [],
        after_dark_start_stations: afterDarkStartByYear.get(year) ?? [],
        after_dark_end_stations: afterDarkEndByYear.get(year) ?? [],
        common_routes: routesByYear.get(year) ?? [],
        member_summary: memberByYear.get(year) ?? [],
        bike_summary: bikeByYear.get(year) ?? [],
        stations: stationsByYear.get(year) ?? [],
      };
    }

    const analytics = {
      success: true,
      data: {
        summary: globalSummary,
        monthly,
        daily: dailyWithWeather,
        yearly,
        weekday_hour: numericRows(weekdayHourResult.rows, weekdayHourFields),
        top_start_stations: numericRows(topStartResult.rows, stationFields),
        top_end_stations: numericRows(topEndResult.rows, stationFields),
        after_dark_start_stations: numericRows(afterDarkStartResult.rows, stationFields),
        after_dark_end_stations: numericRows(afterDarkEndResult.rows, stationFields),
        common_routes: numericRows(routesResult.rows, routeFields),
        member_summary: numericRows(memberResult.rows, memberFields),
        bike_summary: numericRows(bikeResult.rows, bikeFields),
        stations,
        stations_by_month: Object.fromEntries(stationsByMonth),
        demo_days: demoDays,
        covid,
        weather,
        forecast: buildNextMonthForecast(monthly, weather.monthly, globalSummary.latest_trip),
        by_year: byYear,
        map_bounds: { ...MAP_BOUNDS },
        generated_at: new Date().toISOString(),
      },
    };

    await fs.writeFile(outputPath, `${JSON.stringify(analytics, null, 2)}\n`);
    console.log(
      `Wrote ${analytics.data.summary.trips.toLocaleString()} trips `
      + `(${Object.keys(byYear).length} years) to ${outputPath}`,
    );
  } finally {
    await pool.end();
  }
}

generateAnalytics().catch((error) => {
  console.error('Analytics generation failed:', error);
  process.exitCode = 1;
});
