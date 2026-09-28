import { loadConfig } from './config/env.js';
import mongoose from 'mongoose';
import { createApp } from './app.js';
import { createLogger } from './utils/logger.js';
import { createRedisClient } from './utils/redis.js';

let config;
try {
  config = loadConfig();
} catch (error) {
  process.stderr.write(error.message + '\n');
  process.exit(1);
}
const logger = createLogger({ level: config.logLevel });
const redisClient = createRedisClient(config.redis.url, logger);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function connectMongo() {
  const { uri, connectAttempts, ...options } = config.mongo;
  for (let attempt = 1; attempt <= connectAttempts; attempt += 1) {
    try {
      await mongoose.connect(uri, options);
      logger.info('connected to MongoDB');
      return;
    } catch (error) {
      logger.error({ err: { message: error.message }, attempt, connectAttempts }, 'MongoDB connection failed');
      if (attempt === connectAttempts) throw error;
      await sleep(Math.min(attempt * 1000, 5000));
    }
  }
}

async function main() {
  await connectMongo();
  if (redisClient) redisClient.connect().catch(() => { /* reported by the client error handler; limiter falls back */ });

  const { app, close } = createApp({ config, logger, redisClient });
  const server = app.listen(config.port, () => logger.info({ port: config.port }, 'server listening'));
  server.requestTimeout = config.server.requestTimeoutMs;
  server.headersTimeout = config.server.requestTimeoutMs + 5000;
  server.keepAliveTimeout = 65000;

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'shutting down');
    const force = setTimeout(() => { logger.error('forced shutdown after timeout'); process.exit(1); }, config.server.shutdownTimeoutMs);
    force.unref();
    server.close(async () => {
      close();
      await mongoose.connection.close().catch(() => {});
      if (redisClient) await redisClient.quit().catch(() => {});
      process.exit(0);
    });
    server.closeIdleConnections();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error) => {
  logger.fatal({ err: { message: error.message } }, 'startup failed');
  process.exit(1);
});
