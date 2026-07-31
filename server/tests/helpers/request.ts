import type { Hono } from 'hono';

export function jsonRequest(app: Hono, method: string, path: string, body: unknown) {
  return app.request(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
