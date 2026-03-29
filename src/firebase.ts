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
      `Missing Firebase environment variables: ${missing.join(', ')}. Copy .env.example to .env (local), or set these in GitHub Actions for Pages (init.json cannot be fetched cross-origin from github.io).`,
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

function isFirebaseHostingHostname(hostname: string): boolean {
  return hostname.endsWith('.web.app') || hostname.endsWith('.firebaseapp.com');
}

/**
 * Same-origin only: Firebase serves this on *.web.app / *.firebaseapp.com.
 * Cross-origin fetch from github.io is blocked (no CORS on init.json).
 */
async function fetchFirebaseOptionsSameOrigin(): Promise<FirebaseOptions | null> {
  if (typeof window === 'undefined') {
    return null;
  }
  if (!isFirebaseHostingHostname(window.location.hostname)) {
    return null;
  }
  const res = await fetch('/__/firebase/init.json', { credentials: 'omit' });
  if (!res.ok) {
    return null;
  }
  const data: unknown = await res.json();
  assertRemoteFirebaseOptions(data);
  return data;
}

/**
 * Optional: load config from another origin (e.g. custom CORS proxy).
 * Default Firebase Hosting URLs do not send Access-Control-Allow-Origin, so
 * this fails in the browser for GitHub Pages — use VITE_FIREBASE_* in CI instead.
 */
async function fetchFirebaseOptionsFromRemoteUrl(): Promise<FirebaseOptions> {
  const explicit = import.meta.env.VITE_FIREBASE_INIT_JSON_URL?.trim();
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim();
  const url =
    explicit ||
    (projectId
      ? `https://${projectId}.firebaseapp.com/__/firebase/init.json`
      : '');

  if (!url) {
    throw new Error(
      'Set VITE_FIREBASE_API_KEY (GitHub Pages), or host on Firebase Hosting, or set VITE_FIREBASE_INIT_JSON_URL / VITE_FIREBASE_PROJECT_ID for a CORS-enabled config URL.',
    );
  }

  try {
    const res = await fetch(url, { credentials: 'omit' });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data: unknown = await res.json();
    assertRemoteFirebaseOptions(data);
    return data;
  } catch (e) {
    throw new Error(
      `Cannot load Firebase config from ${url}. Cross-origin init.json is blocked by CORS in browsers (typical on GitHub Pages). Fix: add VITE_FIREBASE_API_KEY and related secrets to GitHub Actions, or host the app on Firebase Hosting. Underlying: ${String(e)}`,
      { cause: e },
    );
  }
}

async function resolveFirebaseOptions(): Promise<FirebaseOptions> {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY?.trim();
  if (apiKey) {
    return readFirebaseOptionsFromViteEnv();
  }

  const sameOrigin = await fetchFirebaseOptionsSameOrigin();
  if (sameOrigin) {
    return sameOrigin;
  }

  return fetchFirebaseOptionsFromRemoteUrl();
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
