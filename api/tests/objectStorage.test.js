import test from 'node:test';
import assert from 'node:assert/strict';
import { getStoragePathFromUrl, deleteStoredImages } from '../utils/objectStorage.js';

test('ignores non-Firebase image URLs during storage cleanup', async () => {
  assert.equal(getStoragePathFromUrl('https://example.com/image.jpg'), null);
  assert.equal(getStoragePathFromUrl('/api/uploads/image.jpg'), null);
  assert.deepEqual(await deleteStoredImages(['https://example.com/image.jpg']), []);
});

test('ignores Firebase Storage objects outside the uploads namespace', () => {
  process.env.FIREBASE_PROJECT_ID ||= 'test-project';
  process.env.FIREBASE_STORAGE_BUCKET ||= 'test-project.firebasestorage.app';

  const url = 'https://firebasestorage.googleapis.com/v0/b/test-project.firebasestorage.app/o/private%2Fimage.jpg?alt=media';
  assert.equal(getStoragePathFromUrl(url), null);
});
