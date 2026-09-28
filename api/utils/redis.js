import Redis from 'ioredis';

/**
 * Create a Redis client that fails fast instead of queueing commands while
 * disconnected, so callers can degrade gracefully.
 */
export function createRedisClient(url, logger) {
  if (!url) return null;
  const client = new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 2000,
    commandTimeout: 1500,
    retryStrategy: (attempt) => Math.min(attempt * 500, 5000),
  });
  let lastErrorLog = 0;
  client.on('error', (error) => {
    const now = Date.now();
    if (now - lastErrorLog > 10000) {
      lastErrorLog = now;
      logger?.warn({ err: { message: error.message, code: error.code } }, 'redis error');
    }
  });
  return client;
}

export async function pingRedis(client, timeoutMs = 1000) {
  if (!client) return 'disabled';
  try {
    const reply = await Promise.race([
      client.ping(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs).unref()),
    ]);
    return reply === 'PONG' ? 'up' : 'down';
  } catch {
    return 'down';
  }
}
