import { bytesToBase64, GetEventsRequestSchema, type UserEventResponseWire } from '@liftlog/shared';
import { zValidator } from '@hono/zod-validator';
import { inArray, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../db/client';
import { userFollowSecrets } from '../db/schema';

interface RawUserEventRow extends Record<string, unknown> {
  userId: string;
  eventId: string;
  // db.execute() bypasses pg's Date type parsing for timestamptz and returns Postgres's text
  // representation instead (e.g. "2026-07-31 20:42:02.515867+00") — parse with `new Date(...)`.
  timestamp: string;
  expiry: string;
  encryptedEvent: Buffer;
  encryptionIV: Buffer;
}

export const eventsRoutes = new Hono().post('/events', zValidator('json', GetEventsRequestSchema), async (c) => {
  const request = c.req.valid('json');

  const requestedFollowSecrets = request.users.map((u) => u.followSecret);
  const validFollowSecrets =
    requestedFollowSecrets.length > 0
      ? await db.select().from(userFollowSecrets).where(inArray(userFollowSecrets.value, requestedFollowSecrets))
      : [];

  const invalidFollowSecrets = requestedFollowSecrets.filter(
    (secret) => !validFollowSecrets.some((valid) => valid.value === secret),
  );

  // The .NET version matches each valid follow secret's *owning* userId back to the request
  // entry by userId to find the "since" cursor (backend/LiftLog.Api/Controllers/EventsController.cs).
  // It uses `.Single()`, which throws (500s) if the request's userId doesn't actually own the
  // follow secret it sent. We skip mismatched pairs instead of crashing.
  const userIdsAndSince = validFollowSecrets
    .map((secret) => {
      const requestEntry = request.users.find((u) => u.userId === secret.userId);
      return requestEntry ? { userId: secret.userId, since: requestEntry.since } : null;
    })
    .filter((x) => x !== null);

  const events =
    userIdsAndSince.length > 0
      ? (
          await db.execute<RawUserEventRow>(sql`
              SELECT ue.user_id AS "userId", ue.id AS "eventId", ue.timestamp AS "timestamp",
                     ue.expiry AS "expiry", ue.encrypted_event AS "encryptedEvent", ue.encryption_iv AS "encryptionIV"
              FROM user_events ue
              JOIN unnest(
                ${sql.param(userIdsAndSince.map((x) => x.userId))}::uuid[],
                ${sql.param(userIdsAndSince.map((x) => x.since))}::timestamptz[]
              ) AS f(user_id, since) ON ue.user_id = f.user_id
              WHERE ue.expiry > now() AND ue.timestamp > f.since
            `)
        ).rows
      : [];

  if (events.length > 0) {
    await db.execute(sql`
        UPDATE user_events SET last_accessed = now()
        WHERE (user_id, id) IN (
          SELECT * FROM unnest(${sql.param(events.map((e) => e.userId))}::uuid[], ${sql.param(events.map((e) => e.eventId))}::uuid[])
        )
      `);
  }

  const userEvents: UserEventResponseWire[] = events.map((event) => ({
    userId: event.userId,
    eventId: event.eventId,
    timestamp: new Date(event.timestamp).toISOString(),
    encryptedEventPayload: bytesToBase64(event.encryptedEvent),
    encryptedEventIV: bytesToBase64(event.encryptionIV),
    expiry: new Date(event.expiry).toISOString(),
  }));

  return c.json({ events: userEvents, invalidFollowSecrets });
});
