import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { encodeCursor, decodeCursor, escapeRegex } from '../controllers/listing.controller.js';

process.env.JWT_SECRET ||= 'test-secret-for-pagination-cursor-signing';

test('signs and validates listing cursors', () => {
  const id = new mongoose.Types.ObjectId().toString();
  const cursor = encodeCursor({
    value: new Date('2026-09-29T12:00:00.000Z').toISOString(),
    id,
    sort: 'createdAt',
    order: -1,
  });

  assert.equal(cursor.split('.').length, 3);
  assert.deepEqual(decodeCursor(cursor, 'createdAt', -1), {
    value: new Date('2026-09-29T12:00:00.000Z'),
    id,
  });
});

test('rejects tampered, mismatched, and malformed cursors', () => {
  const id = new mongoose.Types.ObjectId().toString();
  const cursor = encodeCursor({ value: 100000, id, sort: 'regularPrice', order: 1 });
  const [body, signature] = cursor.split('.');

  assert.equal(decodeCursor(`${body}.${signature.slice(0, -1)}x`, 'regularPrice', 1), null);
  assert.equal(decodeCursor(cursor, 'regularPrice', -1), null);
  assert.equal(decodeCursor(cursor, 'createdAt', 1), null);
  assert.equal(decodeCursor('not-a-cursor', 'regularPrice', 1), null);
});

test('enforces cursor value types', () => {
  const id = new mongoose.Types.ObjectId().toString();

  const numericCursor = encodeCursor({ value: '100000', id, sort: 'regularPrice', order: 1 });
  assert.equal(decodeCursor(numericCursor, 'regularPrice', 1), null);

  const nameCursor = encodeCursor({ value: 123, id, sort: 'name', order: -1 });
  assert.equal(decodeCursor(nameCursor, 'name', -1), null);
});

test('escapes regex metacharacters for substring search', () => {
  assert.equal(escapeRegex('house.*(west)'), 'house\\.\\*\\(west\\)');
});
