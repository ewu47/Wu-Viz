import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { parse } from 'csv-parse';
import unzipper from 'unzipper';
import { createPool } from './db.js';
import { discoverArchives } from './discover-archives.js';
import { normalizeTrip } from './schema-adapters.js';
import { tripInZone, zoneVersion } from './zone-filter.js';

const COLUMNS = [
  'trip_key',
  'ride_id',
  'rideable_type',
  'started_at',
  'ended_at',
  'start_station_name',
  'start_station_id',
  'end_station_name',
  'end_station_id',
  'start_lat',
  'start_lng',
  'end_lat',
  'end_lng',
  'member_casual',
  'source_archive',
  'source_file',
  'source_period',
  'filter_version',
];
const BATCH_SIZE = 250;

function parseArgs(argv) {
  const args = new Set(argv);
  const valueAfter = (flag) => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : null;
  };

  return {
    all: args.has('--all'),
    latest: args.has('--latest'),
    archive: valueAfter('--archive'),
    limit: Number(valueAfter('--limit') ?? 0),
    dryRun: args.has('--dry-run'),
    retryFailed: args.has('--retry-failed'),
  };
}

function archiveLabel(archive) {
  return archive.period ? `${archive.period} (${archive.key})` : archive.key;
}

async function downloadArchive(archive, destination) {
  const response = await fetch(archive.url, {
    headers: { 'user-agent': 'WuViz-Divvy-Importer/1.0' },
  });
  if (!response.ok || !response.body) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  }
  await pipeline(Readable.fromWeb(response.body), (await import('node:fs')).createWriteStream(destination));
}

function placeholders(rows) {
  return rows.map((_, rowIndex) => {
    const offset = rowIndex * COLUMNS.length;
    return `(${COLUMNS.map((__, columnIndex) => `$${offset + columnIndex + 1}`).join(',')})`;
  }).join(',');
}

function values(rows) {
  return rows.flatMap((row) => COLUMNS.map((column) => row[column] ?? null));
}

async function flushBatch(client, batch) {
  if (!batch.length) return;
  await client.query(
    `INSERT INTO divvy_import_stage (${COLUMNS.join(',')})
     VALUES ${placeholders(batch)}`,
    values(batch),
  );
  batch.length = 0;
}

async function parseCsvEntry(entry, archive, client, counters, dryRun) {
  const fileName = entry.path;
  const parser = entry.stream().pipe(parse({
    columns: true,
    bom: true,
    skip_empty_lines: true,
    relax_column_count: true,
    relax_quotes: true,
    trim: true,
  }));
  const batch = [];

  for await (const raw of parser) {
    counters.raw += 1;
    const trip = normalizeTrip(raw, {
      archiveKey: archive.key,
      fileName,
      period: archive.period,
      filterVersion: zoneVersion,
    });
    if (!trip) continue;
    counters.normalized += 1;
    if (!tripInZone(trip)) continue;

    counters.retained += 1;
    if (!dryRun) {
      batch.push(trip);
      if (batch.length >= BATCH_SIZE) {
        await flushBatch(client, batch);
      }
    }
  }

  if (!dryRun) await flushBatch(client, batch);
}

async function setRunState(pool, archive, status, fields = {}) {
  const details = fields.details ?? {};
  await pool.query(`
    INSERT INTO divvy_import_runs (
      archive_key, source_url, source_etag, source_size, status,
      started_at, completed_at, raw_rows, normalized_rows,
      retained_rows, inserted_rows, skipped_rows, error_message, details
    )
    VALUES (
      $1, $2, $3, $4, $5,
      CASE WHEN $5 = 'running' THEN now() ELSE NULL END,
      CASE WHEN $5 IN ('success', 'failed') THEN now() ELSE NULL END,
      $6, $7, $8, $9, $10, $11, $12::jsonb
    )
    ON CONFLICT (archive_key) DO UPDATE SET
      source_url = EXCLUDED.source_url,
      source_etag = EXCLUDED.source_etag,
      source_size = EXCLUDED.source_size,
      status = EXCLUDED.status,
      started_at = CASE WHEN EXCLUDED.status = 'running' THEN now()
                        ELSE divvy_import_runs.started_at END,
      completed_at = CASE WHEN EXCLUDED.status IN ('success', 'failed') THEN now()
                          ELSE NULL END,
      raw_rows = EXCLUDED.raw_rows,
      normalized_rows = EXCLUDED.normalized_rows,
      retained_rows = EXCLUDED.retained_rows,
      inserted_rows = EXCLUDED.inserted_rows,
      skipped_rows = EXCLUDED.skipped_rows,
      error_message = EXCLUDED.error_message,
      details = EXCLUDED.details
  `, [
    archive.key,
    archive.url,
    archive.etag,
    archive.size,
    status,
    fields.raw ?? 0,
    fields.normalized ?? 0,
    fields.retained ?? 0,
    fields.inserted ?? 0,
    fields.skipped ?? 0,
    fields.error ?? null,
    JSON.stringify(details),
  ]);
}

