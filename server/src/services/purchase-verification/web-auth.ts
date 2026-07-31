import { config } from '../../config';

// Port of backend/LiftLog.Api/Service/WebAuthPurchaseVerificationService.cs.
export function isValidWebAuthToken(proToken: string): boolean {
  const webAuthApiKey = config.webAuthApiKey;
  if (!webAuthApiKey) {
    return false;
  }
  return proToken === webAuthApiKey;
}
