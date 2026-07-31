import { createMiddleware } from 'hono/factory';
import { isValidPurchaseToken } from '../services/purchase-verification';
import type { AppStore } from '../services/app-store';

export interface PurchaseTokenVariables {
  proToken: string;
  appStore: AppStore;
}

function isAppStore(value: string): value is AppStore {
  return value === 'Web' || value === 'RevenueCat';
}

/**
 * Port of backend/LiftLog.Api/Authentication/PurchaseTokenAuthenticationHandler.cs: parses an
 * `Authorization: {AppStore} {token}` header (optionally `Bearer`-prefixed) and verifies it via
 * ../services/purchase-verification. Not mounted on any route yet — its only consumer is the AI
 * workout planner, which is deferred (see docs/TsBackend.md). Kept here as a ready extension point.
 */
export const purchaseTokenAuth = createMiddleware<{ Variables: PurchaseTokenVariables }>(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) {
    return c.body(null, 401);
  }

  let parts = authHeader.split(' ');
  if (parts[0] === 'Bearer') {
    parts = parts.slice(1);
  }
  if (parts.length !== 2) {
    return c.body(null, 401);
  }

  const [appStoreRaw, proToken] = parts;
  if (!appStoreRaw || !proToken || !isAppStore(appStoreRaw)) {
    return c.body(null, 401);
  }

  if (!(await isValidPurchaseToken(appStoreRaw, proToken))) {
    return c.body(null, 401);
  }

  c.set('proToken', proToken);
  c.set('appStore', appStoreRaw);
  await next();
});
