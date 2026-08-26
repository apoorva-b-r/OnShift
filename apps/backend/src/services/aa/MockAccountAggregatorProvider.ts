import { randomUUID } from 'node:crypto';
import { AAConsentRequest, AAConsentResponse, AccountAggregatorProvider, AATransaction } from './types';

export class MockAccountAggregatorProvider implements AccountAggregatorProvider {
  async requestConsent(_request: AAConsentRequest): Promise<AAConsentResponse> {
    await new Promise((resolve) => setTimeout(resolve, 800));
    const consentId = `mock-consent-${randomUUID()}`;
    return {
      consentId,
      consentHandle: `mock-handle-${randomUUID()}`,
      status: 'ACTIVE',
      redirectUrl: `https://aa-sandbox.onshift.org/mock/${consentId}`,
      isMock: true,
    };
  }

  async fetchFinancialData(_consentId: string): Promise<AATransaction[]> {
    return [
      transaction('2026-08-01', 'CREDIT', 30100, 'SALARY CREDIT', 30100),
      transaction('2026-08-02', 'DEBIT', 499, 'UPI-SWIGGY', 29601),
      transaction('2026-08-03', 'DEBIT', 2400, 'RENT PAYMENT', 27201),
      transaction('2026-08-04', 'CREDIT', 850, 'UPI-GIG INCENTIVE', 28051),
      transaction('2026-08-05', 'DEBIT', 500, 'ATM WDL', 27551),
      transaction('2026-08-06', 'DEBIT', 129, 'UPI-AIRTEL RECHARGE', 27422),
    ];
  }

  async revokeConsent(_consentId: string): Promise<void> {}
}

function transaction(valueDate: string, type: 'CREDIT' | 'DEBIT', amount: number, narration: string, balance: number): AATransaction {
  return { accountId: 'mock-account-001', txnId: `mock-txn-${valueDate}`, type, amount, currency: 'INR', narration, valueDate, balance };
}