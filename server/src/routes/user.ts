import {
  bytesToBase64,
  CreateUserRequestSchema,
  DeleteUserRequestSchema,
  PutUserDataRequestSchema,
  type GetUserResponseWire,
} from '@liftlog/shared';
import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { randomUUID } from 'node:crypto';
import { db } from '../db/client';
import { users } from '../db/schema';
import { hashPassword, verifyPassword } from '../services/password-service';
import { createShortId } from '../services/id';
import { isUuid } from '../utils/is-uuid';

type UserRow = typeof users.$inferSelect;

function toGetUserResponseWire(user: UserRow): GetUserResponseWire {
  return {
    id: user.id,
    lookup: user.userLookup,
    encryptedCurrentPlan: user.encryptedCurrentPlan ? bytesToBase64(user.encryptedCurrentPlan) : undefined,
    encryptedName: user.encryptedName ? bytesToBase64(user.encryptedName) : undefined,
    encryptionIV: bytesToBase64(user.encryptionIV),
    rsaPublicKey: bytesToBase64(user.rsaPublicKey),
  };
}

export const userRoutes = new Hono()
  .post('/user/create', zValidator('json', CreateUserRequestSchema), async (c) => {
    const password = randomUUID();
    const { hash, salt } = hashPassword(password);
    const id = randomUUID();
    const now = new Date();

    const [user] = await db
      .insert(users)
      .values({
        id,
        userLookup: createShortId(),
        hashedPassword: hash,
        salt,
        lastAccessed: now,
        created: now,
        encryptionIV: new Uint8Array(),
        rsaPublicKey: new Uint8Array(),
      })
      .returning();

    if (!user) {
      throw new Error('Failed to create user');
    }

    return c.json({ id: user.id, lookup: user.userLookup, password });
  })

  .get('/user/:idOrLookup', async (c) => {
    const idOrLookup = c.req.param('idOrLookup');
    const [user] = await db
      .select()
      .from(users)
      .where(isUuid(idOrLookup) ? eq(users.id, idOrLookup) : eq(users.userLookup, idOrLookup))
      .limit(1);

    if (!user) {
      return c.body(null, 404);
    }

    await db.update(users).set({ lastAccessed: new Date() }).where(eq(users.id, user.id));

    return c.json(toGetUserResponseWire(user));
  })

  .post('/user/delete', zValidator('json', DeleteUserRequestSchema), async (c) => {
    const request = c.req.valid('json');
    const [user] = await db.select().from(users).where(eq(users.id, request.id)).limit(1);

    if (!user) {
      return c.body(null, 404);
    }
    if (!verifyPassword(request.password, user.hashedPassword, user.salt)) {
      return c.body(null, 401);
    }

    await db.delete(users).where(eq(users.id, user.id));
    return c.body(null, 200);
  })

  .put('/user', zValidator('json', PutUserDataRequestSchema), async (c) => {
    const request = c.req.valid('json');
    const [user] = await db.select().from(users).where(eq(users.id, request.id)).limit(1);

    if (!user) {
      return c.body(null, 404);
    }
    if (!verifyPassword(request.password, user.hashedPassword, user.salt)) {
      return c.body(null, 401);
    }

    await db
      .update(users)
      .set({
        encryptedCurrentPlan: request.encryptedCurrentPlan ?? null,
        encryptedName: request.encryptedName ?? null,
        encryptionIV: request.encryptionIV,
        rsaPublicKey: request.rsaPublicKey,
      })
      .where(eq(users.id, user.id));

    return c.body(null, 200);
  });

export { toGetUserResponseWire };
