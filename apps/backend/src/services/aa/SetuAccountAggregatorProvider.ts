import { AAConsentRequest, AAConsentResponse, AccountAggregatorProvider, AATransaction } from './types';

const SETU_BASE_URL = 'https://fiu-sandbox.setu.co';

export class AASandboxUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'AASandboxUnavailableError';
  }
}

export interface SetuAccountAggregatorOptions {
  clientId?: string;
  clientSecret?: string;
  productInstanceId?: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  pollIntervalMs?: number;
  maxPollAttempts?: number;
}

export class SetuAccountAggregatorProvider implements AccountAggregatorProvider {
  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;
  private readonly pollIntervalMs: number;
  private readonly maxPollAttempts: number;
  private readonly headers: Record<string, string>;

  constructor(options: SetuAccountAggregatorOptions = {}) {
    const clientId = options.clientId ?? process.env.SETU_CLIENT_ID;
    const clientSecret = options.clientSecret ?? process.env.SETU_CLIENT_SECRET;
    const productInstanceId = options.productInstanceId ?? process.env.SETU_PRODUCT_INSTANCE_ID;
    if (!clientId || !clientSecret || !productInstanceId) {
      throw new AASandboxUnavailableError('Setu sandbox credentials are not configured.');
    }
    this.fetchFn = options.fetchFn ?? fetch;
    // Intentionally short for demo reliability; increase for production network conditions.
    this.timeoutMs = options.timeoutMs ?? 3_000;
    this.pollIntervalMs = options.pollIntervalMs ?? 500;
    this.maxPollAttempts = options.maxPollAttempts ?? 5;
    this.headers = {
      'content-type': 'application/json',
      'x-client-id': clientId,
      'x-client-secret': clientSecret,
      'x-product-instance-id': productInstanceId,
    };
  }

  async requestConsent(request: AAConsentRequest): Promise<AAConsentResponse> {
    const response = await this.request('/Consent', { method: 'POST', body: JSON.stringify(request) });
    return response as AAConsentResponse;
  }

  async fetchFinancialData(consentId: string): Promise<AATransaction[]> {
    for (let attempt = 0; attempt < this.maxPollAttempts; attempt += 1) {
      const response = await this.request('/FI/fetch', {
        method: 'POST',
        body: JSON.stringify({ consentId }),
      });
      const body = response as { status?: string; transactions?: unknown[]; fi?: unknown[] };
      const records = Array.isArray(response) ? response : body.transactions ?? body.fi;
      if (records) return records.map((record) => normalizeTransaction(record));
      if (body.status?.toUpperCase() !== 'PENDING' || attempt === this.maxPollAttempts - 1) {
        throw new AASandboxUnavailableError('Setu sandbox did not return financial data.');
      }
      await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
    }
    throw new AASandboxUnavailableError('Setu sandbox financial data polling timed out.');
  }

  async revokeConsent(consentId: string): Promise<void> {
    await this.request(`/Consent/${encodeURIComponent(consentId)}`, { method: 'DELETE' });
  }

  private async request(path: string, init: RequestInit): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchFn(`${SETU_BASE_URL}${path}`, { ...init, headers: this.headers, signal: controller.signal });
      if (!response.ok) {
        throw new AASandboxUnavailableError(`Setu sandbox returned HTTP ${response.status}.`);
      }
      return await response.json();
    } catch (error) {
      if (error instanceof AASandboxUnavailableError) throw error;
      throw new AASandboxUnavailableError('Setu sandbox request failed.', { cause: error });
    } finally {
      clearTimeout(timeout);
    }
  }
}

function normalizeTransaction(record: unknown): AATransaction {
  const raw = record as Record<string, unknown>;
  const type = String(raw.type ?? raw.transactionType ?? '').toUpperCase();
  const account = raw.account as Record<string, unknown> | undefined;
  return {
    accountId: String(raw.accountId ?? account?.id ?? ''),
    txnId: String(raw.txnId ?? raw.transactionId ?? raw.id ?? ''),
    type: type === 'DEBIT' ? 'DEBIT' : 'CREDIT',
    amount: Number(raw.amount ?? raw.transactionAmount ?? 0),
    currency: 'INR',
    narration: String(raw.narration ?? raw.description ?? ''),
    valueDate: String(raw.valueDate ?? raw.date ?? ''),
    balance: Number(raw.balance ?? raw.currentBalance ?? 0),
  };
}