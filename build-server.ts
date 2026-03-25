import * as esbuild from 'esbuild';

esbuild.build({
  entryPoints: ['server.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  outfile: 'dist/server.cjs',
  format: 'cjs',
  external: ['express', 'cors', '@google/genai', 'vite', 'dotenv', 'puppeteer', 'puppeteer-extra', 'puppeteer-extra-plugin-stealth', 'axios', 'cheerio'],
}).catch(() => process.exit(1));
