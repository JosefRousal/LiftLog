import { bytesToBase64 } from '@liftlog/shared';
import { describe, expect, it } from 'vitest';
import { createTestApp } from './helpers/app-factory';
import { createTestUser } from './helpers/create-user';
import { jsonRequest } from './helpers/request';

describe('event routes', () => {
  it('rejects PUT /event with the wrong password', async () => {
    const app = createTestApp();
    const user = await createTestUser();

    const res = await jsonRequest(app, 'PUT', '/event', {
      userId: user.id,
      password: 'wrong',
      eventId: crypto.randomUUID(),
      encryptedEventPayload: bytesToBase64(new Uint8Array([1])),
      encryptedEventIV: bytesToBase64(new Uint8Array(16)),
      expiry: new Date(Date.now() + 60_000).toISOString(),
    });

    expect(res.status).toBe(401);
  });

  it("lets a follower fetch a followed user's events via a follow secret, and reports invalid secrets", async () => {
    const app = createTestApp();
    const owner = await createTestUser();
    const followSecret = 'test-follow-secret';

    const putSecretRes = await jsonRequest(app, 'PUT', '/follow-secret', {
      userId: owner.id,
      password: owner.password,
      followSecret,
    });
    expect(putSecretRes.status).toBe(200);

    const eventId = crypto.randomUUID();
    const payload = new Uint8Array([1, 2, 3, 4]);
    const iv = new Uint8Array(16).fill(7);
    const putEventRes = await jsonRequest(app, 'PUT', '/event', {
      userId: owner.id,
      password: owner.password,
      eventId,
      encryptedEventPayload: bytesToBase64(payload),
      encryptedEventIV: bytesToBase64(iv),
      expiry: new Date(Date.now() + 60_000).toISOString(),
    });
    expect(putEventRes.status).toBe(200);

    const getEventsRes = await jsonRequest(app, 'POST', '/events', {
      users: [
        { userId: owner.id, followSecret, since: new Date(Date.now() - 60_000).toISOString() },
        { userId: owner.id, followSecret: 'not-a-real-secret', since: new Date(0).toISOString() },
      ],
    });
    expect(getEventsRes.status).toBe(200);
    const body = (await getEventsRes.json()) as {
      events: { eventId: string; encryptedEventPayload: string; encryptedEventIV: string }[];
      invalidFollowSecrets: string[];
    };

    expect(body.invalidFollowSecrets).toEqual(['not-a-real-secret']);
    expect(body.events).toHaveLength(1);
    expect(body.events[0]?.eventId).toBe(eventId);
    expect(body.events[0]?.encryptedEventPayload).toBe(bytesToBase64(payload));
    expect(body.events[0]?.encryptedEventIV).toBe(bytesToBase64(iv));
  });

  it('does not return events older than the requested "since" cursor', async () => {
    const app = createTestApp();
    const owner = await createTestUser();
    const followSecret = 'another-secret';

    await jsonRequest(app, 'PUT', '/follow-secret', { userId: owner.id, password: owner.password, followSecret });

    const eventId = crypto.randomUUID();
    await jsonRequest(app, 'PUT', '/event', {
      userId: owner.id,
      password: owner.password,
      eventId,
      encryptedEventPayload: bytesToBase64(new Uint8Array([1])),
      encryptedEventIV: bytesToBase64(new Uint8Array(16)),
      expiry: new Date(Date.now() + 60_000).toISOString(),
    });

    // "since" in the future relative to the event's timestamp should exclude it.
    const res = await jsonRequest(app, 'POST', '/events', {
      users: [{ userId: owner.id, followSecret, since: new Date(Date.now() + 60_000).toISOString() }],
    });
    const body = (await res.json()) as { events: unknown[] };
    expect(body.events).toHaveLength(0);
  });

  it('revokes access after the follow secret is deleted', async () => {
    const app = createTestApp();
    const owner = await createTestUser();
    const followSecret = 'revocable-secret';

    await jsonRequest(app, 'PUT', '/follow-secret', { userId: owner.id, password: owner.password, followSecret });
    const deleteRes = await jsonRequest(app, 'POST', '/follow-secret/delete', {
      userId: owner.id,
      password: owner.password,
      followSecret,
    });
    expect(deleteRes.status).toBe(200);

    const res = await jsonRequest(app, 'POST', '/events', {
      users: [{ userId: owner.id, followSecret, since: new Date(0).toISOString() }],
    });
    const body = (await res.json()) as { invalidFollowSecrets: string[] };
    expect(body.invalidFollowSecrets).toEqual([followSecret]);
  });
});
