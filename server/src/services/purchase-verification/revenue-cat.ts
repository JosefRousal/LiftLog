import { config } from '../../config';

interface RevenueCatCustomerResponse {
  active_entitlements?: {
    items?: { entitlement_id: string }[];
  };
}

// Port of backend/LiftLog.Api/Service/RevenueCatPurchaseVerificationService.cs. The .NET version
// uses a Kiota client generated from RevenueCat's entire OpenAPI spec (backend/RevenueCat/) to call
// exactly one endpoint — this is a small hand-written fetch wrapper for that same endpoint instead.
export async function getUserIdHasProEntitlement(userId: string): Promise<boolean> {
  const apiKey = config.revenueCatApiKey;
  const projectId = config.revenueCatProjectId;
  if (!apiKey || !projectId) {
    return false;
  }

  const response = await fetch(
    `https://api.revenuecat.com/v2/projects/${encodeURIComponent(projectId)}/customers/${encodeURIComponent(userId)}`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
  );

  if (!response.ok) {
    return false;
  }

  const body = (await response.json()) as RevenueCatCustomerResponse;
  const proEntitlementId = config.revenueCatProEntitlementId;
  return (body.active_entitlements?.items ?? []).some((entitlement) => entitlement.entitlement_id === proEntitlementId);
}
