import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {defineConfig, loadEnv} from 'vite';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appVersion = JSON.parse(
  readFileSync(path.join(__dirname, 'package.json'), 'utf-8'),
) as { version: string };

let commitHash = 'dev';
try {
  if (process.env.GITHUB_SHA) {
    commitHash = process.env.GITHUB_SHA.substring(0, 7);
  } else {
    commitHash = execSync('git rev-parse --short HEAD').toString().trim();
  }
} catch (e) {
  console.warn('Could not get git commit hash, falling back to "dev"');
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    base: mode === 'production' ? '/HotDeals-AIStudio/' : '/',
    build: {
      // Required for top-level await in firebase.ts (runtime fetch of init.json).
      target: 'es2022',
    },
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      '__COMMIT_HASH__': JSON.stringify(commitHash),
      '__APP_VERSION__': JSON.stringify(appVersion.version),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
