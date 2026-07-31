import { PutUserEventRequestSchema } from '@liftlog/shared';
import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../db/client';
import { userEvents, users } from '../db/schema';
import { verifyPassword } from '../services/password-service';

export const eventRoutes = new Hono().put('/event', zValidator('json', PutUserEventRequestSchema), async (c) => {
  const request = c.req.valid('json');
  const [user] = await db.select().from(users).where(eq(users.id, request.userId)).limit(1);

  if (!user) {
    return c.body(null, 404);
  }
  if (!verifyPassword(request.password, user.hashedPassword, user.salt)) {
    return c.body(null, 401);
  }

  const now = new Date();
  await db
    .insert(userEvents)
    .values({
      userId: request.userId,
      id: request.eventId,
      timestamp: now,
      lastAccessed: now,
      expiry: new Date(request.expiry),
      encryptedEvent: request.encryptedEventPayload,
      encryptionIV: request.encryptedEventIV,
    })
    .onConflictDoUpdate({
      target: [userEvents.userId, userEvents.id],
      set: {
        timestamp: now,
        lastAccessed: now,
        expiry: new Date(request.expiry),
        encryptedEvent: request.encryptedEventPayload,
        encryptionIV: request.encryptedEventIV,
      },
    });

  await db.update(users).set({ lastAccessed: now }).where(eq(users.id, request.userId));

  return c.body(null, 200);
});
