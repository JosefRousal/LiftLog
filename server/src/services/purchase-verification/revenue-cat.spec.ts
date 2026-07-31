import { afterEach, describe, expect, it, vi } from 'vitest';
import { getUserIdHasProEntitlement } from './revenue-cat';

describe('revenue-cat purchase verification', () => {
  afterEach(() => {
    delete process.env.REVENUECAT_API_KEY;
    delete process.env.REVENUECAT_PROJECT_ID;
    delete process.env.REVENUECAT_PRO_ENTITLEMENT_ID;
    vi.unstubAllGlobals();
  });

  it('returns false when RevenueCat is not configured', async () => {
    expect(await getUserIdHasProEntitlement('user-1')).toBe(false);
  });

  it('returns true when the customer has the configured pro entitlement', async () => {
    process.env.REVENUECAT_API_KEY = 'test-key';
    process.env.REVENUECAT_PROJECT_ID = 'test-project';
    process.env.REVENUECAT_PRO_ENTITLEMENT_ID = 'pro';

    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ active_entitlements: { items: [{ entitlement_id: 'pro' }] } }), { status: 200 }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await getUserIdHasProEntitlement('user-1');

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.revenuecat.com/v2/projects/test-project/customers/user-1',
      expect.objectContaining({ headers: { Authorization: 'Bearer test-key' } }),
    );
  });

  it('returns false when the customer lacks the pro entitlement', async () => {
    process.env.REVENUECAT_API_KEY = 'test-key';
    process.env.REVENUECAT_PROJECT_ID = 'test-project';
    process.env.REVENUECAT_PRO_ENTITLEMENT_ID = 'pro';

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ active_entitlements: { items: [{ entitlement_id: 'other' }] } }), {
          status: 200,
        }),
      ),
    );

    expect(await getUserIdHasProEntitlement('user-1')).toBe(false);
  });

  it('returns false when the RevenueCat request fails', async () => {
    process.env.REVENUECAT_API_KEY = 'test-key';
    process.env.REVENUECAT_PROJECT_ID = 'test-project';

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })));

    expect(await getUserIdHasProEntitlement('user-1')).toBe(false);
  });
});
