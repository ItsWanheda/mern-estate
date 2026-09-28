import jwt from 'jsonwebtoken';

const isProduction = process.env.NODE_ENV === 'production';
export const AUTH_COOKIE = 'access_token';

export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
};

export const signAccessToken = (id) => jwt.sign(
  { id: String(id) },
  process.env.JWT_SECRET,
  { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
);

export const setAuthCookie = (res, token) => res.cookie(AUTH_COOKIE, token, AUTH_COOKIE_OPTIONS);
export const clearAuthCookie = (res) => res.clearCookie(AUTH_COOKIE, { ...AUTH_COOKIE_OPTIONS, maxAge: undefined });

export const securityHeaders = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (isProduction) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
};