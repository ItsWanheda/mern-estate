import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { signAccessToken } from '../utils/security.js';
import { verifyToken } from '../utils/verifyUser.js';

test('verifyToken accepts a valid bearer JWT', () => {
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'test-secret';

  try {
    const token = signAccessToken('user-123');
    const req = {
      get(name) {
        return name === 'Authorization' ? `Bearer ${token}` : undefined;
      },
    };
    let nextError = null;

    verifyToken(req, {}, (error) => { nextError = error; });

    assert.equal(nextError, undefined);
    assert.equal(req.user.id, 'user-123');
  } finally {
    process.env.JWT_SECRET = originalSecret;
  }
});

test('verifyToken rejects missing or malformed bearer authentication', () => {
  const requests = [
    { get: () => undefined },
    { get: () => 'Basic abc123' },
    { get: () => 'Bearer' },
    { get: () => 'Bearer token extra' },
  ];

  for (const req of requests) {
    let nextError = null;
    verifyToken(req, {}, (error) => { nextError = error; });
    assert.equal(nextError?.statusCode, 401);
    assert.equal(nextError?.message, 'Unauthorized');
  }
});

test('verifyToken rejects an invalid bearer JWT', () => {
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'test-secret';

  try {
    const token = jwt.sign({ id: 'user-123' }, 'different-secret');
    const req = { get: () => `Bearer ${token}` };
    let nextError = null;

    verifyToken(req, {}, (error) => { nextError = error; });

    assert.equal(nextError?.statusCode, 401);
    assert.equal(nextError?.message, 'Invalid or expired authentication token.');
  } finally {
    process.env.JWT_SECRET = originalSecret;
  }
});
