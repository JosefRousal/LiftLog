import { Hono } from 'hono';

export const healthRoutes = new Hono().on(['GET', 'HEAD'], '/health', (c) => c.text('healthy'));
