import { afterEach, describe, expect, it } from 'vitest';
import { getRateLimit } from '../src/services/rate-limit-service';

describe('rate-limit-service', () => {
  afterEach(() => {
    delete process.env.TEST_MODE;
  });

  it('is not rate limited on the first request for a key', async () => {
    const result = await getRateLimit('RevenueCat', `key-${crypto.randomUUID()}`);
    expect(result.isRateLimited).toBe(false);
  });

  it('rate limits after the AppStore-specific request count is reached (RevenueCat: 20/day)', async () => {
    const key = `key-${crypto.randomUUID()}`;

    for (let i = 0; i < 20; i++) {
      const result = await getRateLimit('RevenueCat', key);
      expect(result.isRateLimited).toBe(false);
    }

    const limited = await getRateLimit('RevenueCat', key);
    expect(limited.isRateLimited).toBe(true);
    expect(limited.retryAfter.getTime()).toBeGreaterThan(Date.now());
  });

  it('gives Web a higher daily limit than other app stores', async () => {
    const key = `key-${crypto.randomUUID()}`;

    for (let i = 0; i < 20; i++) {
      const result = await getRateLimit('Web', key);
      expect(result.isRateLimited).toBe(false);
    }
  });

  it('hashes the rate limit key rather than storing it in plaintext', async () => {
    const key = `plaintext-key-${crypto.randomUUID()}`;
    await getRateLimit('Web', key);

    const { db } = await import('../src/db/client');
    const { rateLimitConsumptions } = await import('../src/db/schema');
    const rows = await db.select().from(rateLimitConsumptions);
    expect(rows.some((r) => r.key === key)).toBe(false);
  });

  it('bypasses the limit entirely when TEST_MODE=True', async () => {
    process.env.TEST_MODE = 'True';
    const key = `key-${crypto.randomUUID()}`;

    for (let i = 0; i < 25; i++) {
      const result = await getRateLimit('RevenueCat', key);
      expect(result.isRateLimited).toBe(false);
    }
  });
});
