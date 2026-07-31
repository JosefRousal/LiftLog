import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { config } from '../config';
import { db } from '../db/client';
import { rateLimitConsumptions } from '../db/schema';
import type { AppStore } from './app-store';

// Port of backend/LiftLog.Api/Service/RateLimitService.cs. Not currently called from any route —
// the .NET version isn't either (it's registered in DI but has no call-sites; see docs/TsBackend.md
// and the AI-chat GitHub-issue-that-couldn't-be-filed for why: it's meant to gate the still-deferred
// AI planner endpoints, where the applicable AppStore is only known at the purchase-token layer).

const DAY_MS = 24 * 60 * 60 * 1000;
const LIMITS: Record<AppStore, number> = { Web: 100, RevenueCat: 20 };

export interface RateLimitResult {
  isRateLimited: boolean;
  retryAfter: Date;
}

export async function getRateLimit(appStore: AppStore, rateLimitKey: string): Promise<RateLimitResult> {
  if (config.testMode) {
    return { isRateLimited: false, retryAfter: new Date() };
  }

  // .NET's Convert.ToHexString produces uppercase hex; matched here for consistency, though case
  // doesn't affect correctness since this backend owns both the read and write side of this table.
  const hashedKey = createHash('sha256').update(rateLimitKey, 'utf8').digest('hex').toUpperCase();

  const [existing] = await db
    .select()
    .from(rateLimitConsumptions)
    .where(eq(rateLimitConsumptions.key, hashedKey))
    .limit(1);

  const oneDayAgo = new Date(Date.now() - DAY_MS);
  const requestsInLastDay = (existing?.requests ?? []).filter((r) => r > oneDayAgo);

  const limit = LIMITS[appStore];
  const isRateLimited = requestsInLastDay.length >= limit;

  if (!isRateLimited) {
    requestsInLastDay.push(new Date());
    await db
      .insert(rateLimitConsumptions)
      .values({ key: hashedKey, requests: requestsInLastDay })
      .onConflictDoUpdate({ target: rateLimitConsumptions.key, set: { requests: requestsInLastDay } });
  }

  const retryAfter = new Date(Math.min(...requestsInLastDay.map((r) => r.getTime())) + DAY_MS);

  return { isRateLimited, retryAfter };
}
