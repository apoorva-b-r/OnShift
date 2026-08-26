import { config } from '../src/config';
import { ApiError } from '../src/middleware/apiError';
import { SetuDigiLockerService } from '../src/services/setuDigiLockerService';

describe('SetuDigiLockerService Adapter Unit Tests', () => {
  const originalFetch = global.fetch;
  const originalConfig = { ...config };

  beforeEach(() => {
    // Reset configuration options to known test values
    config.setuDigiLockerBaseUrl = 'https://dg-sandbox.setu.co';
    config.setuDigiLockerClientId = 'test-client-id-123';
    config.setuDigiLockerClientSecret = 'test-client-secret-456';
    config.setuDigiLockerProductInstanceId = 'test-product-instance-789';
    config.setuDigiLockerRedirectUrl = 'http://localhost:4000/api/v1/identity/digilocker/callback';
    config.setuDigiLockerMockMode = false;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    // Restore setu-specific fields only (avoids issues with getter-only properties)
    config.setuDigiLockerBaseUrl = originalConfig.setuDigiLockerBaseUrl;
    config.setuDigiLockerClientId = originalConfig.setuDigiLockerClientId;
    config.setuDigiLockerClientSecret = originalConfig.setuDigiLockerClientSecret;
    config.setuDigiLockerProductInstanceId = originalConfig.setuDigiLockerProductInstanceId;
    config.setuDigiLockerRedirectUrl = originalConfig.setuDigiLockerRedirectUrl;
    config.setuDigiLockerMockMode = originalConfig.setuDigiLockerMockMode;
    jest.restoreAllMocks();
  });


  // =========================================================================
  // A. createRequest
  // =========================================================================
  describe('A. createRequest', () => {
    it('sends POST to /api/digilocker with correct headers, body, and parses response', async () => {
      const mockResponseBody = {
        id: 'req_setu_999',
        status: 'unauthenticated',
        url: 'https://dg-sandbox.setu.co/auth/req_setu_999',
        validUpto: '2026-12-31T23:59:59Z',
      };

      const fetchSpy = jest.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => mockResponseBody,
      } as Response);
      global.fetch = fetchSpy as any;

      const result = await SetuDigiLockerService.createRequest('http://custom-redirect.com/callback');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, options] = fetchSpy.mock.calls[0];

      expect(url).toBe('https://dg-sandbox.setu.co/api/digilocker');
      expect(options.method).toBe('POST');
      expect(options.headers).toEqual({
        'x-client-id': 'test-client-id-123',
        'x-client-secret': 'test-client-secret-456',
        'x-product-instance-id': 'test-product-instance-789',
        'Content-Type': 'application/json',
        'User-Agent': 'OnShift-Backend/1.0.0',
      });
      expect(JSON.parse(options.body)).toEqual({
        redirectUrl: 'http://custom-redirect.com/callback',
      });

      expect(result).toEqual(mockResponseBody);
    });

    it('uses default redirectUrl from config if none is provided', async () => {
      const fetchSpy = jest.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({ id: 'req_1', status: 'unauthenticated', url: '', validUpto: '' }),
      } as Response);
      global.fetch = fetchSpy as any;

      await SetuDigiLockerService.createRequest();

      const options = fetchSpy.mock.calls[0][1];
      expect(JSON.parse(options.body).redirectUrl).toBe(config.setuDigiLockerRedirectUrl);
    });
  });

  // =========================================================================
  // B. getStatus
  // =========================================================================
  describe('B. getStatus', () => {
    it('sends GET to /api/digilocker/{requestId}/status with correct headers and parses response', async () => {
      const mockStatusResponse = {
        id: 'req_setu_888',
        status: 'authenticated',
        url: 'https://dg-sandbox.setu.co/auth/req_setu_888',
        validUpto: '2026-12-31T23:59:59Z',
        digilockerUserDetails: {
          digilockerId: 'dl_user_123',
          email: 'worker@example.com',
          phoneNumber: '9876543210',
        },
      };

      const fetchSpy = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockStatusResponse,
      } as Response);
      global.fetch = fetchSpy as any;

      const result = await SetuDigiLockerService.getStatus('req_setu_888');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, options] = fetchSpy.mock.calls[0];

      expect(url).toBe('https://dg-sandbox.setu.co/api/digilocker/req_setu_888/status');
      expect(options.method).toBe('GET');
      expect(options.headers['x-client-id']).toBe('test-client-id-123');
      expect(result).toEqual(mockStatusResponse);
    });

    it('validates empty or invalid requestId', async () => {
      await expect(SetuDigiLockerService.getStatus('')).rejects.toThrow(ApiError);
    });
  });

  // =========================================================================
  // C. getAadhaar
  // =========================================================================
  describe('C. getAadhaar', () => {
    it('sends GET to /api/digilocker/{requestId}/aadhaar and correctly parses response', async () => {
      const mockAadhaarResponse = {
        id: 'req_setu_777',
        status: 'complete',
        aadhaar: {
          maskedNumber: 'XXXX-XXXX-4321',
          name: 'Ravi Kumar',
          dateOfBirth: '1992-08-15',
          gender: 'M',
          verified: { signature: true },
          xml: { fileUrl: 'https://dg-sandbox.setu.co/files/xml/777' },
        },
      };

      const fetchSpy = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockAadhaarResponse,
      } as Response);
      global.fetch = fetchSpy as any;

      const consoleSpy = jest.spyOn(console, 'log');

      const result = await SetuDigiLockerService.getAadhaar('req_setu_777');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const url = fetchSpy.mock.calls[0][0];
      expect(url).toBe('https://dg-sandbox.setu.co/api/digilocker/req_setu_777/aadhaar');
      expect(result).toEqual(mockAadhaarResponse);

      // Verify no raw sensitive Aadhaar values were logged to console
      for (const call of consoleSpy.mock.calls) {
        const logMsg = call.join(' ');
        expect(logMsg).not.toContain('test-client-secret');
        expect(logMsg).not.toContain('4321');
      }
    });
  });

  // =========================================================================
  // D. revoke
  // =========================================================================
  describe('D. revoke', () => {
    it('calls GET /api/digilocker/{requestId}/revoke with correct headers', async () => {
      const mockRevokeResponse = { id: 'req_setu_666', status: 'revoked' };

      const fetchSpy = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockRevokeResponse,
      } as Response);
      global.fetch = fetchSpy as any;

      const result = await SetuDigiLockerService.revoke('req_setu_666');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy.mock.calls[0][0]).toBe('https://dg-sandbox.setu.co/api/digilocker/req_setu_666/revoke');
      expect(result).toEqual(mockRevokeResponse);
    });
  });

  // =========================================================================
  // E. getDocuments
  // =========================================================================
  describe('E. getDocuments', () => {
    it('calls GET /api/digilocker/documents with correct headers', async () => {
      const mockDocsResponse = {
        documents: [{ name: 'Aadhaar Card', type: 'AADHAAR', uri: 'in.gov.uidai-adhar' }],
      };

      const fetchSpy = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockDocsResponse,
      } as Response);
      global.fetch = fetchSpy as any;

      const result = await SetuDigiLockerService.getDocuments();

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy.mock.calls[0][0]).toBe('https://dg-sandbox.setu.co/api/digilocker/documents');
      expect(result).toEqual(mockDocsResponse);
    });
  });

  // =========================================================================
  // F. Configuration Validation
  // =========================================================================
  describe('F. Configuration Validation', () => {
    it('fails clearly with SETU_DIGILOCKER_NOT_CONFIGURED when clientId is missing', async () => {
      config.setuDigiLockerClientId = '';

      await expect(SetuDigiLockerService.createRequest()).rejects.toThrow(ApiError);
      try {
        await SetuDigiLockerService.createRequest();
      } catch (err: any) {
        expect(err).toBeInstanceOf(ApiError);
        expect(err.statusCode).toBe(500);
        expect(err.code).toBe('SETU_DIGILOCKER_NOT_CONFIGURED');
        expect(err.message).toContain('SETU_DIGILOCKER_CLIENT_ID');
      }
    });

    it('fails clearly with SETU_DIGILOCKER_NOT_CONFIGURED when clientSecret is missing', async () => {
      config.setuDigiLockerClientSecret = '';

      try {
        await SetuDigiLockerService.getStatus('req_123');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ApiError);
        expect(err.statusCode).toBe(500);
        expect(err.code).toBe('SETU_DIGILOCKER_NOT_CONFIGURED');
        expect(err.message).toContain('SETU_DIGILOCKER_CLIENT_SECRET');
      }
    });

    it('fails clearly with SETU_DIGILOCKER_NOT_CONFIGURED when productInstanceId is missing', async () => {
      config.setuDigiLockerProductInstanceId = '';

      try {
        await SetuDigiLockerService.getAadhaar('req_123');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ApiError);
        expect(err.statusCode).toBe(500);
        expect(err.code).toBe('SETU_DIGILOCKER_NOT_CONFIGURED');
        expect(err.message).toContain('SETU_DIGILOCKER_PRODUCT_INSTANCE_ID');
      }
    });
  });

  // =========================================================================
  // G. Upstream Failures
  // =========================================================================
  describe('G. Upstream Failures', () => {
    it('handles 400 Bad Request response cleanly without exposing secrets', async () => {
      const fetchSpy = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ message: 'Invalid redirect URL domain.' }),
      } as Response);
      global.fetch = fetchSpy as any;

      try {
        await SetuDigiLockerService.createRequest('http://unapproved.com');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ApiError);
        expect(err.statusCode).toBe(400);
        expect(err.code).toBe('SETU_DIGILOCKER_API_ERROR');
        expect(err.message).toBe('Invalid redirect URL domain.');
        expect(err.message).not.toContain('test-client-secret-456');
      }
    });

    it('handles 401 Unauthorized response cleanly', async () => {
      const fetchSpy = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Invalid Setu product instance credentials.' }),
      } as Response);
      global.fetch = fetchSpy as any;

      try {
        await SetuDigiLockerService.getStatus('req_123');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ApiError);
        expect(err.statusCode).toBe(401);
        expect(err.code).toBe('SETU_DIGILOCKER_API_ERROR');
      }
    });

    it('handles 500 Internal Server Error response cleanly', async () => {
      const fetchSpy = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ message: 'Internal DigiLocker sandbox gateway error.' }),
      } as Response);
      global.fetch = fetchSpy as any;

      try {
        await SetuDigiLockerService.getAadhaar('req_123');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ApiError);
        expect(err.statusCode).toBe(500);
        expect(err.code).toBe('SETU_DIGILOCKER_API_ERROR');
      }
    });

    it('handles network error / fetch rejection cleanly', async () => {
      const fetchSpy = jest.fn().mockRejectedValue(new Error('Connection refused to dg-sandbox.setu.co'));
      global.fetch = fetchSpy as any;

      try {
        await SetuDigiLockerService.createRequest();
      } catch (err: any) {
        expect(err).toBeInstanceOf(ApiError);
        expect(err.statusCode).toBe(502);
        expect(err.code).toBe('SETU_DIGILOCKER_NETWORK_ERROR');
        expect(err.message).toContain('Connection refused');
      }
    });
  });

  // =========================================================================
  // H. Explicit Mock Mode
  // =========================================================================
  describe('H. Explicit Mock Mode', () => {
    it('returns synthetic mock response when setuDigiLockerMockMode=true is explicitly set', async () => {
      config.setuDigiLockerMockMode = true;
      config.setuDigiLockerClientId = ''; // missing credentials allowed in explicit mock mode

      const createRes = await SetuDigiLockerService.createRequest();
      expect(createRes.id).toBe('mock_req_12345');
      expect(createRes.status).toBe('unauthenticated');
      expect(createRes.url).toContain('dg-sandbox.setu.co');

      const statusRes = await SetuDigiLockerService.getStatus('mock_req_12345');
      expect(statusRes.id).toBe('mock_req_12345');
      expect(statusRes.status).toBe('authenticated');
      expect(statusRes.digilockerUserDetails?.digilockerId).toBe('mock_dl_id_789');

      const aadhaarRes = await SetuDigiLockerService.getAadhaar('mock_req_12345');
      expect(aadhaarRes.id).toBe('mock_req_12345');
      expect(aadhaarRes.status).toBe('complete');
      expect(aadhaarRes.aadhaar?.maskedNumber).toBe('XXXX-XXXX-1234');
    });
  });
});
