import { config } from '../config';
import { ApiError } from '../middleware/apiError';

export interface SetuDigiLockerCreateRequestResponse {
  id: string;
  status: string;
  url: string;
  validUpto: string;
}

export interface SetuDigiLockerStatusResponse {
  id: string;
  status: string;
  url: string;
  validUpto: string;
  digilockerUserDetails?: {
    digilockerId?: string;
    email?: string;
    phoneNumber?: string;
  };
}

export interface SetuDigiLockerAadhaarResponse {
  id: string;
  status: string;
  aadhaar?: {
    maskedNumber?: string;
    name?: string;
    dateOfBirth?: string;
    gender?: string;
    verified?: {
      signature?: boolean;
    };
    xml?: {
      fileUrl?: string;
    };
  };
}

export interface SetuDigiLockerRevokeResponse {
  id: string;
  status: string;
}

export interface SetuDigiLockerDocumentsResponse {
  documents: Array<{
    name?: string;
    type?: string;
    uri?: string;
  }>;
}

export class SetuDigiLockerService {
  /**
   * Validate that Setu DigiLocker API credentials are present.
   * Throws ApiError 500 SETU_DIGILOCKER_NOT_CONFIGURED if missing and mock mode is off.
   */
  private static validateConfig(): void {
    if (config.setuDigiLockerMockMode) {
      return;
    }

    const missing: string[] = [];
    if (!config.setuDigiLockerClientId) missing.push('SETU_DIGILOCKER_CLIENT_ID');
    if (!config.setuDigiLockerClientSecret) missing.push('SETU_DIGILOCKER_CLIENT_SECRET');
    if (!config.setuDigiLockerProductInstanceId) missing.push('SETU_DIGILOCKER_PRODUCT_INSTANCE_ID');

    if (missing.length > 0) {
      throw new ApiError(
        500,
        'SETU_DIGILOCKER_NOT_CONFIGURED',
        `Setu DigiLocker credentials not configured: missing ${missing.join(', ')}.`
      );
    }
  }

  /**
   * Get required Setu API request headers.
   */
  private static getHeaders(): Record<string, string> {
    return {
      'x-client-id': config.setuDigiLockerClientId,
      'x-client-secret': config.setuDigiLockerClientSecret,
      'x-product-instance-id': config.setuDigiLockerProductInstanceId,
      'Content-Type': 'application/json',
      'User-Agent': 'OnShift-Backend/1.0.0',
    };
  }

