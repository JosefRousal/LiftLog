import { app } from '../../src/app';

/** The composed Hono app, tested in-process via `app.request(...)` — no bound port needed. */
export function createTestApp() {
  return app;
}
