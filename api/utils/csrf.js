import crypto from 'node:crypto';

export const CSRF_COOKIE = 'csrf_token';
export const CSRF_HEADER = 'X-CSRF-Token';

const tokenOptions = {
  httpOnly: false,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 60 * 60 * 1000,
  path: '/',
};

const createToken = () => crypto.randomBytes(32).toString('hex');

export const issueCsrfToken = (req, res) => {
  let token = req.cookies?.[CSRF_COOKIE];
  if (!token) {
    token = createToken();
    res.cookie(CSRF_COOKIE, token, tokenOptions);
  }
  return res.status(200).json({ csrfToken: token });
};
