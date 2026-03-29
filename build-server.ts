import * as esbuild from 'esbuild';

esbuild.build({
  entryPoints: ['server.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  outfile: 'dist/server.cjs',
  format: 'cjs',
  external: ['express', 'cors', 'helmet', 'express-rate-limit', '@google/genai', 'vite', 'dotenv'],
}).catch(() => process.exit(1));
