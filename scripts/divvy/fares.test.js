import test from 'node:test';
import assert from 'node:assert/strict';
import {
  billedMinutes,
  memberSavings,
  memberUsageFare,
  walkupFare,
} from './fares.js';

test('bills whole minutes, rounding up', () => {
  assert.equal(billedMinutes(60), 1);
  assert.equal(billedMinutes(61), 2);
  assert.equal(billedMinutes(10), 1);
});

test('2024 member classic 10-minute ride avoids the walk-up fare', () => {
  const seconds = 10 * 60;
  assert.equal(walkupFare(2024, 'classic_bike', seconds), 2.8);
  assert.equal(memberUsageFare(2024, 'classic_bike', seconds), 0);
  assert.equal(memberSavings(2024, 'classic_bike', seconds), 2.8);
});

test('2024 member e-bike 10-minute ride still beats casual pricing', () => {
  const seconds = 10 * 60;
  assert.equal(walkupFare(2024, 'electric_bike', seconds), 5.4);
  assert.equal(memberUsageFare(2024, 'electric_bike', seconds), 1.8);
  assert.equal(memberSavings(2024, 'electric_bike', seconds), 3.6);
});

test('2021 Hyde Park member e-bikes were included for 45 minutes', () => {
  const seconds = 12 * 60;
  assert.equal(memberUsageFare(2021, 'electric_bike', seconds), 0);
  assert.equal(memberSavings(2021, 'electric_bike', seconds), 5.2);
});

test('2020 casual classic used 30-minute blocks', () => {
  assert.equal(walkupFare(2020, 'classic_bike', 10 * 60), 3);
  assert.equal(walkupFare(2020, 'classic_bike', 31 * 60), 6);
});
