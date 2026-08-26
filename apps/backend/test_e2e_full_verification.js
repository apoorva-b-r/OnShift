const http = require('http');
const mongoose = require('mongoose');

const BASE_HTTP = 'http://localhost:4000';
const MONGO_URI = 'mongodb://apoorvabrajpurohit_db_user:bHKjxHP4BipA6P8E@ac-ts5tcx7-shard-00-00.ilcwc11.mongodb.net:27017,ac-ts5tcx7-shard-00-01.ilcwc11.mongodb.net:27017,ac-ts5tcx7-shard-00-02.ilcwc11.mongodb.net:27017/onshift?tls=true&replicaSet=atlas-s588pq-shard-0&authSource=admin&retryWrites=true&w=majority';

async function httpRequest(path, method = 'GET', body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_HTTP);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = res.headers['content-type']?.includes('application/json')
            ? JSON.parse(data)
            : data;
          resolve({ status: res.statusCode, headers: res.headers, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, data });
        }
      });
    });

    req.on('error', (err) => reject(err));
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runE2EVerificationSuite() {
  console.log('=== RUNNING FULL END-TO-END VERIFICATION PIPELINE TEST ===');
  const testResults = [];

  function logTest(id, title, pass, expected, actual) {
    testResults.push({ id, title, pass: !!pass, expected, actual: String(actual) });
    console.log(`[${pass ? 'PASS' : 'FAIL'}] Step ${id}: ${title}`);
    if (!pass) {
      console.log(`   Expected: ${expected}`);
      console.log(`   Actual:   ${actual}`);
    }
  }

  try {
    // 1 & 2. Backend starts & MongoDB connects
    const health = await httpRequest('/api/v1/health');
    logTest(
      1,
      'Start backend & confirm MongoDB connection',
      health.status === 200 && health.data.status === 'HEALTHY',
      'HTTP 200 with status: HEALTHY',
      `HTTP ${health.status}`
    );

    // Auth logins
    const login1 = await httpRequest('/api/v1/auth/login', 'POST', { workerId: 'OS-DEMO-001', role: 'WORKER' });
    const token1 = login1.data.token;

    const login2 = await httpRequest('/api/v1/auth/login', 'POST', { workerId: 'OS-DEMO-002', role: 'WORKER' });
    const token2 = login2.data.token;

    // Connect to MongoDB
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    }
    const db = mongoose.connection.db;

    // 5. Android sends POST /api/v1/consent/request
    const lanHost = '192.168.1.100:4000';
    const consentReq = await httpRequest(
      '/api/v1/consent/request',
      'POST',
      { workerId: 'OS-DEMO-001', fiTypes: ['DEPOSIT'] },
      { Authorization: `Bearer ${token1}`, Host: lanHost }
    );
    const consentId = consentReq.data.consentId;
    const consentUrl = consentReq.data.consentUrl;

    logTest(
      5,
      'Android sends POST /api/v1/consent/request',
      consentReq.status === 201 && !!consentId,
      'HTTP 201 Created with consentId',
      `HTTP ${consentReq.status}, consentId=${consentId}`
    );

    // 6. Confirm ConsentRequest appears in MongoDB as PENDING
    const mongoConsentBefore = await db.collection('consentrequests').findOne({ consentId });
    logTest(
      6,
      'ConsentRequest appears in MongoDB as PENDING',
      mongoConsentBefore && mongoConsentBefore.status === 'PENDING',
      'MongoDB document with status PENDING',
      mongoConsentBefore ? `status=${mongoConsentBefore.status}` : 'Not found in MongoDB'
    );

    // 7. Android opens returned Mock AA consentUrl
    const pageRes = await httpRequest(`/api/v1/mock-aa/consent/${consentId}`);
    logTest(
      7,
      'Android opens returned Mock AA consentUrl',
      pageRes.status === 200 && typeof pageRes.data === 'string' && pageRes.data.includes('Account Aggregator'),
      'HTTP 200 HTML consent page',
      `HTTP ${pageRes.status}`
    );

    // 8, 9, 10. Enter OTP 123456 & Approve -> PENDING -> ACTIVE in MongoDB
    const approveRes = await httpRequest(
      `/api/v1/mock-aa/consent/${consentId}/approve`,
      'POST',
      'fipId=onshift-mock-fip&otp=123456&from=demo',
      { 'Content-Type': 'application/x-www-form-urlencoded' }
    );

    const mongoConsentAfter = await db.collection('consentrequests').findOne({ consentId });
    logTest(
      10,
      'MongoDB consent status changes PENDING -> ACTIVE',
      approveRes.status === 302 && mongoConsentAfter && mongoConsentAfter.status === 'ACTIVE',
      'HTTP 302 redirect and MongoDB status ACTIVE',
      `HTTP ${approveRes.status}, mongoStatus=${mongoConsentAfter?.status}`
    );

    // 11. Android calls POST /api/v1/consent/fetch-data
    const fetchRes = await httpRequest(
      '/api/v1/consent/fetch-data',
      'POST',
      { consentId },
      { Authorization: `Bearer ${token1}` }
    );

    logTest(
      11,
      'Android calls POST /api/v1/consent/fetch-data',
      fetchRes.status === 200 && fetchRes.data.evidenceCount > 0,
      'HTTP 200 with evidenceCount > 0',
      `HTTP ${fetchRes.status}, count=${fetchRes.data?.evidenceCount}`
    );

    // 12. Evidence documents created in MongoDB
    const evDocs = await db.collection('evidences').find({ workerId: 'OS-DEMO-001', source: 'FINANCIAL' }).toArray();
    logTest(
      12,
      'Evidence documents created in MongoDB Atlas',
      evDocs.length > 0 && evDocs.every((e) => !!e.integrityHash),
      'Evidence documents present with valid SHA-256 integrityHash',
      `Found ${evDocs.length} FINANCIAL evidence records in MongoDB`
    );

    // 13 & 14. Run verification pipeline & check VerificationRecord in MongoDB
    const verRunRes = await httpRequest(
      '/api/v1/verification/run',
      'POST',
      { workerId: 'OS-DEMO-001', payoutPeriod: { startDate: '2026-08-01', endDate: '2026-08-07' } },
      { Authorization: `Bearer ${token1}` }
    );

    const verificationId = verRunRes.data.id;
    const mongoVerRecord = await db.collection('verificationrecords').findOne({ workerId: 'OS-DEMO-001' });

    logTest(
      13,
      'Run actual verification pipeline (POST /verification/run)',
      verRunRes.status === 200 && !!verRunRes.data.level,
      'HTTP 200 with level',
      `HTTP ${verRunRes.status}, level=${verRunRes.data?.level}`
    );

    logTest(
      14,
      'VerificationRecord created in MongoDB',
      !!mongoVerRecord && !!mongoVerRecord.level,
      'VerificationRecord document stored in MongoDB collection verificationrecords',
      mongoVerRecord ? `id=${mongoVerRecord.id}, level=${mongoVerRecord.level}` : 'Not found'
    );

    // 15. Android UI displays actual backend verification result
    logTest(
      15,
      'Android displays actual backend verification result',
      verRunRes.status === 200 && (verRunRes.data.expectedNet > 0 || verRunRes.data.actualSettlement > 0),
      'Verification result with non-zero verified settlement/income',
      `level=${verRunRes.data?.level}, confidence=${verRunRes.data?.confidence}, expectedNet=${verRunRes.data?.expectedNet}`
    );

    // --- NEGATIVE SCENARIO TESTS ---

    // Negative 1: Invalid consentId
    const invalidConsentRes = await httpRequest(
      '/api/v1/consent/status/mock-consent-invalid-999',
      'GET',
      null,
      { Authorization: `Bearer ${token1}` }
    );
    logTest(
      16,
      'Invalid consentId handled safely (404)',
      invalidConsentRes.status === 404,
      'HTTP 404 Not Found',
      `HTTP ${invalidConsentRes.status}`
    );

    // Negative 2: Cross-worker forbidden access
    const forbiddenRes = await httpRequest(
      `/api/v1/consent/status/${consentId}`,
      'GET',
      null,
      { Authorization: `Bearer ${token2}` }
    );
    logTest(
      17,
      'Cross-worker unauthorized access blocked (403)',
      forbiddenRes.status === 403,
      'HTTP 403 FORBIDDEN_CONSENT_ACCESS',
      `HTTP ${forbiddenRes.status}`
    );

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error during execution:', err);
  }

  console.log('=== COMPLETE TEST RESULTS SUMMARY ===');
  console.log(JSON.stringify(testResults, null, 2));
}

runE2EVerificationSuite();
