import type { StringValue } from 'ms';

export const AUTH_CONSTANTS = {
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key-change-this',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN as StringValue || '15m' as StringValue,
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN as StringValue || '7d' as StringValue,
  BCRYPT_ROUNDS: 10,

  // Configuración de Cookies
  COOKIE_ACCESS_TOKEN: 'accessToken',
  COOKIE_REFRESH_TOKEN: 'refreshToken',
};

export const METADATA_KEYS = {
  IS_PUBLIC: 'isPublic',
  ROLES: 'roles',
  PERMISSIONS: 'permissions',
};

// Opciones de cookies para cross-domain (Vercel → Render)
export const COOKIE_OPTIONS = {
  httpOnly: true, // No accesible desde JavaScript (XSS protection)
  secure: true, // SIEMPRE true (ambos usan HTTPS)
  sameSite: 'none' as const, // CAMBIADO: permite cross-domain
  path: '/',
};

export const ACCESS_TOKEN_COOKIE_OPTIONS = {
  ...COOKIE_OPTIONS,
  maxAge: 15 * 60 * 1000, // 15 minutos
};

export const REFRESH_TOKEN_COOKIE_OPTIONS = {
  ...COOKIE_OPTIONS,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
};


export const SMPT_CONFIG = {
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  from: process.env.EMAIL_FROM

}