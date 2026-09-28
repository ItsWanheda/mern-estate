import test from 'node:test';
import assert from 'node:assert/strict';
import Redis from 'ioredis';
import { MemoryStore, RedisStore, ResilientStore } from '../utils/rateLimit.js';

test('MemoryStore counts within a window and resets after it', async () => {
  const store = new MemoryStore();
  try {
    assert.equal((await store.hit('k', 50)).count, 1);
    assert.equal((await store.hit('k', 50)).count, 2);
    await new Promise((r) => setTimeout(r, 70));
    assert.equal((await store.hit('k', 50)).count, 1);
  } finally { store.close(); }
});

test('MemoryStore keeps keys independent', async () => {
  const store = new MemoryStore();
  try {
    await store.hit('a', 1000);
    assert.equal((await store.hit('b', 1000)).count, 1);
  } finally { store.close(); }
});

test('ResilientStore falls back to memory when Redis throws, and still limits', async () => {
  const broken = { eval: async () => { throw new Error('ECONNREFUSED'); } };
  const store = new ResilientStore({ redisClient: broken });
  try {
    assert.equal((await store.hit('k', 1000)).count, 1);
    assert.equal((await store.hit('k', 1000)).count, 2);
  } finally { store.close(); }
});

const redisUrl = process.env.TEST_REDIS_URL;
test('RedisStore is atomic and shared between clients', { skip: !redisUrl && 'TEST_REDIS_URL not set' }, async () => {
  const opts = { retryStrategy: () => null, maxRetriesPerRequest: 1, connectTimeout: 2000 };
  const a = new Redis(redisUrl, opts); const b = new Redis(redisUrl, opts);
  a.on('error', () => {}); b.on('error', () => {});
  const key = `rl:test:${Date.now()}`;
  try {
    const sa = new RedisStore(a); const sb = new RedisStore(b);
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) => (i % 2 ? sa : sb).hit(key, 5000)));
    assert.deepEqual(results.map((r) => r.count).sort((x, y) => x - y), Array.from({ length: 20 }, (_, i) => i + 1));
    assert.ok(results[0].ttlMs > 0 && results[0].ttlMs <= 5000);
  } finally { await a.del(key); a.disconnect(); b.disconnect(); }
});
