import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../config/env.js';

const prod = { NODE_ENV: 'production', MONGO: 'mongodb://u:p@db:27017/app', JWT_SECRET: 'x'.repeat(40), REDIS_URL: 'redis://redis:6379' };

test('accepts a complete production configuration', () => {
  const config = loadConfig(prod);
  assert.equal(config.isProduction, true);
  assert.equal(config.security.trustProxy, 1);
  assert.equal(config.logLevel, 'info');
});

test('reports every problem at once', () => {
  assert.throws(() => loadConfig({ NODE_ENV: 'production' }), (error) => {
    assert.match(error.message, /MONGO is required/);
    assert.match(error.message, /JWT_SECRET is required/);
    assert.match(error.message, /REDIS_URL is required/);
    return true;
  });
});

test('rejects a short JWT secret in production only', () => {
  assert.throws(() => loadConfig({ ...prod, JWT_SECRET: 'short' }), /at least 32 characters/);
  assert.doesNotThrow(() => loadConfig({ NODE_ENV: 'development', MONGO: 'mongodb://x/y', JWT_SECRET: 'short' }));
});

test('rejects wildcard and malformed CORS origins', () => {
  assert.throws(() => loadConfig({ ...prod, CORS_ORIGINS: '*' }), /must not contain/);
  assert.throws(() => loadConfig({ ...prod, CORS_ORIGINS: 'https://a.ir/path' }), /not a valid origin/);
  assert.deepEqual(loadConfig({ ...prod, CORS_ORIGINS: 'https://a.ir, https://b.ir' }).security.corsOrigins, ['https://a.ir', 'https://b.ir']);
});

test('rejects non-numeric and out-of-range numbers', () => {
  assert.throws(() => loadConfig({ ...prod, PORT: 'abc' }), /PORT must be an integer/);
  assert.throws(() => loadConfig({ ...prod, MONGO_MAX_POOL_SIZE: '0' }), /MONGO_MAX_POOL_SIZE/);
  assert.throws(() => loadConfig({ ...prod, MONGO_MIN_POOL_SIZE: '20', MONGO_MAX_POOL_SIZE: '10' }), /must not exceed/);
});

test('rejects a non-redis REDIS_URL', () => {
  assert.throws(() => loadConfig({ ...prod, REDIS_URL: 'http://x' }), /must start with redis/);
});

test('does not trust proxies by default outside production', () => {
  assert.equal(loadConfig({ NODE_ENV: 'development', MONGO: 'm', JWT_SECRET: 's' }).security.trustProxy, 0);
});
