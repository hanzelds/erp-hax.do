import dotenv from 'dotenv'
dotenv.config()

function required(key: string): string {
  const value = process.env[key]
  if (!value) throw new Error(`❌ Variable de entorno requerida: ${key}`)
  return value
}

function optional(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue
}

export const env = {
  NODE_ENV: optional('NODE_ENV', 'development') as 'development' | 'production' | 'test',
  API_PORT: parseInt(optional('API_PORT', '4000')),

  DATABASE_URL: required('DATABASE_URL'),
  REDIS_URL: optional('REDIS_URL', 'redis://localhost:6379'),

  JWT_SECRET: required('JWT_SECRET'),
  JWT_EXPIRES_IN: optional('JWT_EXPIRES_IN', '8h'),
  JWT_REFRESH_SECRET: required('JWT_REFRESH_SECRET'),
  JWT_REFRESH_EXPIRES_IN: optional('JWT_REFRESH_EXPIRES_IN', '7d'),

  ALANUBE_API_URL: optional('ALANUBE_API_URL', 'https://api.alanube.com.do'),
  ALANUBE_API_KEY: optional('ALANUBE_API_KEY', ''),
  ALANUBE_ENV: optional('ALANUBE_ENV', 'sandbox') as 'sandbox' | 'production',

  SMTP_HOST: optional('SMTP_HOST', 'smtp.gmail.com'),
  SMTP_PORT: parseInt(optional('SMTP_PORT', '587')),
  SMTP_USER: optional('SMTP_USER', ''),
  SMTP_PASS: optional('SMTP_PASS', ''),

  COMPANY_NAME: optional('COMPANY_NAME', 'HAX ESTUDIO CREATIVO EIRL'),
  COMPANY_RNC: optional('COMPANY_RNC', '133290251'),
  COMPANY_EMAIL: optional('COMPANY_EMAIL', 'info@hax.com.do'),
}
