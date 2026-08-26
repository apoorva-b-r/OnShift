const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Try loading local setu-aa-test/.env first, then root .env as fallback
const localEnvPath = path.join(__dirname, '.env');
const rootEnvPath = path.join(__dirname, '..', '.env');

if (fs.existsSync(localEnvPath)) {
  require('dotenv').config({ path: localEnvPath, override: true });
} else if (fs.existsSync(rootEnvPath)) {
  require('dotenv').config({ path: rootEnvPath, override: true });
} else {
  require('dotenv').config({ override: true });
}

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Clean helper to get env value or fallback
const getCleanEnv = (keys, fallback = '') => {
  for (const key of keys) {
    const val = process.env[key];
    if (val && typeof val === 'string' && val.trim() !== '' && !val.includes('your_')) {
      return val.trim();
    }
  }
  return fallback;
};

// Helpers to get Setu configs
const getSetuConfig = () => {
  return {
    clientId: getCleanEnv(['SETU_CLIENT_ID', 'CLIENT_ID']),
    clientSecret: getCleanEnv(['SETU_CLIENT_SECRET', 'CLIENT_SECRET']),
    productInstanceId: getCleanEnv(['SETU_PRODUCT_INSTANCE_ID', 'SETU_PRODUCT_ID', 'PRODUCT_INSTANCE_ID', 'PRODUCT_ID']),
    baseUrl: getCleanEnv(['SETU_BASE_URL'], 'https://fiu-sandbox.setu.co').replace(/\/+$/, ''),
    aaId: getCleanEnv(['SETU_AA_ID'], 'setu-aa'),
    fiuId: getCleanEnv(['SETU_FIU_ID'], 'setu-fiu-id'),
    redirectUrl: getCleanEnv(['SETU_REDIRECT_URL'], `http://localhost:${PORT}/consent-callback.html`)
  };
};

const getSetuHeaders = (config) => {
  const headers = {
    'x-client-id': config.clientId,
    'x-client-secret': config.clientSecret,
    'Content-Type': 'application/json'
  };
  if (config.productInstanceId) {
    headers['x-product-instance-id'] = config.productInstanceId;
  }
  return headers;
};

/**
 * POST /api/create-consent
 * Creates a consent request on Setu Account Aggregator
 */
