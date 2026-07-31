import { describe, expect, it } from 'vitest';
import { db } from '../src/db/client';
import { users } from '../src/db/schema';

describe('bytea round-trip', () => {
  it('stores and reads back Uint8Array fields as Uint8Array (not Buffer-typed differences)', async () => {
    const now = new Date();
    const salt = new Uint8Array([1, 2, 3, 4, 5]);
    const encryptionIV = new Uint8Array(16).fill(9);
    const rsaPublicKey = new Uint8Array([10, 20, 30]);

    const [inserted] = await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        userLookup: 'test-lookup',
        hashedPassword: 'hash',
        lastAccessed: now,
        created: now,
        salt,
        encryptionIV,
        rsaPublicKey,
      })
      .returning();

    expect(inserted).toBeDefined();
    expect(inserted?.salt).toEqual(salt);
    expect(inserted?.encryptionIV).toEqual(encryptionIV);
    expect(inserted?.rsaPublicKey).toEqual(rsaPublicKey);
    expect(inserted?.encryptedCurrentPlan).toBeNull();
  });
});
