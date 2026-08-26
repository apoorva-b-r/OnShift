export interface AAService {
  createConsentRequest(
    workerId: string,
    fiTypes: string[],
    baseUrlOverride?: string
  ): Promise<{ consentId: string; status: string; consentUrl: string }>;
  getConsentStatus(consentId: string): Promise<{ consentId: string; status: string }>;
  createDataSession(
    consentId: string
  ): Promise<{ sessionId: string; consentId: string; status: string }>;
  getDataSession(sessionId: string): Promise<any>;
}
