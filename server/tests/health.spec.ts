import { describe, expect, it } from 'vitest';
import { createTestApp } from './helpers/app-factory';

describe('GET /health', () => {
  it('returns healthy', async () => {
    const app = createTestApp();
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('healthy');
  });
});
