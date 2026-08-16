-- Correct combined-quarter labels imported before period parsing supported Q1Q2/Q3Q4.
UPDATE divvy_uchicago_trips
SET source_period = CASE source_archive
  WHEN 'Divvy_Stations_Trips_2014_Q1Q2.zip' THEN '2014-Q1Q2'
  WHEN 'Divvy_Stations_Trips_2014_Q3Q4.zip' THEN '2014-Q3Q4'
  WHEN 'Divvy_Trips_2015-Q1Q2.zip' THEN '2015-Q1Q2'
  WHEN 'Divvy_Trips_2015_Q3Q4.zip' THEN '2015-Q3Q4'
  WHEN 'Divvy_Trips_2016_Q1Q2.zip' THEN '2016-Q1Q2'
  WHEN 'Divvy_Trips_2016_Q3Q4.zip' THEN '2016-Q3Q4'
  WHEN 'Divvy_Trips_2017_Q1Q2.zip' THEN '2017-Q1Q2'
  WHEN 'Divvy_Trips_2017_Q3Q4.zip' THEN '2017-Q3Q4'
END
WHERE source_archive IN (
  'Divvy_Stations_Trips_2014_Q1Q2.zip',
  'Divvy_Stations_Trips_2014_Q3Q4.zip',
  'Divvy_Trips_2015-Q1Q2.zip',
  'Divvy_Trips_2015_Q3Q4.zip',
  'Divvy_Trips_2016_Q1Q2.zip',
  'Divvy_Trips_2016_Q3Q4.zip',
  'Divvy_Trips_2017_Q1Q2.zip',
  'Divvy_Trips_2017_Q3Q4.zip'
)
AND source_period IS DISTINCT FROM CASE source_archive
  WHEN 'Divvy_Stations_Trips_2014_Q1Q2.zip' THEN '2014-Q1Q2'
  WHEN 'Divvy_Stations_Trips_2014_Q3Q4.zip' THEN '2014-Q3Q4'
  WHEN 'Divvy_Trips_2015-Q1Q2.zip' THEN '2015-Q1Q2'
  WHEN 'Divvy_Trips_2015_Q3Q4.zip' THEN '2015-Q3Q4'
  WHEN 'Divvy_Trips_2016_Q1Q2.zip' THEN '2016-Q1Q2'
  WHEN 'Divvy_Trips_2016_Q3Q4.zip' THEN '2016-Q3Q4'
  WHEN 'Divvy_Trips_2017_Q1Q2.zip' THEN '2017-Q1Q2'
  WHEN 'Divvy_Trips_2017_Q3Q4.zip' THEN '2017-Q3Q4'
END;

-- Keep the normalized source table lossless. Use this view for standard analysis.
-- Trips shorter than about 15 seconds are usually false starts/docking retries;
-- trips longer than 24 hours are operational anomalies or bikes left undocked.
CREATE OR REPLACE VIEW divvy_uchicago_trips_analysis AS
SELECT
  trip_key,
  ride_id,
  rideable_type,
  started_at,
  ended_at,
  extract(epoch FROM ended_at - started_at)::double precision AS duration_seconds,
  started_at::date AS trip_date,
  date_trunc('month', started_at)::date AS trip_month,
  extract(year FROM started_at)::integer AS trip_year,
  extract(month FROM started_at)::integer AS trip_month_number,
  extract(isodow FROM started_at)::integer AS weekday_iso,
  extract(hour FROM started_at)::integer AS start_hour,
  start_station_name,
  start_station_id,
  end_station_name,
  end_station_id,
  start_lat,
  start_lng,
  end_lat,
  end_lng,
  member_casual,
  source_archive,
  source_file,
  source_period,
  filter_version,
  imported_at,
  start_station_name IS NOT NULL
    AND end_station_name IS NOT NULL AS station_metadata_complete,
  start_lat IS NOT NULL
    AND start_lng IS NOT NULL
    AND end_lat IS NOT NULL
    AND end_lng IS NOT NULL AS coordinate_metadata_complete
FROM divvy_uchicago_trips
WHERE ended_at - started_at >= interval '15 seconds'
  AND ended_at - started_at <= interval '24 hours';

COMMENT ON VIEW divvy_uchicago_trips_analysis IS
  'Analysis-ready UChicago Divvy trips: positive official records between 15 seconds and 24 hours, with derived time and completeness fields.';
