import crypto from 'node:crypto';
import { getFirebaseBucket } from './firebaseAdmin.js';

export const storeImage = async ({ buffer, contentType, extension }) => {
  const bucket = getFirebaseBucket();
  const filename = `uploads/${Date.now()}-${crypto.randomBytes(16).toString('hex')}${extension}`;
  const token = crypto.randomUUID();
  const file = bucket.file(filename);

  await file.save(buffer, {
    resumable: false,
    metadata: {
      contentType,
      cacheControl: 'public,max-age=31536000,immutable',
      metadata: { firebaseStorageDownloadTokens: token },
    },
  });

  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filename)}?alt=media&token=${token}`;
};
