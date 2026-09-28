import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeRegex } from '../controllers/listing.controller.js';

test('escapeRegex neutralises every regex metacharacter, including braces', () => {
  const input = 'a{2,5}.*+?^${}()|[]\\';
  const re = new RegExp(`^${escapeRegex(input)}$`);
  assert.ok(re.test(input));
  assert.ok(!re.test('aa'));
});

test('escaped input cannot express a catastrophic pattern', () => {
  const re = new RegExp(escapeRegex('(a+)+$'));
  assert.ok(!re.test('aaaaaaaaaaaaaaaaaaaaaaaaaaaa!'));
});
