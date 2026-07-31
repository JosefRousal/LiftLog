import {
  bytesToBase64,
  GetInboxMessagesRequestSchema,
  PutInboxMessageRequestSchema,
  type GetInboxMessagesResponseWire,
} from '@liftlog/shared';
import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { randomUUID } from 'node:crypto';
import { db } from '../db/client';
import { userInboxItems, users } from '../db/schema';
import { verifyPassword } from '../services/password-service';

export const inboxRoutes = new Hono()
  .put('/inbox', zValidator('json', PutInboxMessageRequestSchema), async (c) => {
    const request = c.req.valid('json');
    const [user] = await db.select().from(users).where(eq(users.id, request.toUserId)).limit(1);

    if (!user) {
      return c.body(null, 404);
    }

    await db.insert(userInboxItems).values({
      id: randomUUID(),
      userId: request.toUserId,
      encryptedMessage: request.encryptedMessage,
    });

    return c.body(null, 200);
  })

  .post('/inbox', zValidator('json', GetInboxMessagesRequestSchema), async (c) => {
    const request = c.req.valid('json');
    const [user] = await db.select().from(users).where(eq(users.id, request.userId)).limit(1);

    if (!user) {
      return c.body(null, 404);
    }
    if (!verifyPassword(request.password, user.hashedPassword, user.salt)) {
      return c.body(null, 401);
    }

    const inboxItems = await db.select().from(userInboxItems).where(eq(userInboxItems.userId, request.userId));

    if (inboxItems.length > 0) {
      await db.delete(userInboxItems).where(eq(userInboxItems.userId, request.userId));
    }

    const response: GetInboxMessagesResponseWire = {
      inboxMessages: inboxItems.map((item) => ({
        id: item.id,
        encryptedMessage: item.encryptedMessage.map((chunk) => bytesToBase64(chunk)),
      })),
    };

    return c.json(response);
  });
