const http = require('http');

const BASE_HTTP = 'http://localhost:4000';

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
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data });
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

async function setIdentityVerified() {
  try {
    console.log('Getting auth token...');
    const login = await httpRequest('/api/v1/auth/login', 'POST', { 
      workerId: 'OS-DEMO-001', 
      role: 'WORKER' 
    });
    const token = login.data.token;
    console.log('Token obtained:', token.substring(0, 20) + '...');

    console.log('Setting identity as verified...');
    const result = await httpRequest(
      '/api/v1/admin/set-identity-verified',
      'POST',
      { workerId: 'OS-DEMO-001' },
      { Authorization: `Bearer ${token}` }
    );

    console.log('Response:', JSON.stringify(result.data, null, 2));
    
    // Verify the status
    console.log('Checking identity status...');
    const status = await httpRequest(
      '/api/v1/identity/digilocker/status',
      'GET',
      null,
      { Authorization: `Bearer ${token}` }
    );
    console.log('Identity status:', JSON.stringify(status.data, null, 2));

  } catch (error) {
    console.error('Error:', error.message);
  }
}

setIdentityVerified();