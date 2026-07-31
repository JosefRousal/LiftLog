import { lt } from 'drizzle-orm';
import { db } from '../db/client';
import { userEvents } from '../db/schema';

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

export async function purgeExpiredEvents(): Promise<void> {
  await db.delete(userEvents).where(lt(userEvents.expiry, new Date()));
}

/**
 * Port of backend/LiftLog.Api/Service/CleanupExpiredDataHostedService.cs: purges expired
 * `user_events` rows hourly, running in this same long-running Node process (see docs/TsBackend.md
 * for why this backend is deployed as a long-running process rather than serverless).
 */
export function startCleanupJob(): { stop: () => void } {
  const interval = setInterval(() => {
    purgeExpiredEvents().catch((error: unknown) => {
      console.error('Failed to purge expired events', error);
    });
  }, CLEANUP_INTERVAL_MS);
  interval.unref();

  purgeExpiredEvents().catch((error: unknown) => {
    console.error('Failed to purge expired events', error);
  });

  return { stop: () => clearInterval(interval) };
}
