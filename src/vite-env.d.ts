/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Local dev: full inline config. Omit in CI so init.json is used instead. */
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  /** Required in all modes (not an API key; safe in the bundle). */
  readonly VITE_FIREBASE_FIRESTORE_DATABASE_ID?: string;
  readonly VITE_FIREBASE_MEASUREMENT_ID?: string;
  /** Optional override for init.json URL (default: derived from project id). */
  readonly VITE_FIREBASE_INIT_JSON_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
