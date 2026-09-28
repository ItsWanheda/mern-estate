import test from 'node:test';
import assert from 'node:assert/strict';
import { startTestApp } from './helpers.js';

test('GET /api/health is a dependency-free liveness check', async () => {
  const t = await startTestApp();
  try {
    const res = await fetch(`${t.base}/api/health`);
    assert.equal(res.status, 200);
    assert.equal((await res.json()).status, 'ok');
  } finally { await t.stop(); }
});

test('GET /api/ready is 503 when MongoDB is not connected', async () => {
  const t = await startTestApp();
  try {
    const res = await fetch(`${t.base}/api/ready`);
    const body = await res.json();
    assert.equal(res.status, 503);
    assert.equal(body.checks.mongo, 'down');
    assert.equal(body.checks.redis, 'disabled');
  } finally { await t.stop(); }
});

test('unknown API paths return a JSON 404, not the SPA shell', async () => {
  const t = await startTestApp();
  try {
    const res = await fetch(`${t.base}/api/does-not-exist`);
    assert.equal(res.status, 404);
    assert.match(res.headers.get('content-type'), /application\/json/);
    assert.equal((await res.json()).success, false);
  } finally { await t.stop(); }
});

test('responses carry a request id and API responses are not cacheable', async () => {
  const t = await startTestApp();
  try {
    const res = await fetch(`${t.base}/api/does-not-exist`);
    assert.match(res.headers.get('x-request-id'), /^[0-9a-f-]{36}$/);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.equal((await res.json()).requestId, res.headers.get('x-request-id'));
    const echoed = await fetch(`${t.base}/api/does-not-exist`, { headers: { 'x-request-id': 'client-req-12345' } });
    assert.equal(echoed.headers.get('x-request-id'), 'client-req-12345');
  } finally { await t.stop(); }
});

test('security headers are set and x-powered-by is hidden', async () => {
  const t = await startTestApp();
  try {
    const res = await fetch(`${t.base}/api/health`);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-frame-options'), 'DENY');
    assert.equal(res.headers.get('x-powered-by'), null);
  } finally { await t.stop(); }
});

test('malformed JSON returns a safe 400 with no parser detail', async () => {
  const t = await startTestApp();
  try {
    const res = await fetch(`${t.base}/api/auth/signin`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"email": ' });
    const body = await res.json();
    assert.equal(res.status, 400);
    assert.equal(body.message, 'Malformed JSON body.');
  } finally { await t.stop(); }
});

test('oversized bodies are rejected with 413', async () => {
  const t = await startTestApp({ BODY_LIMIT: '1kb' });
  try {
    const res = await fetch(`${t.base}/api/auth/signin`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'a@b.ir', password: 'x'.repeat(5000) }) });
    assert.equal(res.status, 413);
    assert.equal((await res.json()).message, 'Request body too large.');
  } finally { await t.stop(); }
});

test('protected routes reject unauthenticated requests', async () => {
  const t = await startTestApp();
  try {
    for (const [method, path] of [['POST', '/api/listing/create'], ['DELETE', '/api/listing/delete/507f1f77bcf86cd799439011'], ['GET', '/api/user/507f1f77bcf86cd799439011']]) {
      const res = await fetch(`${t.base}${path}`, { method });
      assert.equal(res.status, 401, `${method} ${path}`);
    }
  } finally { await t.stop(); }
});

test('CORS: no headers by default, allowlisted origins only, preflight handled', async () => {
  const none = await startTestApp();
  try {
    const res = await fetch(`${none.base}/api/health`, { headers: { origin: 'https://evil.example' } });
    assert.equal(res.headers.get('access-control-allow-origin'), null);
  } finally { await none.stop(); }

  const t = await startTestApp({ CORS_ORIGINS: 'https://app.example.ir' });
  try {
    const ok = await fetch(`${t.base}/api/health`, { headers: { origin: 'https://app.example.ir' } });
    assert.equal(ok.headers.get('access-control-allow-origin'), 'https://app.example.ir');
    assert.equal(ok.headers.get('access-control-allow-credentials'), 'true');
    const bad = await fetch(`${t.base}/api/health`, { headers: { origin: 'https://evil.example' } });
    assert.equal(bad.headers.get('access-control-allow-origin'), null);
    const pre = await fetch(`${t.base}/api/auth/signin`, { method: 'OPTIONS', headers: { origin: 'https://app.example.ir', 'access-control-request-method': 'POST' } });
    assert.equal(pre.status, 204);
  } finally { await t.stop(); }
});

test('auth limiter returns 429 with Retry-After after the configured attempts', async () => {
  const t = await startTestApp({ AUTH_RATE_LIMIT_MAX: '3' });
  try {
    const statuses = [];
    let last;
    for (let i = 0; i < 5; i += 1) {
      last = await fetch(`${t.base}/api/auth/signin`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
      statuses.push(last.status);
    }
    assert.deepEqual(statuses, [400, 400, 400, 429, 429]);
    assert.ok(Number(last.headers.get('retry-after')) >= 1);
  } finally { await t.stop(); }
});

test('X-Forwarded-For cannot be used to dodge the limiter unless a proxy is trusted', async () => {
  const t = await startTestApp({ AUTH_RATE_LIMIT_MAX: '2', TRUST_PROXY: '0' });
  try {
    const statuses = [];
    for (let i = 0; i < 4; i += 1) {
      const res = await fetch(`${t.base}/api/auth/signin`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.0.0.${i}` }, body: '{}' });
      statuses.push(res.status);
    }
    assert.deepEqual(statuses, [400, 400, 429, 429]);
  } finally { await t.stop(); }
});
