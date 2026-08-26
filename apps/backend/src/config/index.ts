import path from 'path';
import dns from 'dns';
import dotenv from 'dotenv';

// Load .env from backend directory and monorepo root
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

try {
  dns.setDefaultResultOrder('ipv4first');
} catch (_) {
  // Ignore if unsupported
}

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/onshift_db',
  verificationEngineUrl: process.env.VERIFICATION_ENGINE_URL || 'http://localhost:8000',
  issuerName: process.env.ISSUER_NAME || 'OnShift Proof Authority',
  ed25519PrivateKeyHex:
    process.env.ED25519_PRIVATE_KEY_HEX || '',
  ed25519PublicKeyHex:
    process.env.ED25519_PUBLIC_KEY_HEX ||
    'd75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a',
  trustedIssuer: process.env.ISSUER_NAME || 'OnShift Proof Authority',
  trustedIssuerPublicKeyHex:
    process.env.ED25519_PUBLIC_KEY_HEX ||
    'd75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a',
  demoMode: process.env.ONSHIFT_DEMO_MODE === 'true' && process.env.NODE_ENV !== 'production',
  jwtSecret: process.env.JWT_SECRET || 'onshift_default_jwt_secret_key_2026_dev_demo_only',
  setuDigiLockerBaseUrl: process.env.SETU_DIGILOCKER_BASE_URL || 'https://dg-sandbox.setu.co',
  setuDigiLockerClientId: process.env.SETU_DIGILOCKER_CLIENT_ID || '',
  setuDigiLockerClientSecret: process.env.SETU_DIGILOCKER_CLIENT_SECRET || '',
  setuDigiLockerProductInstanceId: process.env.SETU_DIGILOCKER_PRODUCT_INSTANCE_ID || '',
  setuDigiLockerRedirectUrl:
    process.env.SETU_DIGILOCKER_REDIRECT_URL ||
    'http://localhost:4000/api/v1/identity/digilocker/callback',
  setuDigiLockerMockMode: process.env.SETU_DIGILOCKER_MOCK_MODE === 'true',
};
