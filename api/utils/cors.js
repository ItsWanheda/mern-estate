/**
 * Strict origin allowlist. The SPA is served from the same origin as the API,
 * so with no CORS_ORIGINS configured no CORS headers are emitted at all.
 */
export const createCors = (allowedOrigins = []) => {
  const allowed = new Set(allowedOrigins);
  return (req, res, next) => {
    const origin = req.headers.origin;
    if (origin) res.vary('Origin');
    if (!origin || !allowed.has(origin)) return next();
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-Request-Id');
      res.setHeader('Access-Control-Max-Age', '600');
      return res.status(204).end();
    }
    return next();
  };
};
