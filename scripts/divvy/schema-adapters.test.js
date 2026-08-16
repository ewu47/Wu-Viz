import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTrip } from './schema-adapters.js';
import { tripInZone } from './zone-filter.js';

const source = {
  archiveKey: 'test.zip',
  fileName: 'test.csv',
  period: '2025-01',
  filterVersion: 'uchicago-hyde-park-v1',
};

test('normalizes current Divvy schema without shifting local time', () => {
  const trip = normalizeTrip({
    ride_id: 'ABC',
    rideable_type: 'electric_bike',
    started_at: '2025-01-02 15:30:12.123',
    ended_at: '2025-01-02 15:45:12.123',
    start_station_name: 'University Ave & 57th St',
    end_station_name: 'Ellis Ave & 60th St',
    start_lat: '41.7914',
    start_lng: '-87.5998',
    end_lat: '41.7851',
    end_lng: '-87.6010',
    member_casual: 'member',
  }, source);

  assert.equal(trip.started_at, '2025-01-02 15:30:12.123');
  assert.equal(trip.ended_at, '2025-01-02 15:45:12.123');
  assert.equal(trip.trip_key, 'ride:ABC');
  assert.equal(tripInZone(trip), true);
});

test('normalizes legacy schema and filters by station fallback', () => {
  const trip = normalizeTrip({
    trip_id: '123',
    starttime: '2013-07-01 09:05',
    stoptime: '2013-07-01 09:15',
    from_station_id: '1',
    from_station_name: 'University Ave & 57th St',
    to_station_id: '2',
    to_station_name: 'Ellis Ave & 60th St',
    usertype: 'Subscriber',
  }, source);

  assert.equal(trip.started_at, '2013-07-01 09:05:00');
  assert.equal(trip.member_casual, 'member');
  assert.equal(tripInZone(trip), true);
});

test('normalizes verbose 2018 and 2019 rental headers', () => {
  const trip = normalizeTrip({
    '01 - Rental Details Rental ID': '22178529',
    '01 - Rental Details Local Start Time': '2019-04-01 00:02:22',
    '01 - Rental Details Local End Time': '2019-04-01 00:09:48',
    '03 - Rental Start Station ID': '423',
    '03 - Rental Start Station Name': 'University Ave & 57th St',
    '02 - Rental End Station ID': '424',
    '02 - Rental End Station Name': 'Ellis Ave & 60th St',
    'User Type': 'Subscriber',
  }, source);

  assert.equal(trip.ride_id, '22178529');
  assert.equal(trip.started_at, '2019-04-01 00:02:22');
  assert.equal(tripInZone(trip), true);
});

test('rejects invalid or non-positive duration rows', () => {
  assert.equal(normalizeTrip({
    ride_id: 'bad',
    started_at: '2025-01-02 15:30:00',
    ended_at: '2025-01-02 15:20:00',
  }, source), null);
});
