#!/usr/bin/env node
/**
 * Educational Divvy demand model (pure JS, no extra deps).
 *
 * Goal: learn a transparent ML loop on this project's own data.
 *
 * Pipeline:
 *   1) Load daily trips + weather from analytics.json (or rebuild via generate-data)
 *   2) Build a feature matrix (calendar + weather)
 *   3) Fit ordinary least squares (normal equations) for daily trips
 *   4) Backtest the last 90 days (holdout)
 *   5) Aggregate a next-month forecast from daily predictions
 *
 * Run:
 *   npm run generate-data   # needs DB + network for weather
 *   npm run divvy:forecast-learn
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildNextMonthForecast } from './forecast-next-month.js';

const directory = path.dirname(fileURLToPath(import.meta.url));
const analyticsPath = path.resolve(directory, '../../public/analytics.json');

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Transpose matrix. */
function transpose(A) {
  return A[0].map((_, col) => A.map((row) => row[col]));
}

/** Gaussian elimination for square systems. */
function solveLinearSystem(A, b) {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < n; row += 1) {
      if (Math.abs(M[row][col]) > Math.abs(M[pivot][col])) pivot = row;
    }
    [M[col], M[pivot]] = [M[pivot], M[col]];
    const diag = M[col][col];
    if (Math.abs(diag) < 1e-12) throw new Error('Singular feature matrix — add/remove features');

    for (let j = col; j <= n; j += 1) M[col][j] /= diag;
    for (let row = 0; row < n; row += 1) {
      if (row === col) continue;
      const factor = M[row][col];
      for (let j = col; j <= n; j += 1) M[row][j] -= factor * M[col][j];
    }
  }

  return M.map((row) => row[n]);
}

/**
 * Ordinary least squares: beta = (X'X)^{-1} X'y
 * X should include a leading 1s column for the intercept.
 */
function fitOLS(X, y) {
  const Xt = transpose(X);
  const gram = Array.from({ length: Xt.length }, () => Array(Xt.length).fill(0));
  for (let i = 0; i < Xt.length; i += 1) {
    for (let j = 0; j < Xt.length; j += 1) {
      let sum = 0;
      for (let k = 0; k < X.length; k += 1) sum += Xt[i][k] * X[k][j];
      gram[i][j] = sum;
    }
  }
  const Xty = Xt.map((row) => row.reduce((sum, value, index) => sum + value * y[index], 0));
  return solveLinearSystem(gram, Xty);
}

function predict(X, beta) {
  return X.map((row) => row.reduce((sum, value, index) => sum + value * beta[index], 0));
}

function buildDailyRows(analytics) {
  return analytics.weather.monthly.map((row) => {
    const date = new Date(`${row.month}-01T12:00:00`);
    return {
      month: row.month,
      trips: row.trips,
      avg_trips_per_day: row.avg_trips_per_day,
      temp: row.avg_temp_f,
      precip: row.precip_inches,
      month_num: date.getMonth() + 1,
      year: date.getFullYear(),
      sin_month: Math.sin((2 * Math.PI * (date.getMonth() + 1)) / 12),
      cos_month: Math.cos((2 * Math.PI * (date.getMonth() + 1)) / 12),
      post_covid: date >= new Date('2020-07-01T00:00:00') ? 1 : 0,
    };
  });
}

async function main() {
  const raw = JSON.parse(await fs.readFile(analyticsPath, 'utf8'));
  const analytics = raw.data;
  const rows = buildDailyRows(analytics).filter((row) => row.month >= '2015-01');

  // Hold out the last 12 months for honest test error.
  const train = rows.slice(0, -12);
  const test = rows.slice(-12);

  const featureNames = [
    'intercept',
    'temp_f',
    'precip_in',
    'sin_month',
    'cos_month',
    'post_covid',
    'year_index',
  ];

  function rowToFeatures(row) {
    return [
      1,
      row.temp,
      row.precip,
      row.sin_month,
      row.cos_month,
      row.post_covid,
      row.year - 2015,
    ];
  }

  const Xtrain = train.map(rowToFeatures);
  const ytrain = train.map((row) => row.trips);
  const beta = fitOLS(Xtrain, ytrain);

  const yhatTrain = predict(Xtrain, beta);
  const yhatTest = predict(test.map(rowToFeatures), beta);

  const trainMae = mean(train.map((row, i) => Math.abs(yhatTrain[i] - row.trips)));
  const testMae = mean(test.map((row, i) => Math.abs(yhatTest[i] - row.trips)));
  const testMape = mean(test.map((row, i) => Math.abs(yhatTest[i] - row.trips) / row.trips));

  const baseline = buildNextMonthForecast(
    analytics.monthly,
    analytics.weather.monthly,
    analytics.summary.latest_trip,
  );

  // Predict target month with climatology features from same calendar month history.
  const target = baseline.target_month;
  const targetMon = Number(target.slice(5, 7));
  const same = rows.filter((row) => Number(row.month.slice(5, 7)) === targetMon && row.month < target);
  const climTemp = mean(same.map((row) => row.temp));
  const climPrecip = mean(same.map((row) => row.precip));
  const [ty, tm] = target.split('-').map(Number);
  const targetFeatures = [
    1,
    climTemp,
    climPrecip,
    Math.sin((2 * Math.PI * tm) / 12),
    Math.cos((2 * Math.PI * tm) / 12),
    target >= '2020-07' ? 1 : 0,
    ty - 2015,
  ];
  const mlPredicted = Math.round(targetFeatures.reduce((sum, value, index) => sum + value * beta[index], 0));

  console.log('\n=== Divvy forecast lab (learning script) ===\n');
  console.log('Features:', featureNames.join(', '));
  console.log('Coefficients:');
  featureNames.forEach((name, index) => {
    console.log(`  ${name.padEnd(12)} ${beta[index].toFixed(2)}`);
  });
  console.log('\nHoldout (last 12 months):');
  console.log(`  MAE  ${Math.round(testMae).toLocaleString()} trips/month`);
  console.log(`  MAPE ${(testMape * 100).toFixed(1)}%`);
  console.log(`  Train MAE ${Math.round(trainMae).toLocaleString()} (overfit check)`);
  console.log('\nNext-month comparison:');
  console.log(`  Target month          ${target}`);
  console.log(`  Baseline forecast     ${baseline.predicted_trips?.toLocaleString()}`);
  console.log(`  Linear ML forecast    ${mlPredicted.toLocaleString()}`);
  console.log(`  Baseline backtest MAPE ${baseline.backtest.mape}%`);
  console.log('\nHow to read this:');
  console.log('  • Coefficients show direction/strength (temp usually +, precip usually −).');
  console.log('  • If train MAE << test MAE, the model is memorizing — simplify features.');
  console.log('  • After next archive imports, compare both forecasts to actual trips.');
  console.log('  • Next learning step: daily rows (dow dummies) or gradient boosting in Python.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
