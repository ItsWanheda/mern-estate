import test from 'node:test';
import assert from 'node:assert/strict';
import User from '../models/user.model.js';
import { getSession } from '../controllers/auth.controller.js';

test('session hydration returns the current user without a password', async () => {
  const originalFindById = User.findById;
  User.findById = () => ({
    select: () => ({
      lean: async () => ({ _id: 'user-1', username: 'tester', email: 'test@example.com' }),
    }),
  });

  try {
    const req = { user: { id: 'user-1' } };
    const res = {
      statusCode: 0,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(value) { this.body = value; return this; },
    };
    let nextError = null;

    await getSession(req, res, (error) => { nextError = error; });

    assert.equal(nextError, null);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { _id: 'user-1', username: 'tester', email: 'test@example.com' });
    assert.equal('password' in res.body, false);
  } finally {
    User.findById = originalFindById;
  }
});

test('session hydration rejects a deleted account', async () => {
  const originalFindById = User.findById;
  User.findById = () => ({
    select: () => ({
      lean: async () => null,
    }),
  });

  try {
    const req = { user: { id: 'deleted-user' } };
    const res = { status() { return this; }, json() { return this; } };
    let nextError = null;

    await getSession(req, res, (error) => { nextError = error; });

    assert.equal(nextError?.statusCode, 401);
    assert.equal(nextError?.message, 'User account no longer exists.');
  } finally {
    User.findById = originalFindById;
  }
});
