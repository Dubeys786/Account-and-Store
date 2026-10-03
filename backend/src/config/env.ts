import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const env = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL:
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/prozen_db?schema=public',
  JWT_SECRET: process.env.JWT_SECRET || 'prozen_enterprise_jwt_super_secret_key_2026_secure',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1d',
  CORS_ORIGIN: (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  EMAIL_HOST: process.env.EMAIL_HOST || '',
  EMAIL_PORT: parseInt(process.env.EMAIL_PORT || '587', 10),
  EMAIL_SECURE: process.env.EMAIL_SECURE === 'true',
  EMAIL_USERNAME: process.env.EMAIL_USERNAME || '',
  EMAIL_PASSWORD: process.env.EMAIL_PASSWORD || '',
  EMAIL_FROM: process.env.EMAIL_FROM || 'reports@stockledger.com',
  EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME || 'StockLedger Accounts & Finance',
};

export default env;
