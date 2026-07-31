import { serve } from '@hono/node-server';
import { app } from './app';
import { config } from './config';
import { startCleanupJob } from './jobs/cleanup-expired-events';

startCleanupJob();

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`Listening on http://localhost:${info.port}`);
});
