/// <reference types="vite/client" />

/** Add e.g. VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY when you connect Supabase. */
interface ImportMetaEnv {
  // readonly VITE_SUPABASE_URL?: string;
  // readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
