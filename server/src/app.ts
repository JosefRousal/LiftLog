import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { eventRoutes } from './routes/event';
import { eventsRoutes } from './routes/events';
import { followSecretRoutes } from './routes/follow-secret';
import { healthRoutes } from './routes/health';
import { inboxRoutes } from './routes/inbox';
import { sharedItemRoutes } from './routes/shared-item';
import { userRoutes } from './routes/user';
import { usersRoutes } from './routes/users';

const app = new Hono()
  .use('*', cors())
  .route('/', healthRoutes)
  .route('/', userRoutes)
  .route('/', usersRoutes)
  .route('/', eventRoutes)
  .route('/', eventsRoutes)
  .route('/', followSecretRoutes)
  .route('/', inboxRoutes)
  .route('/', sharedItemRoutes);

export type AppType = typeof app;
export { app };
