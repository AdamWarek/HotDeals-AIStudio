import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { execSync } from 'child_process';

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
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      '__COMMIT_HASH__': JSON.stringify(commitHash),
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
