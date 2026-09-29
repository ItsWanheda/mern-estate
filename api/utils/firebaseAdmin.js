import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';

let firebaseApp;

const getFirebaseApp = () => {
  if (firebaseApp) return firebaseApp;
  if (getApps().length) {
    firebaseApp = getApps()[0];
    return firebaseApp;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;

  if (!projectId) throw new Error('FIREBASE_PROJECT_ID is required.');

  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const credential = privateKey && clientEmail
    ? cert({ projectId, clientEmail, privateKey })
    : applicationDefault();

  firebaseApp = initializeApp({ credential, projectId, storageBucket });
  return firebaseApp;
};

export const getFirebaseAuth = () => getAuth(getFirebaseApp());
export const getFirebaseBucket = () => {
  const bucket = getStorage(getFirebaseApp()).bucket();
  if (!bucket.name) throw new Error('FIREBASE_STORAGE_BUCKET is required.');
  return bucket;
};
