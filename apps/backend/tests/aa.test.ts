import { MockAccountAggregatorProvider } from '../src/services/aa/MockAccountAggregatorProvider';
import { AASandboxUnavailableError, SetuAccountAggregatorProvider } from '../src/services/aa/SetuAccountAggregatorProvider';
import {
  getAccountAggregatorProvider,
  resetAccountAggregatorProviderForTests,
} from '../src/services/aa/getAccountAggregatorProvider';
import { AATransaction } from '../src/services/aa/types';

const consentRequest = {
  customerId: 'OS-AA-TEST',
  purpose: 'Income verification',
  fiTypes: ['DEPOSIT', 'TRANSACTIONS'] as const,
  dataRange: { from: '2026-08-01', to: '2026-08-31' },
};

describe('MockAccountAggregatorProvider', () => {
  const provider = new MockAccountAggregatorProvider();

  it('returns schema-valid deterministic transactions', async () => {
    const transactions = await provider.fetchFinancialData('mock-consent-test');
    expect(transactions).toHaveLength(6);
    expect(transactions).toEqual(expect.arrayContaining([
      expect.objectContaining({ narration: 'SALARY CREDIT', type: 'CREDIT', currency: 'INR' }),
      expect.objectContaining({ narration: 'UPI-SWIGGY', type: 'DEBIT', currency: 'INR' }),
      expect.objectContaining({ narration: 'ATM WDL', type: 'DEBIT', currency: 'INR' }),
    ]));
    for (const transaction of transactions as AATransaction[]) {
      expect(transaction.accountId).toEqual(expect.any(String));
      expect(transaction.txnId).toEqual(expect.any(String));
      expect(['CREDIT', 'DEBIT']).toContain(transaction.type);
      expect(transaction.amount).toEqual(expect.any(Number));
      expect(transaction.currency).toBe('INR');
      expect(transaction.narration).toEqual(expect.any(String));
      expect(transaction.valueDate).toEqual(expect.any(String));
      expect(transaction.balance).toEqual(expect.any(Number));
    }
  });

  it('resolves consent, data fetch, and revoke without throwing', async () => {
    const consent = await provider.requestConsent(consentRequest);
    expect(consent.consentId).toMatch(/^mock-consent-[0-9a-f-]+$/);
    expect(consent.status).toBe('ACTIVE');
    expect(consent.isMock).toBe(true);
    await expect(provider.fetchFinancialData(consent.consentId)).resolves.toHaveLength(6);
    await expect(provider.revokeConsent(consent.consentId)).resolves.toBeUndefined();
  }, 2_000);
});

describe('getAccountAggregatorProvider', () => {
  beforeEach(() => resetAccountAggregatorProviderForTests());

  it('falls back to MockAccountAggregatorProvider for an unavailable sandbox', async () => {
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const provider = await getAccountAggregatorProvider(() => {
      throw new AASandboxUnavailableError('sandbox unavailable');
    });

    expect(provider).toBeInstanceOf(MockAccountAggregatorProvider);
    expect(warning).toHaveBeenCalledWith('[AA] Sandbox unreachable, falling back to mock provider');
    warning.mockRestore();
  });

  it('makes the provider decision once per session', async () => {
    const createSetu = jest.fn(() => new MockAccountAggregatorProvider());
    const first = await getAccountAggregatorProvider(createSetu);
    const second = await getAccountAggregatorProvider(() => {
      throw new Error('factory should not be called again');
    });

    expect(first).toBe(second);
    expect(createSetu).toHaveBeenCalledTimes(1);
  });
});

describe('SetuAccountAggregatorProvider', () => {
  it('converts transport failures into AASandboxUnavailableError', async () => {
    const provider = new SetuAccountAggregatorProvider({
      clientId: 'client',
      clientSecret: 'secret',
      productInstanceId: 'product',
      fetchFn: jest.fn().mockRejectedValue(new Error('network down')),
    });

    await expect(provider.requestConsent(consentRequest)).rejects.toBeInstanceOf(AASandboxUnavailableError);
  });
});
