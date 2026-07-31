import { bytesToBase64 } from '@liftlog/shared';
import { describe, expect, it } from 'vitest';
import { createTestApp } from './helpers/app-factory';
import { createTestUser } from './helpers/create-user';
import { jsonRequest } from './helpers/request';

describe('shared item routes', () => {
  it('creates a shared item and fetches it back with the owner rsa public key', async () => {
    const app = createTestApp();
    const user = await createTestUser();
    const rsaKey = new Uint8Array([1, 2, 3, 4]);

    await jsonRequest(app, 'PUT', '/user', {
      id: user.id,
      password: user.password,
      encryptionIV: bytesToBase64(new Uint8Array(16)),
      rsaPublicKey: bytesToBase64(rsaKey),
    });

    const payload = new Uint8Array([5, 6, 7]);
    const iv = new Uint8Array(16).fill(2);
    const createRes = await jsonRequest(app, 'POST', '/shareditem', {
      userId: user.id,
      password: user.password,
      encryptedPayload: { encryptedPayload: bytesToBase64(payload), iv: { value: bytesToBase64(iv) } },
      expiry: new Date(Date.now() + 60_000).toISOString(),
    });
    expect(createRes.status).toBe(200);
    const { id } = (await createRes.json()) as { id: string };
    expect(id).toHaveLength(12);

    const getRes = await app.request(`/shareditem/${id}`);
    expect(getRes.status).toBe(200);
    const body = (await getRes.json()) as {
      rsaPublicKey: { spkiPublicKeyBytes: string };
      encryptedPayload: { encryptedPayload: string; iv: { value: string } };
    };
    expect(body.rsaPublicKey.spkiPublicKeyBytes).toBe(bytesToBase64(rsaKey));
    expect(body.encryptedPayload.encryptedPayload).toBe(bytesToBase64(payload));
    expect(body.encryptedPayload.iv.value).toBe(bytesToBase64(iv));
  });

  it('404s for an unknown shared item id', async () => {
    const app = createTestApp();
    const res = await app.request('/shareditem/does-not-exist');
    expect(res.status).toBe(404);
  });

  it('rejects creating a shared item with the wrong password', async () => {
    const app = createTestApp();
    const user = await createTestUser();

    const res = await jsonRequest(app, 'POST', '/shareditem', {
      userId: user.id,
      password: 'wrong',
      encryptedPayload: {
        encryptedPayload: bytesToBase64(new Uint8Array([1])),
        iv: { value: bytesToBase64(new Uint8Array(16)) },
      },
      expiry: new Date(Date.now() + 60_000).toISOString(),
    });
    expect(res.status).toBe(401);
  });
});
