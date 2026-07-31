import { afterEach, describe, expect, it, vi } from 'vitest';
import { isValidPurchaseToken } from './index';

describe('purchase-verification dispatcher', () => {
  afterEach(() => {
    delete process.env.WEB_AUTH_API_KEY;
    delete process.env.REVENUECAT_API_KEY;
    delete process.env.REVENUECAT_PROJECT_ID;
    vi.unstubAllGlobals();
  });

  it('dispatches Web tokens to the web-auth verifier', async () => {
    process.env.WEB_AUTH_API_KEY = 'test-web-auth-key-12345';
    expect(await isValidPurchaseToken('Web', 'test-web-auth-key-12345')).toBe(true);
    expect(await isValidPurchaseToken('Web', 'wrong')).toBe(false);
  });

  it('swallows verifier errors and returns false rather than throwing', async () => {
    process.env.REVENUECAT_API_KEY = 'test-key';
    process.env.REVENUECAT_PROJECT_ID = 'test-project';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));

    await expect(isValidPurchaseToken('RevenueCat', 'some-user')).resolves.toBe(false);
  });
});
