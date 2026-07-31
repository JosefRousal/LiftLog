import { describe, expect, it } from 'vitest';
import { db } from '../src/db/client';
import { userEvents } from '../src/db/schema';
import { purgeExpiredEvents } from '../src/jobs/cleanup-expired-events';
import { createTestUser } from './helpers/create-user';

describe('purgeExpiredEvents', () => {
  it('deletes only events past their expiry', async () => {
    const owner = await createTestUser();
    const now = new Date();

    await db.insert(userEvents).values([
      {
        userId: owner.id,
        id: crypto.randomUUID(),
        timestamp: now,
        lastAccessed: now,
        expiry: new Date(now.getTime() - 1000),
        encryptedEvent: new Uint8Array([1]),
        encryptionIV: new Uint8Array(16),
      },
      {
        userId: owner.id,
        id: crypto.randomUUID(),
        timestamp: now,
        lastAccessed: now,
        expiry: new Date(now.getTime() + 60_000),
        encryptedEvent: new Uint8Array([2]),
        encryptionIV: new Uint8Array(16),
      },
    ]);

    await purgeExpiredEvents();

    const remaining = await db.select().from(userEvents);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.expiry.getTime()).toBeGreaterThan(now.getTime());
  });
});
