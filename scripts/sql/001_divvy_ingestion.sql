CREATE TABLE IF NOT EXISTS divvy_import_runs (
  archive_key text PRIMARY KEY,
  source_url text NOT NULL,
  source_etag text,
  source_size bigint,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'success', 'failed')),
  discovered_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  raw_rows bigint NOT NULL DEFAULT 0,
  normalized_rows bigint NOT NULL DEFAULT 0,
  retained_rows bigint NOT NULL DEFAULT 0,
  inserted_rows bigint NOT NULL DEFAULT 0,
  skipped_rows bigint NOT NULL DEFAULT 0,
  error_message text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS divvy_uchicago_trips (
  trip_key text PRIMARY KEY,
  ride_id text,
  rideable_type text,
  started_at timestamp without time zone NOT NULL,
  ended_at timestamp without time zone NOT NULL,
  start_station_name text,
  start_station_id text,
  end_station_name text,
  end_station_id text,
  start_lat double precision,
  start_lng double precision,
  end_lat double precision,
  end_lng double precision,
  member_casual text,
  source_archive text NOT NULL REFERENCES divvy_import_runs(archive_key),
  source_file text NOT NULL,
  source_period text,
  filter_version text NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT divvy_uchicago_positive_duration CHECK (ended_at > started_at)
);

CREATE INDEX IF NOT EXISTS divvy_uchicago_started_at_idx
  ON divvy_uchicago_trips (started_at);
CREATE INDEX IF NOT EXISTS divvy_uchicago_start_station_idx
  ON divvy_uchicago_trips (start_station_id, start_station_name);
CREATE INDEX IF NOT EXISTS divvy_uchicago_end_station_idx
  ON divvy_uchicago_trips (end_station_id, end_station_name);
CREATE INDEX IF NOT EXISTS divvy_uchicago_member_type_idx
  ON divvy_uchicago_trips (member_casual);
CREATE INDEX IF NOT EXISTS divvy_uchicago_bike_type_idx
  ON divvy_uchicago_trips (rideable_type);
CREATE INDEX IF NOT EXISTS divvy_uchicago_source_archive_idx
  ON divvy_uchicago_trips (source_archive);
