import { bytesToBase64 } from '@liftlog/shared';
import { describe, expect, it } from 'vitest';
import { createTestApp } from './helpers/app-factory';
import { createTestUser } from './helpers/create-user';
import { jsonRequest } from './helpers/request';

describe('inbox routes', () => {
  it('delivers a message and then clears the inbox on fetch', async () => {
    const app = createTestApp();
    const user = await createTestUser();
    const chunks = [new Uint8Array([1, 2]), new Uint8Array([3, 4])];

    const putRes = await jsonRequest(app, 'PUT', '/inbox', {
      toUserId: user.id,
      encryptedMessage: chunks.map((c) => bytesToBase64(c)),
    });
    expect(putRes.status).toBe(200);

    const getRes = await jsonRequest(app, 'POST', '/inbox', { userId: user.id, password: user.password });
    expect(getRes.status).toBe(200);
    const body = (await getRes.json()) as { inboxMessages: { encryptedMessage: string[] }[] };
    expect(body.inboxMessages).toHaveLength(1);
    expect(body.inboxMessages[0]?.encryptedMessage).toEqual(chunks.map((c) => bytesToBase64(c)));

    const secondGetRes = await jsonRequest(app, 'POST', '/inbox', { userId: user.id, password: user.password });
    const secondBody = (await secondGetRes.json()) as { inboxMessages: unknown[] };
    expect(secondBody.inboxMessages).toHaveLength(0);
  });

  it('rejects fetching the inbox with the wrong password', async () => {
    const app = createTestApp();
    const user = await createTestUser();

    const res = await jsonRequest(app, 'POST', '/inbox', { userId: user.id, password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('404s when delivering to an unknown user', async () => {
    const app = createTestApp();
    const res = await jsonRequest(app, 'PUT', '/inbox', {
      toUserId: crypto.randomUUID(),
      encryptedMessage: [bytesToBase64(new Uint8Array([1]))],
    });
    expect(res.status).toBe(404);
  });
});
