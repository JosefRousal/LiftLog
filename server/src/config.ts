function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is not set`);
  }
  return value;
}

export const config = {
  get port() {
    return Number(process.env.PORT ?? 5264);
  },
  get databaseUrl() {
    return requireEnv('DATABASE_URL');
  },
  get webAuthApiKey() {
    return process.env.WEB_AUTH_API_KEY;
  },
  get revenueCatApiKey() {
    return process.env.REVENUECAT_API_KEY;
  },
  get revenueCatProjectId() {
    return process.env.REVENUECAT_PROJECT_ID;
  },
  get revenueCatProEntitlementId() {
    return process.env.REVENUECAT_PRO_ENTITLEMENT_ID ?? 'pro';
  },
  get testMode() {
    return process.env.TEST_MODE === 'True';
  },
};
