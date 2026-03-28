/**
 * Fetches Nike / Adidas marketing mail via Gmail API, parses HTML and/or plain text, writes
 * public/data/nike_promos.json and public/data/adidas_promos.json for scrape.js to merge.
 *
 * Typical flow: newsletters arrive at wiruje2@gmail.com as Thunderbird forwards from
 * pusto@poczta.fm (From header is poczta.fm; body is often text/plain with click.em.nike.com /
 * click.link.adidas.com URLs). Default Gmail queries target that sender + brand keywords.
 *
 * Required env (when not skipping): GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN
 * Optional: NEWSLETTER_QUERY_NIKE, NEWSLETTER_QUERY_ADIDAS (Gmail search q)
 *
 * Output is not merged into deals.json by default: run scrape with MERGE_NEWSLETTER_DEALS=1 when ready.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import 'dotenv/config';
import { buildNormalizedDealsFromEmailParts } from './lib/newsletter-deals.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_QUERY_NIKE =
  process.env.NEWSLETTER_QUERY_NIKE ||
  'from:pusto@poczta.fm newer_than:30d (nike OR lego OR "em.nike" OR "nike.com")';
const DEFAULT_QUERY_ADIDAS =
  process.env.NEWSLETTER_QUERY_ADIDAS ||
  'from:pusto@poczta.fm newer_than:30d (adidas OR adiclub OR "link.adidas" OR "adidas.com")';

function decodeBase64Url(data) {
  if (!data) return '';
  const b64 = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(b64, 'base64').toString('utf8');
}

/** @param {object} part Gmail API message payload or nested part */
function extractHtmlFromPayload(part) {
  if (!part) return '';
  if (part.mimeType === 'text/html' && part.body?.data) {
    return decodeBase64Url(part.body.data);
  }
  if (part.parts?.length) {
    for (const p of part.parts) {
      const html = extractHtmlFromPayload(p);
      if (html) return html;
    }
  }
  return '';
}

/** @param {object} part Gmail API message payload or nested part */
function extractPlainTextFromPayload(part) {
  if (!part) return '';
  if (part.mimeType === 'text/plain' && part.body?.data) {
    return decodeBase64Url(part.body.data);
  }
  if (part.parts?.length) {
    for (const p of part.parts) {
      const text = extractPlainTextFromPayload(p);
      if (text) return text;
    }
  }
  return '';
}

/** @param {object} msg Gmail API message */
function getSubject(msg) {
  const headers = msg.payload?.headers || [];
  const subj = headers.find((h) => (h.name || '').toLowerCase() === 'subject');
  return subj?.value || '';
}

function dedupeByProductUrl(deals) {
  const map = new Map();
  for (const d of deals) {
    const u = (d.product_url || d.url || '').split('?')[0];
    if (!u) continue;
    if (!map.has(u)) map.set(u, d);
  }
  return [...map.values()];
}

async function fetchDealsForBrand(gmail, brandKey, query, scrapedAt, maxMessages) {
  const list = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults: maxMessages,
  });

  const ids = list.data.messages || [];
  const all = [];

  for (const { id } of ids) {
    if (!id) continue;
    const full = await gmail.users.messages.get({
      userId: 'me',
      id,
      format: 'full',
    });
    const html = extractHtmlFromPayload(full.data.payload);
    const plain = extractPlainTextFromPayload(full.data.payload);
    const subject = getSubject(full.data);
    if (!html && !plain) continue;
    const rows = buildNormalizedDealsFromEmailParts(
      { html, plain, subject },
      brandKey,
      scrapedAt
    );
    all.push(...rows);
  }

  return dedupeByProductUrl(all);
}

async function main() {
  const skip =
    process.env.NEWSLETTER_INGEST_SKIP === '1' ||
    !process.env.GMAIL_REFRESH_TOKEN ||
    !process.env.GMAIL_CLIENT_ID ||
    !process.env.GMAIL_CLIENT_SECRET;

  if (skip) {
    if (process.env.NEWSLETTER_INGEST_SKIP === '1') {
      console.log('[ingest-newsletters] Skip: NEWSLETTER_INGEST_SKIP=1');
    } else {
      console.log(
        '[ingest-newsletters] Skip: set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN (see .env.example).'
      );
    }
    process.exit(0);
  }

  const oauth2 = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    'http://127.0.0.1'
  );
  oauth2.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });

  const gmail = google.gmail({ version: 'v1', auth: oauth2 });
  const scrapedAt = new Date().toISOString();
  const maxMessages = Math.min(
    25,
    Math.max(1, parseInt(process.env.NEWSLETTER_MAX_MESSAGES || '12', 10) || 12)
  );

  const dataDir = path.join(__dirname, '../public/data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const brands = [
    { key: 'nike', file: 'nike_promos.json', query: DEFAULT_QUERY_NIKE },
    { key: 'adidas', file: 'adidas_promos.json', query: DEFAULT_QUERY_ADIDAS },
  ];

  for (const { key, file, query } of brands) {
    const t0 = Date.now();
    let deals = [];
    let errMsg = '';
    try {
      deals = await fetchDealsForBrand(gmail, key, query, scrapedAt, maxMessages);
    } catch (e) {
      errMsg = e?.message || String(e);
      console.error(`[ingest-newsletters] Gmail error (${key}):`, errMsg);
    }

    const outPath = path.join(dataDir, file);
    if (deals.length > 0) {
      fs.writeFileSync(outPath, JSON.stringify(deals, null, 2));
      console.log(
        `[ingest-newsletters] Wrote ${deals.length} ${key} deal(s) to public/data/${file} (${Date.now() - t0}ms)`
      );
    } else {
      console.log(
        `[ingest-newsletters] No new ${key} deals parsed (query=${JSON.stringify(query)}); left existing ${file} unchanged.`
      );
    }
  }
}

main().catch((e) => {
  console.error('[ingest-newsletters] Fatal:', e);
  process.exit(1);
});
