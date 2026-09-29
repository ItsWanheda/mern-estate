import crypto from 'node:crypto';

export const CSRF_COOKIE = 'csrf_token';
export const CSRF_HEADER = 'X-CSRF-Token';

const unsafeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const tokenOptions = {
  httpOnly: false,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 60 * 60 * 1000,
  path: '/',
};

const createToken = () => crypto.randomBytes(32).toString('hex');

export const csrfProtection = (req, res, next) => {
  let token = req.cookies?.[CSRF_COOKIE];

  if (!token) {
    token = createToken();
    res.cookie(CSRF_COOKIE, token, tokenOptions);
  }

  if (!unsafeMethods.has(req.method) || req.method === 'OPTIONS') return next();

  const supplied = req.get(CSRF_HEADER);
  if (!supplied || supplied.length !== token.length) {
    return res.status(403).json({ success: false, statusCode: 403, message: 'Invalid CSRF token.' });
  }

  const valid = crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(token));
  if (!valid) {
    return res.status(403).json({ success: false, statusCode: 403, message: 'Invalid CSRF token.' });
  }

  return next();
};

export const issueCsrfToken = (req, res) => {
  let token = req.cookies?.[CSRF_COOKIE];
  if (!token) {
    token = createToken();
    res.cookie(CSRF_COOKIE, token, tokenOptions);
  }
  return res.status(200).json({ csrfToken: token });
};
