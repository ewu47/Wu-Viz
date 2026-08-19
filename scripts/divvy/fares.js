import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const fareConfig = JSON.parse(
  fs.readFileSync(path.resolve(directory, '../../config/divvy-fares.json'), 'utf8'),
);

export const DIVVY_FARES = fareConfig;
export const RIDERSHIP_ERA_START = fareConfig.era_start;

export function billedMinutes(durationSeconds) {
  if (durationSeconds == null || Number.isNaN(Number(durationSeconds))) return 1;
  return Math.max(1, Math.ceil(Number(durationSeconds) / 60));
}

export function ratesForYear(year) {
  return fareConfig.years[String(year)] ?? fareConfig.years['2026'];
}

function classicBike(bike) {
  return bike === 'classic_bike' || bike === 'docked_bike';
}

function electricBike(bike) {
  return bike === 'electric_bike';
}

export function walkupFare(year, bike, durationSeconds) {
  const rates = ratesForYear(year);
  const minutes = billedMinutes(durationSeconds);
  if (electricBike(bike)) {
    return roundCents(rates.casual_ebike_unlock + rates.casual_ebike_per_min * minutes);
  }
  if (!classicBike(bike)) return null;
  if (rates.casual_classic_block_price > 0 && rates.casual_classic_block_minutes > 0) {
    const blocks = Math.max(1, Math.ceil(minutes / rates.casual_classic_block_minutes));
    return roundCents(rates.casual_classic_block_price * blocks);
  }
  return roundCents(rates.casual_classic_unlock + rates.casual_classic_per_min * minutes);
}

export function memberUsageFare(year, bike, durationSeconds) {
  const rates = ratesForYear(year);
  const minutes = billedMinutes(durationSeconds);
  if (electricBike(bike)) {
    const included = rates.member_ebike_included_min ?? 0;
    const billable = Math.max(0, minutes - included);
    return roundCents(billable * rates.member_ebike_per_min);
  }
  if (!classicBike(bike)) return null;
  const overtime = Math.max(0, minutes - rates.member_classic_included_min);
  return roundCents(overtime * rates.member_classic_overtime_per_min);
}

export function memberSavings(year, bike, durationSeconds) {
  const walkup = walkupFare(year, bike, durationSeconds);
  const usage = memberUsageFare(year, bike, durationSeconds);
  if (walkup == null || usage == null) return null;
  return roundCents(Math.max(0, walkup - usage));
}

export function minutesSql(column = 'duration_seconds') {
  return `GREATEST(1::numeric, CEIL(${column} / 60.0))`;
}

export function walkupFareSql() {
  const minutes = minutesSql();
  const classicBranches = [];
  const ebikeBranches = [];

  for (const [year, rates] of Object.entries(fareConfig.years)) {
    if (rates.casual_classic_block_price > 0 && rates.casual_classic_block_minutes > 0) {
      classicBranches.push(
        `WHEN trip_year = ${year} THEN ${rates.casual_classic_block_price} * GREATEST(1::numeric, CEIL(${minutes} / ${rates.casual_classic_block_minutes}::numeric))`,
      );
    } else {
      classicBranches.push(
        `WHEN trip_year = ${year} THEN ${rates.casual_classic_unlock} + ${rates.casual_classic_per_min} * ${minutes}`,
      );
    }
    ebikeBranches.push(
      `WHEN trip_year = ${year} THEN ${rates.casual_ebike_unlock} + ${rates.casual_ebike_per_min} * ${minutes}`,
    );
  }

  return `
    CASE
      WHEN coalesce(rideable_type, 'not_published') = 'electric_bike' THEN
        CASE
          ${ebikeBranches.join('\n          ')}
          ELSE NULL
        END
      WHEN coalesce(rideable_type, 'not_published') IN ('classic_bike', 'docked_bike') THEN
        CASE
          ${classicBranches.join('\n          ')}
          ELSE NULL
        END
      ELSE NULL
    END
  `;
}

export function memberUsageFareSql() {
  const minutes = minutesSql();
  const classicBranches = [];
  const ebikeBranches = [];

  for (const [year, rates] of Object.entries(fareConfig.years)) {
    classicBranches.push(
      `WHEN trip_year = ${year} THEN GREATEST(0::numeric, ${minutes} - ${rates.member_classic_included_min}) * ${rates.member_classic_overtime_per_min}`,
    );
    const included = rates.member_ebike_included_min ?? 0;
    ebikeBranches.push(
      `WHEN trip_year = ${year} THEN GREATEST(0::numeric, ${minutes} - ${included}) * ${rates.member_ebike_per_min}`,
    );
  }

  return `
    CASE
      WHEN member_casual <> 'member' THEN 0
      WHEN coalesce(rideable_type, 'not_published') = 'electric_bike' THEN
        CASE
          ${ebikeBranches.join('\n          ')}
          ELSE 0
        END
      WHEN coalesce(rideable_type, 'not_published') IN ('classic_bike', 'docked_bike') THEN
        CASE
          ${classicBranches.join('\n          ')}
          ELSE 0
        END
      ELSE 0
    END
  `;
}

