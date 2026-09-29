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

const CURSOR_CONTEXT = 'mern-estate:listings:cursor:v1';

export const signCursor = (payload) => {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = jwt.sign({ body, context: CURSOR_CONTEXT }, process.env.JWT_SECRET, { algorithm: 'HS256' });
  return `${body}.${signature}`;
};

export const verifyCursor = (cursor) => {
  if (typeof cursor !== 'string' || cursor.length < 10 || cursor.length > 2048) return null;
  const [body, signature, ...extra] = cursor.split('.');
  if (!body || !signature || extra.length || !/^[A-Za-z0-9_-]+$/.test(body)) return null;

  try {
    const claims = jwt.verify(signature, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (claims.context !== CURSOR_CONTEXT || claims.body !== body) return null;
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
};

export const securityHeaders = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (isProduction) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
};