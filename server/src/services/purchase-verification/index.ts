import type { AppStore } from '../app-store';
import { getUserIdHasProEntitlement } from './revenue-cat';
import { isValidWebAuthToken } from './web-auth';

// Port of backend/LiftLog.Api/Service/PurchaseVerificationService.cs.
export async function isValidPurchaseToken(appStore: AppStore, proToken: string): Promise<boolean> {
  try {
    switch (appStore) {
      case 'Web':
        return isValidWebAuthToken(proToken);
      case 'RevenueCat':
        return await getUserIdHasProEntitlement(proToken);
    }
  } catch (error) {
    console.error('Failed to verify purchase', error);
    return false;
  }
}
