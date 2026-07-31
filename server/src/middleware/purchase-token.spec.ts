import { Hono } from 'hono';
import { afterEach, describe, expect, it } from 'vitest';
import { purchaseTokenAuth, type PurchaseTokenVariables } from './purchase-token';

function testApp() {
  return new Hono<{ Variables: PurchaseTokenVariables }>().get('/protected', purchaseTokenAuth, (c) =>
    c.json({ proToken: c.get('proToken'), appStore: c.get('appStore') }),
  );
}

describe('purchaseTokenAuth middleware', () => {
  afterEach(() => {
    delete process.env.WEB_AUTH_API_KEY;
  });

  it('rejects a missing Authorization header', async () => {
    const res = await testApp().request('/protected');
    expect(res.status).toBe(401);
  });

  it('rejects a malformed Authorization header', async () => {
    const res = await testApp().request('/protected', { headers: { Authorization: 'garbage' } });
    expect(res.status).toBe(401);
  });

  it('rejects an unknown app store', async () => {
    const res = await testApp().request('/protected', { headers: { Authorization: 'AppleStore sometoken' } });
    expect(res.status).toBe(401);
  });

  it('rejects an invalid token', async () => {
    process.env.WEB_AUTH_API_KEY = 'the-real-key';
    const res = await testApp().request('/protected', { headers: { Authorization: 'Web wrong-key' } });
    expect(res.status).toBe(401);
  });

  it('accepts a valid Web token and exposes it via context variables', async () => {
    process.env.WEB_AUTH_API_KEY = 'the-real-key';
    const res = await testApp().request('/protected', { headers: { Authorization: 'Web the-real-key' } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ proToken: 'the-real-key', appStore: 'Web' });
  });

  it('accepts a Bearer-prefixed token the same way', async () => {
    process.env.WEB_AUTH_API_KEY = 'the-real-key';
    const res = await testApp().request('/protected', { headers: { Authorization: 'Bearer Web the-real-key' } });
    expect(res.status).toBe(200);
  });
});
