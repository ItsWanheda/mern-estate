import test from 'node:test';
import assert from 'node:assert/strict';
import { createRedisClient as createClient } from '../utils/redis.js';
import { startTestApp } from './helpers.js';

const url = process.env.TEST_REDIS_URL;
const skip = !url && 'TEST_REDIS_URL not set';

// Tests must fail fast (not retry forever) when Redis is unreachable.
const createRedisClient = (u) => {
  const client = createClient(u);
  client.options.retryStrategy = () => null;
  return client;
};

const post = (base) => fetch(`${base}/api/auth/signin`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });

test('two app instances sharing Redis enforce one combined limit', { skip }, async () => {
  const c1 = createRedisClient(url); const c2 = createRedisClient(url);
  let a; let b;
  try {
    await Promise.all([c1.connect(), c2.connect()]);
    await c1.flushdb();
    a = await startTestApp({ AUTH_RATE_LIMIT_MAX: '4' }, { redisClient: c1 });
    b = await startTestApp({ AUTH_RATE_LIMIT_MAX: '4' }, { redisClient: c2 });
    const statuses = [];
    for (let i = 0; i < 6; i += 1) statuses.push((await post(i % 2 ? a.base : b.base)).status);
    assert.deepEqual(statuses, [400, 400, 400, 400, 429, 429]);
  } finally { await a?.stop(); await b?.stop(); c1.disconnect(); c2.disconnect(); }
});

test('readiness reports Redis up, and degraded when Redis goes away', { skip }, async () => {
  const client = createRedisClient(url);
  let t;
  try {
    await client.connect();
    t = await startTestApp({}, { redisClient: client });
    assert.equal((await (await fetch(`${t.base}/api/ready`)).json()).checks.redis, 'up');
    client.disconnect();
    assert.equal((await (await fetch(`${t.base}/api/ready`)).json()).checks.redis, 'down');
    // Limiter must keep working (in-memory fallback) while Redis is down.
    const statuses = [];
    for (let i = 0; i < 3; i += 1) statuses.push((await post(t.base)).status);
    assert.deepEqual(statuses, [400, 400, 400]);
  } finally { client.disconnect(); await t?.stop(); }
});
