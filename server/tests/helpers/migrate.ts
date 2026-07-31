import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';

const schemaSql = readFileSync(fileURLToPath(new URL('./schema.sql', import.meta.url)), 'utf8');

/** Runs once before the whole test run: (re)creates the schema from a clean slate. */
export default async function globalSetup(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL ?? 'postgres://postgres:password@localhost:5401/liftlog';
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query(schemaSql);
  } finally {
    await client.end();
  }
}
