import { bytesToBase64, CreateSharedItemRequestSchema, type GetSharedItemResponseWire } from '@liftlog/shared';
import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../db/client';
import { sharedItems, users } from '../db/schema';
import { createShortId } from '../services/id';
import { verifyPassword } from '../services/password-service';

export const sharedItemRoutes = new Hono()
  .post('/shareditem', zValidator('json', CreateSharedItemRequestSchema), async (c) => {
    const request = c.req.valid('json');
    const [user] = await db.select().from(users).where(eq(users.id, request.userId)).limit(1);

    if (!user) {
      return c.body(null, 401);
    }
    if (!verifyPassword(request.password, user.hashedPassword, user.salt)) {
      return c.body(null, 401);
    }

    const [sharedItem] = await db
      .insert(sharedItems)
      .values({
        id: createShortId(),
        userId: request.userId,
        encryptedPayload: request.encryptedPayload.encryptedPayload,
        encryptionIV: request.encryptedPayload.iv.value,
        timestamp: new Date(),
        expiry: new Date(request.expiry),
      })
      .returning();

    if (!sharedItem) {
      throw new Error('Failed to create shared item');
    }

    return c.json({ id: sharedItem.id });
  })

  .get('/shareditem/:id', async (c) => {
    const id = c.req.param('id');
    const [row] = await db
      .select({
        encryptedPayload: sharedItems.encryptedPayload,
        encryptionIV: sharedItems.encryptionIV,
        rsaPublicKey: users.rsaPublicKey,
      })
      .from(sharedItems)
      .innerJoin(users, eq(sharedItems.userId, users.id))
      .where(eq(sharedItems.id, id))
      .limit(1);

    if (!row) {
      return c.body(null, 404);
    }

    const response: GetSharedItemResponseWire = {
      rsaPublicKey: { spkiPublicKeyBytes: bytesToBase64(row.rsaPublicKey) },
      encryptedPayload: {
        encryptedPayload: bytesToBase64(row.encryptedPayload),
        iv: { value: bytesToBase64(row.encryptionIV) },
      },
    };

    return c.json(response);
  });
