import { createPool } from './db.js';
import { zoneConfig } from './zone-filter.js';

async function main() {
  const pool = createPool();
  try {
    const acceptedStationNames = [
      ...zoneConfig.stationNames,
      ...Object.keys(zoneConfig.stationAliases ?? {}),
    ].map((name) => name.trim().toLowerCase());

    const result = await pool.query(`
      SELECT
        count(*)::bigint AS trips,
        count(DISTINCT trip_key)::bigint AS distinct_keys,
        count(*) FILTER (WHERE ride_id IS NULL)::bigint AS missing_ride_id,
        count(DISTINCT ride_id)::bigint AS distinct_ride_ids,
        count(*) FILTER (WHERE ended_at <= started_at)::bigint AS invalid_duration,
        count(*) FILTER (
          WHERE ended_at - started_at < interval '15 seconds'
        )::bigint AS too_short,
        count(*) FILTER (
          WHERE ended_at - started_at > interval '24 hours'
        )::bigint AS too_long,
        count(*) FILTER (
          WHERE start_lat IS NOT NULL AND start_lng IS NOT NULL
            AND NOT (
              start_lat BETWEEN $1 AND $2
              AND start_lng BETWEEN $3 AND $4
            )
        )::bigint AS start_outside_zone,
        count(*) FILTER (
          WHERE end_lat IS NOT NULL AND end_lng IS NOT NULL
            AND NOT (
              end_lat BETWEEN $1 AND $2
              AND end_lng BETWEEN $3 AND $4
            )
        )::bigint AS end_outside_zone,
        count(*) FILTER (
          WHERE (start_lat IS NULL) <> (start_lng IS NULL)
             OR (end_lat IS NULL) <> (end_lng IS NULL)
        )::bigint AS malformed_coordinate_pairs,
        count(*) FILTER (
          WHERE (start_lat IS NULL OR start_lng IS NULL)
            AND (
              start_station_name IS NULL
              OR lower(trim(start_station_name)) <> ALL($5::text[])
            )
        )::bigint AS invalid_start_fallback,
        count(*) FILTER (
          WHERE (end_lat IS NULL OR end_lng IS NULL)
            AND (
              end_station_name IS NULL
              OR lower(trim(end_station_name)) <> ALL($5::text[])
            )
        )::bigint AS invalid_end_fallback,
        count(*) FILTER (
          WHERE member_casual NOT IN ('member', 'casual')
        )::bigint AS invalid_rider_type,
        count(*) FILTER (
          WHERE rideable_type IS NOT NULL
            AND rideable_type NOT IN ('classic_bike', 'electric_bike')
        )::bigint AS invalid_bike_type,
        count(*) FILTER (WHERE source_archive IS NULL)::bigint AS missing_source,
        min(started_at) AS first_trip,
        max(started_at) AS latest_trip
      FROM divvy_uchicago_trips
    `, [
      zoneConfig.bounds.minLat,
      zoneConfig.bounds.maxLat,
      zoneConfig.bounds.minLng,
      zoneConfig.bounds.maxLng,
      acceptedStationNames,
    ]);

    const [archiveMismatch, manifest, analysis, ingestion] = await Promise.all([
      pool.query(`
        SELECT r.archive_key, r.inserted_rows, count(t.trip_key)::bigint AS stored_rows
        FROM divvy_import_runs r
        LEFT JOIN divvy_uchicago_trips t ON t.source_archive = r.archive_key
        WHERE r.status = 'success'
        GROUP BY r.archive_key, r.inserted_rows
        HAVING r.inserted_rows <> count(t.trip_key)
      `),
      pool.query(`
        SELECT
          count(*) FILTER (WHERE status = 'success')::integer AS successful,
          count(*) FILTER (WHERE status <> 'success')::integer AS unsuccessful
        FROM divvy_import_runs
      `),
      pool.query(`
        SELECT
          count(*)::bigint AS trips,
          min(duration_seconds) AS min_duration_seconds,
          max(duration_seconds) AS max_duration_seconds
        FROM divvy_uchicago_trips_analysis
      `),
      pool.query(`
        SELECT
          sum(raw_rows)::bigint AS raw_rows,
          sum(raw_rows - normalized_rows)::bigint AS rejected_rows
        FROM divvy_import_runs
        WHERE status = 'success'
      `),
    ]);

    const metrics = result.rows[0];
    const failures = [];
    if (metrics.trips !== metrics.distinct_keys) failures.push('duplicate trip keys');
    if (metrics.missing_ride_id !== '0') failures.push('missing ride IDs');
    if (metrics.trips !== metrics.distinct_ride_ids) failures.push('duplicate ride IDs');
    if (metrics.invalid_duration !== '0') failures.push('non-positive durations');
    if (metrics.start_outside_zone !== '0') failures.push('start coordinates outside zone');
    if (metrics.end_outside_zone !== '0') failures.push('end coordinates outside zone');
    if (metrics.malformed_coordinate_pairs !== '0') failures.push('malformed coordinate pairs');
    if (metrics.invalid_start_fallback !== '0') failures.push('invalid start station fallback');
    if (metrics.invalid_end_fallback !== '0') failures.push('invalid end station fallback');
    if (metrics.invalid_rider_type !== '0') failures.push('unexpected rider categories');
    if (metrics.invalid_bike_type !== '0') failures.push('unexpected bike categories');
    if (metrics.missing_source !== '0') failures.push('missing source metadata');
    if (archiveMismatch.rowCount) failures.push('archive manifest row-count mismatch');
    if (manifest.rows[0].unsuccessful !== 0) failures.push('unsuccessful archive imports');
    if (Number(analysis.rows[0].min_duration_seconds) < 15) {
      failures.push('analysis view contains trips under 15 seconds');
    }
    if (Number(analysis.rows[0].max_duration_seconds) > 86400) {
      failures.push('analysis view contains trips over 24 hours');
    }

    console.log('Divvy ingestion validation');
    console.log('--------------------------');
    console.log(`Trips:                ${metrics.trips}`);
    console.log(`Distinct keys:        ${metrics.distinct_keys}`);
    console.log(`Distinct ride IDs:    ${metrics.distinct_ride_ids}`);
    console.log(`Invalid durations:    ${metrics.invalid_duration}`);
    console.log(`Starts outside zone:  ${metrics.start_outside_zone}`);
    console.log(`Ends outside zone:    ${metrics.end_outside_zone}`);
    console.log(`Bad coordinate pairs: ${metrics.malformed_coordinate_pairs}`);
    console.log(`Bad station fallback: ${metrics.invalid_start_fallback} start / ${metrics.invalid_end_fallback} end`);
    console.log(`Unexpected categories:${metrics.invalid_rider_type} rider / ${metrics.invalid_bike_type} bike`);
    console.log(`Missing source:       ${metrics.missing_source}`);
    console.log(`Successful archives:  ${manifest.rows[0].successful}`);
    console.log(`Trip range:           ${metrics.first_trip ?? 'n/a'} → ${metrics.latest_trip ?? 'n/a'}`);
    console.log(`Raw rows rejected:    ${ingestion.rows[0].rejected_rows} / ${ingestion.rows[0].raw_rows}`);
    console.log(`Duration exclusions:  ${metrics.too_short} under 15s / ${metrics.too_long} over 24h`);
    console.log(`Analysis-ready trips: ${analysis.rows[0].trips}`);

    if (failures.length) {
      throw new Error(`Validation failed: ${failures.join(', ')}`);
    }
    console.log('Validation passed.');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
