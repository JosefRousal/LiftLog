import { defineConfig } from 'drizzle-kit';

// Schema is kept in sync with the .NET backend's EF Core migrations by hand / by re-running
// `pnpm run db:introspect` against the real dev database — see docs/TsBackend.md. `db:generate`
// is wired up for when this backend eventually becomes the schema's source of truth, but isn't
// used yet: no drizzle-kit migrations are checked in as part of this port.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://postgres:password@localhost:5400/liftlog',
  },
  casing: 'snake_case',
});
