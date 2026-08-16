import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.resolve(directory, '../../config/uchicago-zone.json');
const zone = JSON.parse(fs.readFileSync(configPath, 'utf8'));

function normalizeName(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

const aliases = new Map(
  Object.entries(zone.stationAliases ?? {}).map(([from, to]) => [
    normalizeName(from),
    normalizeName(to),
  ]),
);
const stationNames = new Set(
  zone.stationNames.map((name) => normalizeName(name)),
);

function canonicalStationName(value) {
  const normalized = normalizeName(value);
  return aliases.get(normalized) ?? normalized;
}

function coordinateInZone(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return lat >= zone.bounds.minLat
    && lat <= zone.bounds.maxLat
    && lng >= zone.bounds.minLng
    && lng <= zone.bounds.maxLng;
}

function endpointInZone(lat, lng, stationName) {
  const coordinateMatch = coordinateInZone(lat, lng);
  if (coordinateMatch !== null) return coordinateMatch;
  return stationNames.has(canonicalStationName(stationName));
}

export function tripInZone(trip) {
  return endpointInZone(
    trip.start_lat,
    trip.start_lng,
    trip.start_station_name,
  ) && endpointInZone(
    trip.end_lat,
    trip.end_lng,
    trip.end_station_name,
  );
}

export const zoneVersion = zone.version;
export const zoneConfig = zone;
