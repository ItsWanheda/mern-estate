import { loadConfig } from './config/env.js';
import express from 'express';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import userRouter from './routes/user.route.js';
import { createAuthRouter } from './routes/auth.route.js';
import listingRouter from './routes/listing.route.js';
import uploadRouter from './routes/upload.route.js';
import { securityHeaders } from './utils/security.js';
import { createLogger, createHttpLogger } from './utils/logger.js';
import { createCors } from './utils/cors.js';
import { pingRedis } from './utils/redis.js';
import { ResilientStore, createRateLimiter } from './utils/rateLimit.js';
import { csrfProtection, issueCsrfToken } from './utils/csrf.js';

/**
 * Build the Express app. Nothing here connects to a database or opens a port,
 * so the app can be exercised in tests and started by server.js.
 */
export function createApp({ config = loadConfig(), logger = createLogger({ level: config.logLevel }), redisClient = null } = {}) {
  const app = express();
  const store = new ResilientStore({ redisClient, logger });
  const rootDir = path.resolve();

  app.disable('x-powered-by');
  app.set('trust proxy', config.security.trustProxy);
  app.use(createHttpLogger(logger));
  app.use(securityHeaders);
  app.use(createCors(config.security.corsOrigins));
  app.use(express.json({ limit: config.security.bodyLimit }));
  app.use(cookieParser());
  app.use((req, res, next) => {
    if (req.path === '/api/health' || req.path === '/api/ready') return next();
    if (!req.path.startsWith('/api')) return next();
    return csrfProtection(req, res, next);
  });

  // Liveness: the process is up. Deliberately independent of dependencies.
  app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok', uptime: Math.round(process.uptime()) }));

  // Readiness: can this instance serve traffic? MongoDB is required; Redis
  // degradation is reported but does not remove the instance from rotation.
  app.get('/api/ready', async (req, res) => {
    const mongo = mongoose.connection.readyState === 1 ? 'up' : 'down';
    const redis = await pingRedis(redisClient);
    const ready = mongo === 'up';
    const status = !ready ? 'unavailable' : redis === 'down' ? 'degraded' : 'ok';
    res.status(ready ? 200 : 503).json({ status, checks: { mongo, redis } });
  });

  app.use('/api', (req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  app.use('/api', createRateLimiter({ name: 'api', windowMs: 60000, max: config.security.apiRateLimitPerMinute, store }));
  app.get('/api/csrf', issueCsrfToken);

  const authLimiter = createRateLimiter({
    name: 'auth',
    windowMs: config.security.authRateLimitWindowMs,
    max: config.security.authRateLimitMax,
    message: 'Too many authentication attempts. Please try again later.',
    store,
  });

  app.use('/api/user', userRouter);
  app.use('/api/auth', createAuthRouter({ authLimiter }));
  app.use('/api/listing', listingRouter);
  app.use('/api/upload', uploadRouter);
  app.use('/api/uploads', express.static(path.join(rootDir, 'api', 'uploads')));

  // Unknown API paths must be a JSON 404, never the SPA shell.
  app.use('/api', (req, res) => res.status(404).json({ success: false, statusCode: 404, message: 'Not found.', requestId: req.id }));

  app.use(express.static(path.join(rootDir, 'client', 'dist')));
  app.get('*', (req, res, next) => {
    res.sendFile(path.join(rootDir, 'client', 'dist', 'index.html'), (error) => error && next(error));
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    let statusCode = Number.isInteger(err.statusCode) ? err.statusCode : Number.isInteger(err.status) ? err.status : 500;
    let message = err.message || 'Internal Server Error';
    if (err.type === 'entity.parse.failed') { statusCode = 400; message = 'Malformed JSON body.'; }
    else if (err.type === 'entity.too.large') { statusCode = 413; message = 'Request body too large.'; }
    else if (statusCode >= 500 && config.isProduction) message = 'Internal Server Error';
    if (statusCode >= 500) (req.log || logger).error({ err }, 'unhandled error');
    res.status(statusCode).json({ success: false, statusCode, message, requestId: req.id });
  });

  return { app, close: () => store.close() };
}
