export type AAFinancialInformationType = 'DEPOSIT' | 'TRANSACTIONS' | 'TERM_DEPOSIT';
export type AAConsentStatus = 'PENDING' | 'ACTIVE' | 'REJECTED';
export type AATransactionType = 'CREDIT' | 'DEBIT';

export interface AAConsentRequest {
  customerId: string;
  purpose: string;
  fiTypes: AAFinancialInformationType[];
  dataRange: { from: string; to: string };
}

export interface AAConsentResponse {
  consentId: string;
  consentHandle: string;
  status: AAConsentStatus;
  redirectUrl?: string;
  isMock?: boolean;
}

export interface AATransaction {
  accountId: string;
  txnId: string;
  type: AATransactionType;
  amount: number;
  currency: 'INR';
  narration: string;
  valueDate: string;
  balance: number;
}

export interface AccountAggregatorProvider {
  requestConsent(request: AAConsentRequest): Promise<AAConsentResponse>;
  fetchFinancialData(consentId: string): Promise<AATransaction[]>;
  revokeConsent(consentId: string): Promise<void>;
}