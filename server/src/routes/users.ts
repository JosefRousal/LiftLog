import { GetUsersRequestSchema } from '@liftlog/shared';
import { zValidator } from '@hono/zod-validator';
import { inArray } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../db/client';
import { users } from '../db/schema';
import { toGetUserResponseWire } from './user';

export const usersRoutes = new Hono().post('/users', zValidator('json', GetUsersRequestSchema), async (c) => {
  const request = c.req.valid('json');
  const foundUsers = await db.select().from(users).where(inArray(users.id, request.ids));

  if (foundUsers.length > 0) {
    await db
      .update(users)
      .set({ lastAccessed: new Date() })
      .where(
        inArray(
          users.id,
          foundUsers.map((u) => u.id),
        ),
      );
  }

  return c.json({
    users: Object.fromEntries(foundUsers.map((u) => [u.id, toGetUserResponseWire(u)])),
  });
});
