/**
 * End-to-end consent flow test against the running backend.
 * login -> consent/request -> mock-aa approve -> status -> fetch-data (x2 to prove idempotency)
 * Safe to delete afterwards.
 */
const B = 'http://localhost:4000/api/v1';

async function j(method, path, body, token) {
  const r = await fetch(B + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { s: r.status, d: await r.json().catch(() => ({})) };
}

(async () => {
  const login = await j('POST', '/auth/login', { workerId: 'OS-DEMO-001' });
  console.log('login:', login.s, JSON.stringify(login.d).slice(0, 150));
  const token = login.d.token || login.d.accessToken;
  if (!token) {
    console.error('NO TOKEN IN RESPONSE');
    process.exit(1);
  }

  const c = await j('POST', '/consent/request', { workerId: 'OS-DEMO-001', fiTypes: ['DEPOSIT'] }, token);
  console.log('consent:', c.s, JSON.stringify(c.d).slice(0, 200));
  const cid = c.d.consentId;

  const ap = await fetch(B + '/mock-aa/consent/' + cid + '/approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fipId: 'onshift-mock-fip' }),
  });
  console.log('approve:', ap.status);

  const st = await j('GET', '/consent/status/' + cid, null, token);
  console.log('status:', st.s, JSON.stringify(st.d).slice(0, 200));

  const fd = await j('POST', '/consent/fetch-data', { consentId: cid }, token);
  console.log('fetch-data:', fd.s, JSON.stringify(fd.d).slice(0, 250));

  const fd2 = await j('POST', '/consent/fetch-data', { consentId: cid }, token);
  console.log('fetch-data repeat:', fd2.s, 'reusedCount:', fd2.d.reusedCount);

  // ── Verification: reconcile stored evidence -> expect FINANCIALLY_CORROBORATED
  const ver = await j('POST', '/verification/run', { workerId: 'OS-DEMO-001' }, token);
  console.log('verification:', ver.s);
  console.log('  level:', ver.d.level);
  console.log('  confidence:', ver.d.confidence);
  console.log('  reason:', ver.d.reason);
  console.log('  reconciliationStatus:', ver.d.reconciliationStatus);
  console.log('  expectedNet:', ver.d.expectedNet, '| actualSettlement:', ver.d.actualSettlement);
  console.log('  engineSource:', ver.d.engineSource);

  const ok = fd.s === 200 && fd2.s === 200 && ver.s === 200 && ver.d.level === 'FINANCIALLY_CORROBORATED';
  process.exit(ok ? 0 : 1);
})().catch((e) => {
  console.error('E2E FAIL:', e.message);
  process.exit(1);
});