async function importArchive(pool, archive, options) {
  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'wuviz-divvy-'));
  const zipPath = path.join(temporaryDirectory, 'archive.zip');
  const counters = { raw: 0, normalized: 0, retained: 0 };
  const files = [];
  let client;

  console.log(`\nImporting ${archiveLabel(archive)}`);
  if (!options.dryRun) await setRunState(pool, archive, 'running');

  try {
    await downloadArchive(archive, zipPath);
    const zip = await unzipper.Open.file(zipPath);
    const entries = zip.files.filter((entry) => (
      entry.type === 'File'
      && entry.path.toLowerCase().endsWith('.csv')
      && !entry.path.includes('__MACOSX')
    ));
    if (!entries.length) throw new Error('Archive contains no CSV files');

    if (!options.dryRun) {
      client = await pool.connect();
      await client.query('BEGIN');
      await client.query(`
        CREATE TEMP TABLE divvy_import_stage
        (LIKE divvy_uchicago_trips INCLUDING DEFAULTS)
        ON COMMIT DROP
      `);
    }

    for (const entry of entries) {
      files.push(entry.path);
      console.log(`  Parsing ${entry.path}`);
      await parseCsvEntry(entry, archive, client, counters, options.dryRun);
    }

    if (counters.normalized === 0) {
      throw new Error('No recognizable trip rows were found in the archive');
    }

    let inserted = 0;
    if (!options.dryRun) {
      const merge = await client.query(`
        INSERT INTO divvy_uchicago_trips (${COLUMNS.join(',')})
        SELECT ${COLUMNS.join(',')} FROM divvy_import_stage
        ON CONFLICT (trip_key) DO NOTHING
      `);
      inserted = merge.rowCount ?? 0;
      await client.query('COMMIT');
      client.release();
      client = null;

      await setRunState(pool, archive, 'success', {
        ...counters,
        inserted,
        skipped: counters.retained - inserted,
        details: { files, filterVersion: zoneVersion },
      });
    }

    console.log(
      `  ${options.dryRun ? 'Dry run:' : 'Done:'} `
      + `${counters.raw.toLocaleString()} raw, `
      + `${counters.normalized.toLocaleString()} normalized, `
      + `${counters.retained.toLocaleString()} retained`
      + (options.dryRun ? '' : `, ${inserted.toLocaleString()} inserted`),
    );
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK').catch(() => {});
      client.release();
    }
    if (!options.dryRun) {
      await setRunState(pool, archive, 'failed', {
        ...counters,
        error: error instanceof Error ? error.message : String(error),
        details: { files, filterVersion: zoneVersion },
      });
    }
    throw error;
  } finally {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  }
}

async function selectArchives(pool, archives, options) {
  const runs = await pool.query('SELECT archive_key, status FROM divvy_import_runs');
  const runByKey = new Map(runs.rows.map((run) => [run.archive_key, run.status]));

  if (options.archive) {
    const exact = archives.find((item) => item.key === options.archive);
    const partial = archives.filter((item) => item.key.includes(options.archive));
    const match = exact ?? (partial.length === 1 ? partial[0] : null);
    if (match) {
      return !options.dryRun && runByKey.get(match.key) === 'success'
        ? []
        : [match];
    }
    if (partial.length > 1) {
      throw new Error(`Archive selector is ambiguous: ${partial.map((item) => item.key).join(', ')}`);
    }
    throw new Error(`Archive not found: ${options.archive}`);
  }

  if (options.latest) {
    const latest = archives.at(-1);
    if (!latest) return [];
    return runByKey.get(latest.key) === 'success' ? [] : [latest];
  }

  if (!options.all && !options.retryFailed) {
    throw new Error('Choose one: --all, --latest, --archive <key>, or --retry-failed');
  }

  let selected = archives.filter((archive) => {
    const status = runByKey.get(archive.key);
    if (options.retryFailed) return status === 'failed';
    return status !== 'success';
  });

  if (options.limit > 0) selected = selected.slice(0, options.limit);
  return selected;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const pool = createPool();

  try {
    const archives = await discoverArchives();
    const selected = await selectArchives(pool, archives, options);
    console.log(`Discovered ${archives.length} official archives; selected ${selected.length}.`);
    if (!selected.length) {
      console.log('Nothing to import.');
      return;
    }

    for (const archive of selected) {
      try {
        await importArchive(pool, archive, options);
      } catch (error) {
        console.error(`  Failed ${archive.key}:`, error instanceof Error ? error.message : error);
        if (options.archive || options.latest || options.dryRun) throw error;
      }
    }

    if (!options.dryRun) {
      console.log('\nRefreshing PostgreSQL planner statistics...');
      await pool.query('ANALYZE divvy_uchicago_trips');
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
