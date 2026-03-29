import { initializeApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const FIREBASE_OPTION_KEYS = [
  'apiKey',
  'authDomain',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId',
] as const;

function readFirebaseOptionsFromViteEnv(): FirebaseOptions {
  // Use only `import.meta.env.VITE_*` per key — never `const env = import.meta.env`
  // or Vite embeds every VITE_ variable from .env into the client bundle.
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY?.trim() ?? '';
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim() ?? '';
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim() ?? '';
  const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim() ?? '';
  const messagingSenderId =
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim() ?? '';
  const appId = import.meta.env.VITE_FIREBASE_APP_ID?.trim() ?? '';
  const firestoreId = import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID?.trim() ?? '';

  const missing: string[] = [];
  if (!apiKey) missing.push('VITE_FIREBASE_API_KEY');
  if (!authDomain) missing.push('VITE_FIREBASE_AUTH_DOMAIN');
  if (!projectId) missing.push('VITE_FIREBASE_PROJECT_ID');
  if (!storageBucket) missing.push('VITE_FIREBASE_STORAGE_BUCKET');
  if (!messagingSenderId) missing.push('VITE_FIREBASE_MESSAGING_SENDER_ID');
  if (!appId) missing.push('VITE_FIREBASE_APP_ID');
  if (!firestoreId) missing.push('VITE_FIREBASE_FIRESTORE_DATABASE_ID');

  if (missing.length > 0) {
    throw new Error(
      `Missing Firebase environment variables: ${missing.join(', ')}. Copy .env.example to .env (local) or use production mode (project id + Hosting init.json).`,
    );
  }

  const options: FirebaseOptions = {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
  };

  const measurementId = import.meta.env.VITE_FIREBASE_MEASUREMENT_ID?.trim();
  if (measurementId) {
    options.measurementId = measurementId;
  }

  return options;
}

function assertRemoteFirebaseOptions(
  data: unknown,
): asserts data is FirebaseOptions {
  if (!data || typeof data !== 'object') {
    throw new Error('Firebase config response was not a JSON object.');
  }
  const o = data as Record<string, unknown>;
  for (const key of FIREBASE_OPTION_KEYS) {
    const v = o[key];
    if (typeof v !== 'string' || !v.trim()) {
      throw new Error(
        `Firebase config from init.json is missing or invalid field: ${key}`,
      );
    }
  }
}

/**
 * Production: load web SDK config from Firebase Hosting reserved URL so the
 * apiKey string is not embedded in static assets scanned by GitHub.
 * Requires at least one Firebase Hosting deploy for this project.
 */
async function fetchFirebaseOptionsFromHosting(): Promise<FirebaseOptions> {
  const explicit = import.meta.env.VITE_FIREBASE_INIT_JSON_URL?.trim();
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim();
  const url =
    explicit ||
    (projectId
      ? `https://${projectId}.firebaseapp.com/__/firebase/init.json`
      : '');

  if (!url) {
    throw new Error(
      'Production Firebase config: set VITE_FIREBASE_PROJECT_ID (or VITE_FIREBASE_INIT_JSON_URL).',
    );
  }

  const res = await fetch(url, { credentials: 'omit' });
  if (!res.ok) {
    throw new Error(
      `Failed to load Firebase config (${res.status}). Deploy Firebase Hosting for this project at least once so /__/firebase/init.json exists. URL: ${url}`,
    );
  }

  const data: unknown = await res.json();
  assertRemoteFirebaseOptions(data);
  return data;
}

async function resolveFirebaseOptions(): Promise<FirebaseOptions> {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY?.trim();
  if (apiKey) {
    return readFirebaseOptionsFromViteEnv();
  }
  return fetchFirebaseOptionsFromHosting();
}

const firebaseOptions = await resolveFirebaseOptions();
const firestoreDatabaseId =
  import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID?.trim() ?? '';

if (!firestoreDatabaseId) {
  throw new Error(
    'Missing VITE_FIREBASE_FIRESTORE_DATABASE_ID (required for named Firestore database).',
  );
}

const app = initializeApp(firebaseOptions);
export const auth = getAuth(app);
export const db = getFirestore(app, firestoreDatabaseId);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export default app;
