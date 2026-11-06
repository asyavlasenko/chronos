import dotenv from 'dotenv';

// Локально читає backend/.env; у Docker змінні приходять з docker-compose
dotenv.config();

const { env: e } = process;

const env = Object.freeze({
  nodeEnv: e.NODE_ENV || 'development',
  isProduction: e.NODE_ENV === 'production',
  isTest: e.NODE_ENV === 'test',
  port: Number(e.PORT) || 4000,
  mongoUri: e.MONGO_URI || 'mongodb://localhost:27017/chronos',
  clientUrl: e.CLIENT_URL || 'http://localhost:5173',
  jwt: {
    accessSecret: e.JWT_ACCESS_SECRET || 'dev-only-access-secret',
    refreshSecret: e.JWT_REFRESH_SECRET || 'dev-only-refresh-secret',
    accessTtl: e.JWT_ACCESS_TTL || '15m',
    refreshTtl: e.JWT_REFRESH_TTL || '30d',
  },
  smtp: {
    host: e.SMTP_HOST || '',
    port: Number(e.SMTP_PORT) || 587,
    secure: e.SMTP_SECURE === 'true',
    user: e.SMTP_USER || '',
    pass: e.SMTP_PASS || '',
    from: e.SMTP_FROM || 'Chronos <no-reply@chronos.local>',
  },
  holidays: {
    apiUrl: e.HOLIDAYS_API_URL || 'https://date.nager.at/api/v3',
    defaultCountry: e.DEFAULT_COUNTRY || 'UA',
    cacheTtlDays: 30,
  },
});

if (env.isProduction && (!e.JWT_ACCESS_SECRET || !e.JWT_REFRESH_SECRET)) {
  throw new Error('У production обов’язкові JWT_ACCESS_SECRET і JWT_REFRESH_SECRET');
}

export default env;
