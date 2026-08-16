import { createHash } from 'node:crypto';

function cleanHeader(value) {
  return String(value ?? '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function canonicalRow(raw) {
  return Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [cleanHeader(key), value]),
  );
}

function first(row, keys) {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return null;
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function timestampOrNull(value) {
  if (!value) return null;
  const normalized = String(value).trim();

  // Divvy timestamps are local Chicago wall-clock times without a timezone.
  // Keep those components unchanged when inserting into PostgreSQL's
  // timestamp-without-time-zone columns.
  const modern = normalized.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}(?:\.\d+)?))?$/,
  );
  if (modern) {
    const [, year, month, day, hour, minute, second = '00'] = modern;
    const candidate = `${year}-${month}-${day} ${hour}:${minute}:${second}`;
    const validation = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
    return Number.isNaN(validation.getTime()) ? null : candidate;
  }

  const legacy = normalized.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/,
  );
  if (!legacy) return null;

  const [, month, day, year, hour, minute, second = '0'] = legacy;
  const candidate = [
    year,
    month.padStart(2, '0'),
    day.padStart(2, '0'),
  ].join('-') + ` ${hour.padStart(2, '0')}:${minute}:${second.padStart(2, '0')}`;
  const validation = new Date(
    `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    + `T${hour.padStart(2, '0')}:${minute}:${second.padStart(2, '0')}Z`,
  );
  return Number.isNaN(validation.getTime()) ? null : candidate;
}

function normalizeRiderType(value) {
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower.includes('subscriber') || lower.includes('member')) return 'member';
  if (lower.includes('customer') || lower.includes('casual')) return 'casual';
  return lower;
}

function normalizeBikeType(value) {
  if (!value) return null;
  const lower = value.toLowerCase().replaceAll(' ', '_');
  if (lower.includes('electric')) return 'electric_bike';
  if (lower.includes('classic') || lower.includes('docked')) return 'classic_bike';
  return lower;
}

export function normalizeTrip(raw, source) {
  const row = canonicalRow(raw);
  const startedAt = timestampOrNull(first(row, [
    'started_at',
    'start_time',
    'starttime',
    'start_date',
    '01_rental_details_local_start_time',
  ]));
  const endedAt = timestampOrNull(first(row, [
    'ended_at',
    'end_time',
    'stoptime',
    'stop_time',
    'end_date',
    '01_rental_details_local_end_time',
  ]));

  // Canonical YYYY-MM-DD HH:mm:ss strings sort chronologically.
  if (!startedAt || !endedAt || endedAt <= startedAt) {
    return null;
  }

  const rideId = first(row, [
    'ride_id',
    'trip_id',
    'tripid',
    '01_rental_details_rental_id',
  ]);
  const startStationName = first(row, [
    'start_station_name',
    'from_station_name',
    'from_station',
    '03_rental_start_station_name',
  ]);
  const endStationName = first(row, [
    'end_station_name',
    'to_station_name',
    'to_station',
    '02_rental_end_station_name',
  ]);
  const startStationId = first(row, [
    'start_station_id',
    'from_station_id',
    '03_rental_start_station_id',
  ]);
  const endStationId = first(row, [
    'end_station_id',
    'to_station_id',
    '02_rental_end_station_id',
  ]);

  const identity = rideId
    ? `ride:${rideId}`
    : [
        source.archiveKey,
        startedAt,
        endedAt,
        startStationId ?? startStationName ?? '',
        endStationId ?? endStationName ?? '',
        first(row, ['bikeid', 'bike_id']) ?? '',
      ].join('|');
  const tripKey = rideId
    ? identity
    : `legacy:${createHash('sha256').update(identity).digest('hex')}`;

  return {
    trip_key: tripKey,
    ride_id: rideId,
    rideable_type: normalizeBikeType(first(row, [
      'rideable_type', 'bike_type',
    ])),
    started_at: startedAt,
    ended_at: endedAt,
    start_station_name: startStationName,
    start_station_id: startStationId,
    end_station_name: endStationName,
    end_station_id: endStationId,
    start_lat: numberOrNull(first(row, ['start_lat', 'from_latitude'])),
    start_lng: numberOrNull(first(row, ['start_lng', 'start_lon', 'from_longitude'])),
    end_lat: numberOrNull(first(row, ['end_lat', 'to_latitude'])),
    end_lng: numberOrNull(first(row, ['end_lng', 'end_lon', 'to_longitude'])),
    member_casual: normalizeRiderType(first(row, [
      'member_casual', 'usertype', 'user_type',
    ])),
    source_archive: source.archiveKey,
    source_file: source.fileName,
    source_period: source.period,
    filter_version: source.filterVersion,
  };
}
