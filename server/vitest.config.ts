import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.spec.ts', 'tests/**/*.spec.ts'],
    env: {
      DATABASE_URL: process.env.DATABASE_URL ?? 'postgres://postgres:password@localhost:5401/liftlog',
    },
    globalSetup: ['./tests/helpers/migrate.ts'],
    setupFiles: ['./tests/helpers/setup.ts'],
    // Integration tests share one real Postgres database and each truncates it in `beforeEach` —
    // running test files in parallel lets one file's truncate wipe data another file's test is
    // mid-way through using. Keep this off unless the reset strategy changes to per-test
    // transactions instead of truncation.
    fileParallelism: false,
  },
});
