import { DeleteUserFollowSecretRequestSchema, PutUserFollowSecretRequestSchema } from '@liftlog/shared';
import { zValidator } from '@hono/zod-validator';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { randomUUID } from 'node:crypto';
import { db } from '../db/client';
import { userFollowSecrets, users } from '../db/schema';
import { verifyPassword } from '../services/password-service';

export const followSecretRoutes = new Hono()
  .put('/follow-secret', zValidator('json', PutUserFollowSecretRequestSchema), async (c) => {
    const request = c.req.valid('json');
    const [user] = await db.select().from(users).where(eq(users.id, request.userId)).limit(1);

    if (!user) {
      return c.body(null, 404);
    }
    if (!verifyPassword(request.password, user.hashedPassword, user.salt)) {
      return c.body(null, 401);
    }

    await db.insert(userFollowSecrets).values({
      id: randomUUID(),
      userId: request.userId,
      value: request.followSecret,
    });

    return c.body(null, 200);
  })

  .post('/follow-secret/delete', zValidator('json', DeleteUserFollowSecretRequestSchema), async (c) => {
    const request = c.req.valid('json');
    const [user] = await db.select().from(users).where(eq(users.id, request.userId)).limit(1);

    if (!user) {
      return c.body(null, 404);
    }
    if (!verifyPassword(request.password, user.hashedPassword, user.salt)) {
      return c.body(null, 401);
    }

    await db
      .delete(userFollowSecrets)
      .where(and(eq(userFollowSecrets.userId, request.userId), eq(userFollowSecrets.value, request.followSecret)));

    return c.body(null, 200);
  });
