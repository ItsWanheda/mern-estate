import test from 'node:test';
import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import { createLogger, requestIdFrom } from '../utils/logger.js';

const capture = () => {
  const lines = [];
  const destination = new Writable({ write(chunk, _enc, cb) { lines.push(chunk.toString()); cb(); } });
  return { lines, destination };
};

test('redacts credentials, tokens, OTPs and auth headers', () => {
  const { lines, destination } = capture();
  const logger = createLogger({ level: 'info', destination });
  logger.info({
    body: { password: 'hunter2', otp: '123456', refreshToken: 'rt-secret', apiKey: 'k-secret', token: 't-secret' },
    req: { headers: { authorization: 'Bearer abc', cookie: 'access_token=jwt-secret' } },
  }, 'test');
  const out = lines.join('');
  for (const secret of ['hunter2', '123456', 'rt-secret', 'k-secret', 't-secret', 'Bearer abc', 'jwt-secret']) {
    assert.ok(!out.includes(secret), `${secret} leaked into logs`);
  }
  assert.match(out, /\[REDACTED\]/);
});

test('accepts a well-formed incoming request id and replaces unsafe ones', () => {
  assert.equal(requestIdFrom({ headers: { 'x-request-id': 'abc12345-def' } }), 'abc12345-def');
  const replaced = requestIdFrom({ headers: { 'x-request-id': 'bad id\r\nSet-Cookie: x=1' } });
  assert.match(replaced, /^[0-9a-f-]{36}$/);
  assert.match(requestIdFrom({ headers: {} }), /^[0-9a-f-]{36}$/);
});
