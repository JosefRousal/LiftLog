import { bytesToBase64 } from '@liftlog/shared';
import { describe, expect, it } from 'vitest';
import { createTestApp } from './helpers/app-factory';
import { createTestUser } from './helpers/create-user';
import { jsonRequest } from './helpers/request';

describe('user routes', () => {
  it('creates a user and fetches it by id and by lookup', async () => {
    const app = createTestApp();
    const user = await createTestUser();
    expect(user.id).toBeTruthy();
    expect(user.lookup).toHaveLength(12);
    expect(user.password).toBeTruthy();

    const byId = await app.request(`/user/${user.id}`);
    expect(byId.status).toBe(200);
    const byIdBody = (await byId.json()) as { id: string; lookup: string };
    expect(byIdBody.id).toBe(user.id);

    const byLookup = await app.request(`/user/${user.lookup}`);
    expect(byLookup.status).toBe(200);
    const byLookupBody = (await byLookup.json()) as { id: string };
    expect(byLookupBody.id).toBe(user.id);
  });

  it('returns 404 for an unknown user', async () => {
    const app = createTestApp();
    const res = await app.request(`/user/${crypto.randomUUID()}`);
    expect(res.status).toBe(404);
  });

  it('rejects PUT /user with the wrong password', async () => {
    const app = createTestApp();
    const user = await createTestUser();

    const res = await jsonRequest(app, 'PUT', '/user', {
      id: user.id,
      password: 'wrong-password',
      encryptionIV: bytesToBase64(new Uint8Array(16)),
      rsaPublicKey: bytesToBase64(new Uint8Array([1, 2, 3])),
    });

    expect(res.status).toBe(401);
  });

  it('updates and round-trips encrypted plan/name/keys through PUT and GET /user', async () => {
    const app = createTestApp();
    const user = await createTestUser();
    const plan = new Uint8Array([9, 9, 9]);
    const iv = new Uint8Array(16).fill(3);
    const rsaKey = new Uint8Array([4, 5, 6, 7]);

    const putRes = await jsonRequest(app, 'PUT', '/user', {
      id: user.id,
      password: user.password,
      encryptedCurrentPlan: bytesToBase64(plan),
      encryptionIV: bytesToBase64(iv),
      rsaPublicKey: bytesToBase64(rsaKey),
    });
    expect(putRes.status).toBe(200);

    const getRes = await app.request(`/user/${user.id}`);
    const body = (await getRes.json()) as { encryptedCurrentPlan: string; encryptionIV: string; rsaPublicKey: string };
    expect(body.encryptedCurrentPlan).toBe(bytesToBase64(plan));
    expect(body.encryptionIV).toBe(bytesToBase64(iv));
    expect(body.rsaPublicKey).toBe(bytesToBase64(rsaKey));
  });

  it('deletes a user only with the correct password', async () => {
    const app = createTestApp();
    const user = await createTestUser();

    const wrongDelete = await jsonRequest(app, 'POST', '/user/delete', { id: user.id, password: 'wrong' });
    expect(wrongDelete.status).toBe(401);

    const delRes = await jsonRequest(app, 'POST', '/user/delete', { id: user.id, password: user.password });
    expect(delRes.status).toBe(200);

    const getRes = await app.request(`/user/${user.id}`);
    expect(getRes.status).toBe(404);
  });

  it('batch-fetches users via POST /users', async () => {
    const app = createTestApp();
    const a = await createTestUser();
    const b = await createTestUser();

    const res = await jsonRequest(app, 'POST', '/users', { ids: [a.id, b.id, crypto.randomUUID()] });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { users: Record<string, { id: string }> };
    expect(Object.keys(body.users).sort()).toEqual([a.id, b.id].sort());
  });
});
