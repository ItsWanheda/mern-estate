import dotenv from 'dotenv';

dotenv.config();

const toInt = (value, fallback) => {
  if (value === undefined || value === '') return fallback;
  const n = Number(value);
  return Number.isInteger(n) ? n : NaN;
};

const toList = (value) => (value ? String(value).split(',').map((v) => v.trim()).filter(Boolean) : []);

/**
 * Parse and validate process environment into a typed config object.
 * Throws one Error listing every problem so misconfiguration is fixed in one pass.
 */
export function loadConfig(env = process.env) {
  const errors = [];
  const nodeEnv = env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';
  const isTest = nodeEnv === 'test';

  const int = (name, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) => {
    const value = toInt(env[name], fallback);
    if (!Number.isInteger(value) || value < min || value > max) {
      errors.push(`${name} must be an integer between ${min} and ${max}.`);
      return fallback;
    }
    return value;
  };

  const mongoUri = env.MONGO || '';
  if (!mongoUri && !isTest) errors.push('MONGO is required.');

  const jwtSecret = env.JWT_SECRET || '';
  if (!jwtSecret && !isTest) errors.push('JWT_SECRET is required.');
  if (isProduction && jwtSecret && jwtSecret.length < 32) errors.push('JWT_SECRET must be at least 32 characters in production.');

  const redisUrl = env.REDIS_URL || '';
  if (isProduction && !redisUrl) errors.push('REDIS_URL is required in production (shared rate limiting and, later, sessions).');
  if (redisUrl && !/^rediss?:\/\//.test(redisUrl)) errors.push('REDIS_URL must start with redis:// or rediss://.');

  const corsOrigins = toList(env.CORS_ORIGINS);
  for (const origin of corsOrigins) {
    if (origin === '*') errors.push('CORS_ORIGINS must not contain "*"; list explicit origins.');
    else if (!/^https?:\/\/[^/\s]+$/.test(origin)) errors.push(`CORS_ORIGINS entry "${origin}" is not a valid origin (scheme://host[:port], no path).`);
  }

  const trustProxy = int('TRUST_PROXY', isProduction ? 1 : 0, { min: 0, max: 10 });

  const config = {
    nodeEnv,
    isProduction,
    isTest,
    port: int('PORT', 3000, { min: 0, max: 65535 }),
    logLevel: env.LOG_LEVEL || (isTest ? 'silent' : isProduction ? 'info' : 'debug'),
    mongo: {
      uri: mongoUri,
      maxPoolSize: int('MONGO_MAX_POOL_SIZE', 10, { min: 1, max: 200 }),
      minPoolSize: int('MONGO_MIN_POOL_SIZE', 0, { min: 0, max: 200 }),
      serverSelectionTimeoutMS: int('MONGO_SERVER_SELECTION_TIMEOUT_MS', 5000, { min: 500 }),
      socketTimeoutMS: int('MONGO_SOCKET_TIMEOUT_MS', 30000, { min: 1000 }),
      connectAttempts: int('MONGO_CONNECT_ATTEMPTS', 5, { min: 1, max: 30 }),
    },
    redis: { url: redisUrl },
    firebase: {
      projectId: env.FIREBASE_PROJECT_ID || '',
      storageBucket: env.FIREBASE_STORAGE_BUCKET || '',
    },
    auth: {
      jwtSecret,
      jwtExpiresIn: env.JWT_EXPIRES_IN || '7d',
    },
    security: {
      corsOrigins,
      trustProxy,
      bodyLimit: env.BODY_LIMIT || '256kb',
      apiRateLimitPerMinute: int('API_RATE_LIMIT_PER_MINUTE', 300, { min: 1 }),
      authRateLimitMax: int('AUTH_RATE_LIMIT_MAX', 20, { min: 1 }),
      authRateLimitWindowMs: int('AUTH_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000, { min: 1000 }),
    },
    server: {
      requestTimeoutMs: int('REQUEST_TIMEOUT_MS', 30000, { min: 1000 }),
      shutdownTimeoutMs: int('SHUTDOWN_TIMEOUT_MS', 10000, { min: 1000 }),
    },
  };

  if (config.firebase.projectId && !config.firebase.storageBucket) errors.push('FIREBASE_STORAGE_BUCKET is required when FIREBASE_PROJECT_ID is configured.');
  if (config.mongo.minPoolSize > config.mongo.maxPoolSize) errors.push('MONGO_MIN_POOL_SIZE must not exceed MONGO_MAX_POOL_SIZE.');

  if (errors.length) throw new Error('Invalid configuration:\n - ' + errors.join('\n - '));
  return config;
}
