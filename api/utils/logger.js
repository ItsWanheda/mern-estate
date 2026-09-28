import crypto from 'node:crypto';
import pino from 'pino';
import pinoHttp from 'pino-http';

// Anything matching these paths is replaced before a log line is written.
export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  '*.password',
  '*.newPassword',
  '*.currentPassword',
  '*.otp',
  '*.code',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.idToken',
  '*.apiKey',
  '*.secret',
  '*.merchantId',
  'password',
  'otp',
  'token',
  'refreshToken',
  'apiKey',
];

export const createLogger = ({ level = 'info', destination } = {}) => pino(
  { level, redact: { paths: REDACT_PATHS, censor: '[REDACTED]' }, base: { service: 'mern-estate-api' }, timestamp: pino.stdTimeFunctions.isoTime },
  destination,
);

const REQUEST_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

export const requestIdFrom = (req) => {
  const incoming = req.headers['x-request-id'];
  return typeof incoming === 'string' && REQUEST_ID_RE.test(incoming) ? incoming : crypto.randomUUID();
};

export const createHttpLogger = (logger) => pinoHttp({
  logger,
  genReqId: (req, res) => {
    const id = requestIdFrom(req);
    res.setHeader('X-Request-Id', id);
    return id;
  },
  customLogLevel: (req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
  // Log the path only: query strings can carry tokens (e.g. payment authority codes).
  serializers: {
    req: (req) => ({ id: req.id, method: req.method, path: String(req.url).split('?')[0], remoteAddress: req.remoteAddress }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
  autoLogging: { ignore: (req) => req.url === '/api/health' },
});