export function buildRidershipRollup(rows, { ctaFare = fareConfig.cta_fare } = {}) {
  const monthlyMap = new Map();
  const yearlyMap = new Map();

  for (const row of rows) {
    const year = Number(row.year);
    const month = String(row.month);
    const trips = Number(row.trips) || 0;
    const durationMinutes = Number(row.duration_minutes) || 0;
    const walkup = Number(row.walkup_cost) || 0;
    const usage = Number(row.member_usage_cost) || 0;
    const savings = Number(row.estimated_savings) || 0;
    const memberTrips = row.rider === 'member' ? trips : 0;
    const casualTrips = row.rider === 'casual' ? trips : 0;
    const classic = classicBike(row.bike) ? trips : 0;
    const electric = electricBike(row.bike) ? trips : 0;

    addBucket(yearlyMap, year, {
      year,
      trips,
      member: memberTrips,
      casual: casualTrips,
      classic,
      electric,
      duration_minutes: durationMinutes,
      walkup_cost: walkup,
      member_usage_cost: usage,
      estimated_savings: savings,
    });
    addBucket(monthlyMap, month, {
      month,
      year,
      trips,
      member: memberTrips,
      casual: casualTrips,
      classic,
      electric,
      duration_minutes: durationMinutes,
      walkup_cost: walkup,
      member_usage_cost: usage,
      estimated_savings: savings,
    });
  }

  const by_year = [...yearlyMap.values()]
    .sort((a, b) => a.year - b.year)
    .map((row) => finalizePeriod(row, ctaFare));
  const monthly = [...monthlyMap.values()]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((row) => finalizePeriod(row, ctaFare));

  const totals = finalizePeriod(
    by_year.reduce(
      (acc, row) => {
        acc.trips += row.trips;
        acc.member += row.member;
        acc.casual += row.casual;
        acc.classic += row.classic;
        acc.electric += row.electric;
        acc.duration_minutes += row.duration_minutes;
        acc.walkup_cost += row.walkup_cost;
        acc.member_usage_cost += row.member_usage_cost;
        acc.estimated_savings += row.estimated_savings;
        return acc;
      },
      {
        trips: 0,
        member: 0,
        casual: 0,
        classic: 0,
        electric: 0,
        duration_minutes: 0,
        walkup_cost: 0,
        member_usage_cost: 0,
        estimated_savings: 0,
      },
    ),
    ctaFare,
  );

  return {
    era_start: fareConfig.era_start,
    cta_fare: ctaFare,
    note: fareConfig.note,
    sources: fareConfig.sources,
    by_year,
    monthly,
    totals,
  };
}

function addBucket(map, key, delta) {
  const current = map.get(key) ?? {
    ...delta,
    trips: 0,
    member: 0,
    casual: 0,
    classic: 0,
    electric: 0,
    duration_minutes: 0,
    walkup_cost: 0,
    member_usage_cost: 0,
    estimated_savings: 0,
  };
  current.trips += delta.trips;
  current.member += delta.member;
  current.casual += delta.casual;
  current.classic += delta.classic;
  current.electric += delta.electric;
  current.duration_minutes += delta.duration_minutes;
  current.walkup_cost += delta.walkup_cost;
  current.member_usage_cost += delta.member_usage_cost;
  current.estimated_savings += delta.estimated_savings;
  if (delta.year != null) current.year = delta.year;
  if (delta.month != null) current.month = delta.month;
  map.set(key, current);
}

function finalizePeriod(row, ctaFare) {
  const typed = row.classic + row.electric;
  return {
    ...row,
    member_share: row.trips > 0 ? roundTenth(row.member / row.trips * 100) : 0,
    electric_share: typed > 0 ? roundTenth(row.electric / typed * 100) : null,
    avg_duration_minutes: row.trips > 0 ? roundHundredth(row.duration_minutes / row.trips) : 0,
    walkup_cost: roundCents(row.walkup_cost),
    member_usage_cost: roundCents(row.member_usage_cost),
    estimated_savings: roundCents(row.estimated_savings),
    member_walkup_cost: roundCents(row.estimated_savings + row.member_usage_cost),
    cta_equivalent: roundCents(row.trips * ctaFare),
    savings_per_member_trip: row.member > 0 ? roundCents(row.estimated_savings / row.member) : 0,
  };
}

function roundCents(value) {
  return Number(value.toFixed(2));
}

function roundTenth(value) {
  return Number(value.toFixed(1));
}

function roundHundredth(value) {
  return Number(value.toFixed(2));
}
