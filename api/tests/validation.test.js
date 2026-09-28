import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSignup, validateListing } from '../utils/validation.js';

test('rejects weak signup passwords', () => {
  assert.equal(validateSignup({ username: 'tester', email: 'test@example.com', password: '123' }).valid, false);
});

test('rejects forged listing ownership fields', () => {
  const result = validateListing({
    name: 'Secure Listing',
    description: 'A sufficiently long description.',
    address: '123 Main Street',
    type: 'sale',
    regularPrice: 100000,
    discountPrice: 90000,
    bedrooms: 2,
    bathrooms: 2,
    furnished: false,
    parking: true,
    offer: true,
    imageUrls: ['https://example.com/home.jpg'],
    userRef: 'attacker-controlled-id',
  });
  assert.equal(result.valid, true);
  assert.equal('userRef' in result.value, false);
});

test('rejects more than six images', () => {
  const result = validateListing({
    name: 'Secure Listing',
    description: 'A sufficiently long description.',
    address: '123 Main Street',
    type: 'sale',
    regularPrice: 100000,
    discountPrice: 90000,
    bedrooms: 2,
    bathrooms: 2,
    furnished: false,
    parking: true,
    offer: false,
    imageUrls: Array.from({ length: 7 }, (_, i) => 'https://example.com/' + i + '.jpg'),
  });
  assert.equal(result.valid, false);
});