app.post('/api/create-consent', async (req, res) => {
  const setuConfig = getSetuConfig();
  const { baseUrl, aaId, fiuId, redirectUrl } = setuConfig;
  const headers = getSetuHeaders(setuConfig);
  const mobileNumber = req.body.mobile_number || req.body.mobileNumber || '9999999999';

  // Construct dates
  const now = new Date();
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(now.getMonth() - 3);

  const oneYearFromNow = new Date();
  oneYearFromNow.setFullYear(now.getFullYear() + 1);

  const customerId = `${mobileNumber}@${aaId}`;

  // Setu consent payload
  const payload = {
    Detail: {
      consentMode: "VIEW",
      fetchType: "PERIODIC",
      consentTypes: ["TRANSACTIONS"],
      fiTypes: ["DEPOSIT"],
      DataConsumer: {
        id: fiuId
      },
      Customer: {
        id: customerId
      },
      Purpose: {
        code: "103",
        refUri: "https://api.rebit.org.in/aa/purpose/103.xml",
        text: "Bank statement verification/underwriting",
        Category: {
          type: "string"
        }
      },
      FIDataRange: {
        from: threeMonthsAgo.toISOString(),
        to: now.toISOString()
      },
      DataLife: {
        unit: "MONTH",
        value: 3
      },
      Frequency: {
        unit: "MONTH",
        value: 4
      },
      consentStart: now.toISOString(),
      consentExpiry: oneYearFromNow.toISOString()
    },
    redirectUrl: redirectUrl
  };

  const endpoint = `${baseUrl}/consents`;

  console.log('\n=================== [SETU CREATE CONSENT REQUEST] ===================');
  console.log(`Endpoint: POST ${endpoint}`);
  console.log('Headers:', {
    'x-client-id': setuConfig.clientId ? `${setuConfig.clientId.substring(0, 6)}...` : '(EMPTY)',
    'x-client-secret': setuConfig.clientSecret ? '******' : '(EMPTY)',
    'x-product-instance-id': setuConfig.productInstanceId || '(NOT SET)',
    'Content-Type': 'application/json'
  });
  console.log('Payload:', JSON.stringify(payload, null, 2));

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    });

    const responseText = await response.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { rawResponse: responseText };
    }

    console.log(`\n=================== [SETU CREATE CONSENT RESPONSE: ${response.status}] ===================`);
    console.log(JSON.stringify(responseData, null, 2));

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: `Setu API responded with status ${response.status}`,
        details: responseData
      });
    }

    // Extract handle from various potential fields returned by Setu
    const consentHandle = responseData.ConsentHandle || responseData.consentHandle || responseData.id || responseData.handle;
    const url = responseData.url || (consentHandle ? `https://anumati.setu.co/${consentHandle}?redirect_url=${encodeURIComponent(redirectUrl)}` : null);

    return res.status(200).json({
      success: true,
      consentHandle: consentHandle,
      url: url,
      redirectUrl: redirectUrl,
      raw: responseData
    });
  } catch (error) {
    console.error('\n[SETU CREATE CONSENT ERROR]:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal Server Error during Setu consent creation',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * GET /api/consent-status/:consentHandle
 * Fetches status of the consent handle from Setu
 */
app.get('/api/consent-status/:consentHandle', async (req, res) => {
  const setuConfig = getSetuConfig();
  const { baseUrl } = setuConfig;
  const headers = getSetuHeaders(setuConfig);
  const consentHandle = req.params.consentHandle;

  if (!consentHandle) {
    return res.status(400).json({ success: false, error: 'consentHandle parameter is required' });
  }

  const endpoint = `${baseUrl}/consents/handle/${consentHandle}`;

  console.log('\n=================== [SETU CONSENT STATUS REQUEST] ===================');
  console.log(`Endpoint: GET ${endpoint}`);
  console.log('Headers:', {
    'x-client-id': setuConfig.clientId ? `${setuConfig.clientId.substring(0, 6)}...` : '(EMPTY)',
    'x-client-secret': setuConfig.clientSecret ? '******' : '(EMPTY)',
    'x-product-instance-id': setuConfig.productInstanceId || '(NOT SET)'
  });

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: headers
    });

    const responseText = await response.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { rawResponse: responseText };
    }

    console.log(`\n=================== [SETU CONSENT STATUS RESPONSE: ${response.status}] ===================`);
    console.log(JSON.stringify(responseData, null, 2));

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: `Setu API responded with status ${response.status}`,
        details: responseData
      });
    }

    return res.status(200).json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('\n[SETU CONSENT STATUS ERROR]:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal Server Error during Setu consent status check',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Start server
app.listen(PORT, () => {
  const config = getSetuConfig();
  console.log(`\n======================================================`);
  console.log(`🚀 Setu AA Test App is running on http://localhost:${PORT}`);
  console.log(`======================================================`);
  console.log(`Config Loaded:`);
  console.log(`- Base URL:             ${config.baseUrl}`);
  console.log(`- Client ID:            ${config.clientId ? config.clientId.substring(0, 8) + '...' : '(MISSING)'}`);
  console.log(`- Client Secret:        ${config.clientSecret ? '******' : '(MISSING)'}`);
  console.log(`- Product Instance ID:  ${config.productInstanceId || '(NOT SET)'}`);
  console.log(`- FIU ID:               ${config.fiuId}`);
  console.log(`- AA ID:                ${config.aaId}`);
  console.log(`- Redirect URL:         ${config.redirectUrl}`);
  console.log(`======================================================\n`);
});
