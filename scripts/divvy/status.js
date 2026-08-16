import { createPool } from './db.js';
import { discoverArchives } from './discover-archives.js';

async function main() {
  const pool = createPool();
  try {
    const [archives, runs, totals] = await Promise.all([
      discoverArchives(),
      pool.query(`
        SELECT archive_key, status, retained_rows, inserted_rows,
               completed_at, error_message
        FROM divvy_import_runs
        ORDER BY archive_key
      `),
      pool.query(`
        SELECT count(*)::bigint AS trips,
               min(started_at) AS first_trip,
               max(started_at) AS latest_trip,
               count(DISTINCT source_archive)::int AS archives
        FROM divvy_uchicago_trips
      `),
    ]);

    const runByKey = new Map(runs.rows.map((run) => [run.archive_key, run]));
    const missing = archives.filter((archive) => !runByKey.has(archive.key));
    const failed = runs.rows.filter((run) => run.status === 'failed');
    const running = runs.rows.filter((run) => run.status === 'running');
    const successful = runs.rows.filter((run) => run.status === 'success');

    console.log('Divvy ingestion status');
    console.log('----------------------');
    console.log(`Discovered archives: ${archives.length}`);
    console.log(`Successful imports:  ${successful.length}`);
    console.log(`Missing archives:     ${missing.length}`);
    console.log(`Failed imports:       ${failed.length}`);
    console.log(`Running imports:      ${running.length}`);
    console.log(`UChicago trips:       ${totals.rows[0].trips}`);
    console.log(`Trip range:           ${totals.rows[0].first_trip ?? 'n/a'} → ${totals.rows[0].latest_trip ?? 'n/a'}`);

    if (missing.length) {
      console.log('\nNext missing archives:');
      for (const archive of missing.slice(0, 10)) {
        console.log(`  ${archive.key}`);
      }
      if (missing.length > 10) console.log(`  …and ${missing.length - 10} more`);
    }

    if (failed.length) {
      console.log('\nFailed archives:');
      for (const run of failed) {
        console.log(`  ${run.archive_key}: ${run.error_message}`);
      }
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  if (error.code === '42P01') {
    console.error('Ingestion tables do not exist. Run: npm run divvy:migrate');
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});
