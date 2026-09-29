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

export const getStoragePathFromUrl = (value) => {
  if (typeof value !== 'string') return null;

  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'firebasestorage.googleapis.com') return null;

    const match = url.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
    if (!match) return null;

    const bucket = decodeURIComponent(match[1]);
    const bucketName = getFirebaseBucket().name;
    if (bucket !== bucketName) return null;

    const objectPath = decodeURIComponent(match[2]);
    return objectPath.startsWith('uploads/') ? objectPath : null;
  } catch {
    return null;
  }
};

export const deleteStoredImage = async (url) => {
  const objectPath = getStoragePathFromUrl(url);
  if (!objectPath) return false;

  await getFirebaseBucket().file(objectPath).delete({ ignoreNotFound: true });
  return true;
};

export const deleteStoredImages = async (urls = []) => {
  const uniqueUrls = [...new Set(urls.filter((url) => typeof url === 'string'))];
  const results = await Promise.allSettled(uniqueUrls.map((url) => deleteStoredImage(url)));
  return results.filter((result) => result.status === 'rejected').map((result) => result.reason);
};