  /**
   * Helper method to perform HTTP fetch request with error handling and secret sanitization.
   */
  private static async request<T>(
    endpoint: string,
    options: { method: string; body?: unknown }
  ): Promise<T> {
    this.validateConfig();

    if (config.setuDigiLockerMockMode) {
      return this.getMockResponse<T>(endpoint, options.method);
    }

    const url = `${config.setuDigiLockerBaseUrl.replace(/\/$/, '')}${endpoint}`;

    try {
      const response = await fetch(url, {
        method: options.method,
        headers: this.getHeaders(),
        ...(options.body ? { body: JSON.stringify(options.body) } : {}),
      });

      if (!response.ok) {
        let errMessage = `Upstream Setu DigiLocker API returned status ${response.status}.`;
        try {
          const errJson = await response.json();
          if (errJson && typeof errJson === 'object' && 'message' in errJson && typeof errJson.message === 'string') {
            errMessage = errJson.message;
          }
        } catch (_) {
          // Ignore JSON parse errors from error body
        }

        const statusCode = response.status >= 400 && response.status < 600 ? response.status : 502;
        throw new ApiError(statusCode, 'SETU_DIGILOCKER_API_ERROR', errMessage);
      }

      const data = (await response.json()) as T;
      return data;
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        throw err;
      }
      const message = err instanceof Error ? err.message : 'Network error communicating with Setu DigiLocker API.';
      throw new ApiError(502, 'SETU_DIGILOCKER_NETWORK_ERROR', `Setu DigiLocker request failed: ${message}`);
    }
  }

  /**
   * Mock responses when SETU_DIGILOCKER_MOCK_MODE=true is explicitly enabled.
   */
  private static getMockResponse<T>(endpoint: string, method: string): T {
    if (endpoint === '/api/digilocker' && method === 'POST') {
      const reqId = 'mock_req_' + Date.now();
      return {
        id: reqId,
        status: 'unauthenticated',
        url: `http://127.0.0.1:4000/api/v1/identity/digilocker/mock-auth?id=${reqId}`,
        validUpto: new Date(Date.now() + 3600000).toISOString(),
      } as unknown as T;
    }

    if (endpoint.endsWith('/status')) {
      const reqId = endpoint.split('/')[3] || 'mock_req_12345';
      return {
        id: reqId,
        status: 'authenticated',
        url: `https://dg-sandbox.setu.co/mock/auth/${reqId}`,
        validUpto: new Date(Date.now() + 3600000).toISOString(),
        digilockerUserDetails: {
          digilockerId: 'mock_dl_id_789',
          email: 'worker@example.com',
          phoneNumber: '9999999999',
        },
      } as unknown as T;
    }

    if (endpoint.endsWith('/aadhaar')) {
      const reqId = endpoint.split('/')[3] || 'mock_req_12345';
      return {
        id: reqId,
        status: 'complete',
        aadhaar: {
          maskedNumber: 'XXXX-XXXX-1234',
          name: 'Mock Worker',
          dateOfBirth: '1995-05-15',
          gender: 'M',
          verified: { signature: true },
          xml: { fileUrl: 'https://dg-sandbox.setu.co/mock/xml' },
        },
      } as unknown as T;
    }

    if (endpoint.endsWith('/revoke')) {
      const reqId = endpoint.split('/')[3] || 'mock_req_12345';
      return {
        id: reqId,
        status: 'revoked',
      } as unknown as T;
    }

    if (endpoint === '/api/digilocker/documents') {
      return {
        documents: [],
      } as unknown as T;
    }

    throw new ApiError(404, 'NOT_FOUND', `Mock handler for ${method} ${endpoint} not found.`);
  }

  /**
   * POST /api/digilocker
   * Create a new DigiLocker request session.
   */
  public static async createRequest(redirectUrl?: string): Promise<SetuDigiLockerCreateRequestResponse> {
    const payload = {
      redirectUrl: redirectUrl || config.setuDigiLockerRedirectUrl || 'http://localhost:4000/api/v1/identity/digilocker/callback',
    };
    return this.request<SetuDigiLockerCreateRequestResponse>('/api/digilocker', {
      method: 'POST',
      body: payload,
    });
  }

  /**
   * GET /api/digilocker/{requestId}/status
   * Fetch status of a DigiLocker request session.
   */
  public static async getStatus(requestId: string): Promise<SetuDigiLockerStatusResponse> {
    if (!requestId || typeof requestId !== 'string' || !requestId.trim()) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'requestId is required.');
    }
    return this.request<SetuDigiLockerStatusResponse>(`/api/digilocker/${encodeURIComponent(requestId.trim())}/status`, {
      method: 'GET',
    });
  }

  /**
   * GET /api/digilocker/{requestId}/aadhaar
   * Fetch verified Aadhaar data for a completed DigiLocker request.
   *
   * SECURITY RULE: Raw Aadhaar data must NOT be logged or persisted in this service.
   */
  public static async getAadhaar(requestId: string): Promise<SetuDigiLockerAadhaarResponse> {
    if (!requestId || typeof requestId !== 'string' || !requestId.trim()) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'requestId is required.');
    }
    return this.request<SetuDigiLockerAadhaarResponse>(`/api/digilocker/${encodeURIComponent(requestId.trim())}/aadhaar`, {
      method: 'GET',
    });
  }

  /**
   * GET /api/digilocker/{requestId}/revoke
   * Revoke a DigiLocker request session.
   */
  public static async revoke(requestId: string): Promise<SetuDigiLockerRevokeResponse> {
    if (!requestId || typeof requestId !== 'string' || !requestId.trim()) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'requestId is required.');
    }
    return this.request<SetuDigiLockerRevokeResponse>(`/api/digilocker/${encodeURIComponent(requestId.trim())}/revoke`, {
      method: 'GET',
    });
  }

  /**
   * GET /api/digilocker/documents
   * Retrieve list of accessible DigiLocker documents.
   */
  public static async getDocuments(): Promise<SetuDigiLockerDocumentsResponse> {
    return this.request<SetuDigiLockerDocumentsResponse>('/api/digilocker/documents', {
      method: 'GET',
    });
  }
}
