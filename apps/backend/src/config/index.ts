import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/onshift_db',
  verificationEngineUrl: process.env.VERIFICATION_ENGINE_URL || 'http://localhost:8000',
  issuerName: process.env.ISSUER_NAME || 'OnShift Proof Authority',
  ed25519PrivateKeyHex:
    process.env.ED25519_PRIVATE_KEY_HEX ||
    '9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60',
  ed25519PublicKeyHex:
    process.env.ED25519_PUBLIC_KEY_HEX ||
    'd75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a',
  jwtSecret: process.env.JWT_SECRET || 'onshift_default_jwt_secret_key_2026_dev_demo_only',
};
