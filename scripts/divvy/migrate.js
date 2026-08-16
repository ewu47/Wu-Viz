import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPool } from './db.js';

const directory = path.dirname(fileURLToPath(import.meta.url));
const migrationDirectory = path.resolve(directory, '../sql');

async function main() {
  const pool = createPool();
  try {
    const migrationFiles = (await fs.readdir(migrationDirectory))
      .filter((fileName) => fileName.endsWith('.sql'))
      .sort();

    for (const fileName of migrationFiles) {
      const sql = await fs.readFile(path.join(migrationDirectory, fileName), 'utf8');
      await pool.query(sql);
      console.log(`Applied ${fileName}`);
    }
    console.log('Divvy ingestion schema is ready.');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exitCode = 1;
});
