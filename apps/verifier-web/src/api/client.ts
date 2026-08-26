/// <reference types="vite/client" />

/**
 * Centralized API Client for OnShift Monorepo Web Application
 * Interacts directly with Express API Gateway (default: http://localhost:4000/api/v1)
 */

const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1').replace(/\/$/, '');

export interface ApiErrorResponse {
  error: string;
  message: string;
  details?: any;
  status: number;
}

export class OnShiftApiError extends Error {
  status: number;
  code: string;
  details?: any;

  constructor(status: number, code: string, message: string, details?: any) {
    super(message);
    this.name = 'OnShiftApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const TOKEN_KEY = 'onshift_worker_token';
const WORKER_ID_KEY = 'onshift_worker_id';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredWorkerId(): string | null {
  return localStorage.getItem(WORKER_ID_KEY) || 'OS-DEMO-001';
}

export function setStoredAuth(workerId: string, token: string) {
  localStorage.setItem(WORKER_ID_KEY, workerId);
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(WORKER_ID_KEY);
}

// Generate simple HMAC JWT token or bearer string for dev worker session
function generateDevToken(workerId: string): string {
  // Use worker ID directly as bearer token (supported by backend authMiddleware in dev/test mode)
  return workerId;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken() || generateDevToken(getStoredWorkerId() || 'OS-DEMO-001');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['x-worker-id'] = getStoredWorkerId() || 'OS-DEMO-001';
  }

  const config: RequestInit = {
    ...options,
    headers,
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, config);

  if (!response.ok) {
    let errorData: any = {};
    try {
      errorData = await response.json();
    } catch (_) {
      errorData = { message: response.statusText || 'Network response was not ok' };
    }

    if (response.status === 401) {
      // Clear token on 401
      clearStoredAuth();
    }

    throw new OnShiftApiError(
      response.status,
      errorData.error || 'API_ERROR',
      errorData.message || `Request failed with status ${response.status}`,
      errorData.details
    );
  }

  return response.json() as Promise<T>;
}

export const api = {
  // Worker Auth & Identity
  async login(workerId: string) {
    try {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workerId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.token) {
          setStoredAuth(workerId, data.token);
          return { workerId, token: data.token };
        }
      }
    } catch (_) {}
    const token = generateDevToken(workerId);
    setStoredAuth(workerId, token);
    return { workerId, token };
  },

  setWorkerSession(workerId: string) {
    const token = generateDevToken(workerId);
    setStoredAuth(workerId, token);
    return { workerId, token };
  },

  async getWorker(workerId: string) {
    return request<any>(`/workers/${encodeURIComponent(workerId)}`);
  },

  // Account Aggregator Consent
  async requestConsent(fiTypes: string[] = ['DEPOSIT']) {
    return request<{
      consentId: string;
      workerId: string;
      fiTypes: string[];
      status: string;
      consentUrl: string;
      authorizationUrl?: string;
      isMock: boolean;
    }>('/consent/request', {
      method: 'POST',
      body: JSON.stringify({ fiTypes }),
    });
  },

  async getConsentStatus(consentId: string) {
    return request<{
      consentId: string;
      workerId: string;
      status: string;
      consentUrl?: string;
      isMock: boolean;
    }>(`/consent/status/${encodeURIComponent(consentId)}`);
  },

  async createWorker(workerData: { id: string; name: string; email?: string; phone?: string; platformRole?: string }) {
    return request<any>('/workers', {
      method: 'POST',
      body: JSON.stringify(workerData),
    });
  },

  // Evidence Management
  async getEvidenceByWorker(workerId: string) {
    return request<any[]>(`/evidence/worker/${encodeURIComponent(workerId)}`);
  },

  async createEvidence(evidenceData: {
    workerId: string;
    source: string;
    type: string;
    platform: string;
    amount: number;
    currency?: string;
    reference?: string;
    timestamp?: string;
    previousHash?: string;
    integrityHash: string;
    role?: string;
    category?: string;
  }) {
    return request<any>('/evidence', {
      method: 'POST',
      body: JSON.stringify(evidenceData),
    });
  },

  // Verification Pipeline (Authoritative Server Call)
  async runVerification(payload: {
    workerId: string;
    payoutPeriod?: { startDate: string; endDate: string };
    evidenceIds?: string[];
  }) {
    return request<{
      id: string;
      workerId: string;
      payoutPeriod: { startDate: string; endDate: string };
      level: 'DECLARED' | 'OBSERVED' | 'CORROBORATED' | 'FINANCIALLY_CORROBORATED';
      confidence: number;
      reason: string;
      supportingEvidence: string[];
      limitations: string;
      reconciliationStatus?: 'MATCHED' | 'EXPLAINED_DIFFERENCE' | 'UNEXPLAINED_DIFFERENCE' | 'INSUFFICIENT_EVIDENCE';
      expectedGross?: number;
      authorizedDeductions?: number;
      expectedNet?: number;
      actualSettlement?: number;
      verificationEngineVersion?: string;
      computedAt: string;
    }>('/verification/run', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Reconciliation Standalone Call
  async runReconciliation(payload: {
    workerId: string;
    payoutPeriod?: { startDate: string; endDate: string };
    evidenceIds?: string[];
  }) {
    return request<any>('/reconciliation/run', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Credential Issuance & Verification
  async issueCredential(verificationId: string, workerId?: string) {
    return request<{ credential: any }>('/credentials/issue', {
      method: 'POST',
      body: JSON.stringify({
        verificationId,
        ...(workerId ? { workerId } : {}),
      }),
    });
  },

  async verifyCredential(credentialObj: any) {
    return request<{
      valid: boolean;
      signatureVerified: boolean;
      issuerVerified?: boolean;
      message: string;
      claims?: any;
      issuer?: string;
      workerId?: string;
    }>('/credentials/verify', {
      method: 'POST',
      body: JSON.stringify(credentialObj),
    });
  },

  // Government Scheme Eligibility & Recommendations
  async getSchemes() {
    return request<any[]>('/schemes');
  },

  async matchSchemes(profile: { monthlyIncome?: number; workerCategory?: string; location?: string }) {
    return request<any[]>('/schemes/match', {
      method: 'POST',
      body: JSON.stringify(profile),
    });
  },

  async recommendSchemes(profile: {
    monthlyIncome?: number;
    workerCategory?: string;
    location?: string;
    verificationLevel?: string;
  }) {
    return request<{
      workerProfile: any;
      recommendations: any[];
      engineSource: 'NEMOTRON_ULTRA_3' | 'DETERMINISTIC_FALLBACK';
      timestamp: string;
    }>('/schemes/recommend', {
      method: 'POST',
      body: JSON.stringify(profile),
    });
  },
};
