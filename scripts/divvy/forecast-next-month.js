/**
 * Next-month campus Divvy demand forecast.
 *
 * Designed to land just ahead of the next official monthly archive:
 * if the latest analysis day is 2026-07-31, we forecast 2026-08.
 * When that archive is imported and regenerate-data runs, you can score
 * the previous forecast against reality.
 */

function parseMonth(month) {
  const [year, mon] = month.split('-').map(Number);
  return { year, month: mon, key: month };
}

function addMonths(monthKey, delta) {
  const { year, month } = parseMonth(monthKey);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthIndex(monthKey) {
  return parseMonth(monthKey).month;
}

function mean(values) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stdev(values) {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * @param {Array<{ month: string, trips: number }>} monthly
 * @param {Array<{ month: string, avg_temp_f: number, precip_inches: number, avg_trips_per_day: number }>} weatherMonthly
 * @param {string} latestTripDate YYYY-MM-DD
 */
export function buildNextMonthForecast(monthly, weatherMonthly, latestTripDate) {
  const latestMonth = latestTripDate.slice(0, 7);
  const targetMonth = addMonths(latestMonth, 1);
  const targetMon = monthIndex(targetMonth);
  const weatherByMonth = new Map(weatherMonthly.map((row) => [row.month, row]));

  const history = monthly
    .filter((row) => row.month <= latestMonth)
    .map((row) => ({
      ...row,
      weather: weatherByMonth.get(row.month) ?? null,
    }));

  function predictFor(target) {
    const mon = monthIndex(target);
    const sameMonth = history.filter((row) => monthIndex(row.month) === mon && row.month < target);
    const recentSame = sameMonth.filter((row) => parseMonth(row.month).year >= parseMonth(target).year - 4);
    const seasonalPool = recentSame.length >= 2 ? recentSame : sameMonth;
    const seasonal = mean(seasonalPool.map((row) => row.trips));

    const lastYearKey = addMonths(target, -12);
    const yoyRow = history.find((row) => row.month === lastYearKey);
    const yoy = yoyRow?.trips ?? null;

    const last3 = [1, 2, 3].map((n) => history.find((row) => row.month === addMonths(target, -n))).filter(Boolean);
    const priorYear3 = [13, 14, 15].map((n) => history.find((row) => row.month === addMonths(target, -n))).filter(Boolean);
    const recentAvg = mean(last3.map((row) => row.trips));
    const priorAvg = mean(priorYear3.map((row) => row.trips));
    const trendRatio = recentAvg && priorAvg ? recentAvg / priorAvg : 1;

    const climTemps = seasonalPool
      .map((row) => row.weather?.avg_temp_f)
      .filter((value) => value != null);
    const climPrecip = seasonalPool
      .map((row) => row.weather?.precip_inches)
      .filter((value) => value != null);
    const expectedTemp = mean(climTemps);
    const expectedPrecip = mean(climPrecip);

    // Mild weather bonus/penalty from historical same-month residuals vs seasonal mean.
    let weatherAdj = 1;
    if (expectedTemp != null && seasonalPool.length >= 3) {
      const mildCenter = 62;
      const tempFactor = 1 + Math.max(-0.12, Math.min(0.12, (expectedTemp - mildCenter) / 200));
      const precipFactor = expectedPrecip != null
        ? 1 - Math.max(0, Math.min(0.1, (expectedPrecip - 2.5) * 0.02))
        : 1;
      weatherAdj = tempFactor * precipFactor;
    }

    const parts = [];
    const weights = [];
    if (seasonal != null) {
      parts.push(seasonal * trendRatio * weatherAdj);
      weights.push(0.55);
    }
    if (yoy != null) {
      parts.push(yoy * weatherAdj);
      weights.push(0.30);
    }
    if (recentAvg != null) {
      // Scale recent level toward seasonal month length/shape via seasonal if present.
      parts.push(seasonal != null ? (recentAvg / (mean(history.slice(-3).map((r) => r.trips)) || recentAvg)) * seasonal : recentAvg);
      weights.push(0.15);
    }

    const weightSum = weights.reduce((sum, value) => sum + value, 0);
    const predicted = weightSum > 0
      ? parts.reduce((sum, value, index) => sum + value * weights[index], 0) / weightSum
      : null;

    return {
      predicted_trips: predicted == null ? null : Math.round(predicted),
      components: {
        seasonal_same_month: seasonal == null ? null : Math.round(seasonal),
        same_month_last_year: yoy,
        trend_ratio: Number(trendRatio.toFixed(3)),
        weather_adjustment: Number(weatherAdj.toFixed(3)),
        expected_temp_f: expectedTemp == null ? null : Number(expectedTemp.toFixed(1)),
        expected_precip_in: expectedPrecip == null ? null : Number(expectedPrecip.toFixed(2)),
        same_month_samples: seasonalPool.length,
      },
    };
  }

  // Backtest: for each of the last up to 24 complete months, predict as if that month were "next".
  const errors = [];
  const backtestMonths = history.slice(-25, -1);
  for (const row of backtestMonths) {
    const truncated = history.filter((item) => item.month < row.month);
    if (truncated.length < 24) continue;
    const { predicted_trips } = predictFor(row.month);
    if (predicted_trips == null || row.trips <= 0) continue;
    errors.push({
      month: row.month,
      actual: row.trips,
      predicted: predicted_trips,
      abs_error: Math.abs(predicted_trips - row.trips),
      pct_error: Math.abs(predicted_trips - row.trips) / row.trips,
    });
  }

  const forecast = predictFor(targetMonth);
  const mae = mean(errors.map((row) => row.abs_error));
  const mape = mean(errors.map((row) => row.pct_error));
  const errorSpread = stdev(errors.map((row) => row.predicted - row.actual));
  const band = Math.round((mae || forecast.predicted_trips * 0.15) * 1.25);

  const daysInTarget = new Date(
    Date.UTC(parseMonth(targetMonth).year, parseMonth(targetMonth).month, 0),
  ).getUTCDate();

  return {
    target_month: targetMonth,
    based_on_latest_trip: latestTripDate,
    method: 'seasonal same-month blend + YoY + short trend + climatology weather adjustment',
    predicted_trips: forecast.predicted_trips,
    low: forecast.predicted_trips == null ? null : Math.max(0, forecast.predicted_trips - band),
    high: forecast.predicted_trips == null ? null : forecast.predicted_trips + band,
    predicted_trips_per_day: forecast.predicted_trips == null
      ? null
      : Number((forecast.predicted_trips / daysInTarget).toFixed(1)),
    components: forecast.components,
    backtest: {
      months_scored: errors.length,
      mae_trips: mae == null ? null : Math.round(mae),
      mape: mape == null ? null : Number((mape * 100).toFixed(1)),
      error_stdev: errorSpread == null ? null : Math.round(errorSpread),
      recent: errors.slice(-6),
    },
    learning_notes: [
      'This is an interpretable baseline, not a black-box model.',
      'When the next Divvy archive lands, compare actual trips in target_month to predicted_trips.',
      'Run `npm run divvy:forecast-learn` for a linear ML version with explicit features and holdout metrics.',
    ],
  };
}
