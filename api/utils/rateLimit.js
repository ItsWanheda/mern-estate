const LUA_HIT = `
local c = redis.call('INCR', KEYS[1])
if c == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then redis.call('PEXPIRE', KEYS[1], ARGV[1]); ttl = tonumber(ARGV[1]) end
return {c, ttl}
`;

/** Per-process fixed-window counter. Used in dev/test and as the Redis-outage fallback. */
export class MemoryStore {
  constructor() {
    this.buckets = new Map();
    this.timer = setInterval(() => this.sweep(), 60000);
    this.timer.unref();
  }

  async hit(key, windowMs) {
    const now = Date.now();
    const current = this.buckets.get(key);
    if (!current || current.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      return { count: 1, ttlMs: windowMs };
    }
    current.count += 1;
    return { count: current.count, ttlMs: current.resetAt - now };
  }

  sweep() {
    const now = Date.now();
    for (const [key, bucket] of this.buckets) if (bucket.resetAt <= now) this.buckets.delete(key);
  }

  clear() { this.buckets.clear(); }
  close() { clearInterval(this.timer); }
}

/** Shared fixed-window counter, atomic via a Lua script so it is safe across instances. */
export class RedisStore {
  constructor(client) { this.client = client; }

  async hit(key, windowMs) {
    const [count, ttl] = await this.client.eval(LUA_HIT, 1, key, String(windowMs));
    return { count: Number(count), ttlMs: Number(ttl) };
  }
}

/**
 * Redis when available; on any Redis error the request is counted in a
 * per-process store instead, so limiting degrades rather than disappearing.
 */
export class ResilientStore {
  constructor({ redisClient = null, logger = null } = {}) {
    this.primary = redisClient ? new RedisStore(redisClient) : null;
    this.fallback = new MemoryStore();
    this.logger = logger;
    this.lastWarn = 0;
  }

  async hit(key, windowMs) {
    if (this.primary) {
      try { return await this.primary.hit(key, windowMs); } catch (error) {
        const now = Date.now();
        if (now - this.lastWarn > 10000) {
          this.lastWarn = now;
          this.logger?.warn({ err: { message: error.message } }, 'rate limiter falling back to in-memory store');
        }
      }
    }
    return this.fallback.hit(key, windowMs);
  }

  close() { this.fallback.close(); }
}

/**
 * @param {object} options
 * @param {string} options.name   Namespace so different limiters never share a counter.
 * @param {{hit: Function}} options.store
 */
export const createRateLimiter = ({ name = 'default', windowMs = 900000, max = 20, message = 'Too many requests. Please try again later.', store } = {}) => {
  if (!store) throw new Error('createRateLimiter requires a store.');
  return async (req, res, next) => {
    try {
      const ip = req.ip || req.socket?.remoteAddress || 'unknown';
      const { count, ttlMs } = await store.hit(`rl:${name}:${ip}`, windowMs);
      const retryAfter = Math.max(1, Math.ceil(ttlMs / 1000));
      res.setHeader('RateLimit-Limit', String(max));
      res.setHeader('RateLimit-Remaining', String(Math.max(0, max - count)));
      res.setHeader('RateLimit-Reset', String(retryAfter));
      if (count > max) {
        res.setHeader('Retry-After', String(retryAfter));
        return res.status(429).json({ success: false, statusCode: 429, message, requestId: req.id });
      }
      return next();
    } catch (error) {
      return next(error);
    }
  };
};
