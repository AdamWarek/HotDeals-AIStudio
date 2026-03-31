import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

// Optional env:
//   SCRAPER_STRICT=1 — process.exit(1) if any SCRAPER_REQUIRED scraper returns 0 deals or throws.
//   SCRAPER_REQUIRED=bershka,hebe,hm — comma-separated scraper ids (see scrapers[] below).
//   MERGE_NEWSLETTER_DEALS=1 — append public/data/nike_promos.json & adidas_promos.json after scrapers (off by default; run npm run ingest-newsletters separately to generate those files).

// Import specialized scrapers
import { scrapePullAndBear } from './scrapers/pullandbear.js';
import { scrapeStradivarius } from './scrapers/stradivarius.js';
import { scrapeBershka } from './scrapers/bershka.js';
import { scrapeHM } from './scrapers/hm.js';
import { scrapeRossmann } from './scrapers/rossmann.js';
import { scrapeHebe } from './scrapers/hebe.js';
import { scrapeDouglas } from './scrapers/douglas.js';
import { scrapeSephora } from './scrapers/sephora.js';
import { extractParentId } from './lib/extract-parent-id.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Parse "129,99 PLN", "129.99", or number → float */
function parsePlnAmount(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const t = String(value).replace(/[^\d,.]/g, '').replace(',', '.');
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * Normalize one raw deal to merged schema with correct original/sale/discount when possible.
 */
function normalizeDeal(deal, scraper, scrapedAt) {
  const discountStr = deal.discount || '';
  let discountPct = parseInt(discountStr.replace(/[^\d]/g, ''), 10) || 0;

  let saleVal =
    parsePlnAmount(deal.sale_price) ??
    parsePlnAmount(deal.price) ??
    parsePlnAmount(deal.salePrice) ??
    0;

  let originalVal =
    parsePlnAmount(deal.original_price) ??
    parsePlnAmount(deal.originalPrice) ??
    parsePlnAmount(deal.regular_price) ??
    null;

  if (originalVal != null && saleVal > 0 && originalVal < saleVal) {
    const tmp = originalVal;
    originalVal = saleVal;
    saleVal = tmp;
  }

  if (originalVal == null && discountPct > 0 && discountPct < 100 && saleVal > 0) {
    originalVal = saleVal / (1 - discountPct / 100);
  }

  if (
    originalVal != null &&
    saleVal > 0 &&
    originalVal > saleVal &&
    (discountPct === 0 || !discountStr)
  ) {
    discountPct = Math.round(((originalVal - saleVal) / originalVal) * 100);
  }

  if (originalVal == null && saleVal > 0) {
    originalVal = saleVal;
  }

  if (!(saleVal > 0)) {
    return null;
  }
  if (originalVal == null || !Number.isFinite(originalVal)) {
    originalVal = saleVal;
  }

  let confidence = deal.confidence_score;
  if (confidence == null) confidence = 1.0;
  if (deal.scrape_fallback === true) confidence = Math.min(confidence, 0.75);

  const productUrl = deal.url || deal.product_url || '';
  const name = deal.title || deal.name || 'Bez nazwy';

  return {
    site: scraper.id,
    scraped_at: scrapedAt,
    name,
    original_price: `${originalVal.toFixed(2)} PLN`,
    sale_price: `${saleVal.toFixed(2)} PLN`,
    discount_pct: discountPct,
    image_url: deal.image || deal.image_url || '',
    product_url: productUrl,
    category: deal.category || 'Inne',
    in_stock: deal.in_stock !== false,

    title: name,
    brand: scraper.name,
    discount: deal.discount || (discountPct > 0 ? `-${discountPct}%` : null),
    price: String(saleVal),
    currency: deal.currency || 'PLN',
    url: productUrl,
    image: deal.image || deal.image_url,
    description: deal.description || `Okazja z ${scraper.name}`,
    valid_until: deal.valid_until || null,
    tags: deal.tags || [deal.category || 'sale'],
    confidence_score: confidence,
    source_type: deal.source_type || 'dynamic_scrape',
    source_name: deal.source_name || scraper.name,
  };
}

function logScrapeSummary(scraperId, count, ms, errorMessage) {
  const err = errorMessage ? JSON.stringify(errorMessage) : '';
  console.log(
    `[scrape-summary] site=${scraperId} count=${count} durationMs=${ms}${err ? ` error=${err}` : ''}`
  );
}

function dedupeDeals(deals) {
  const seen = new Map();
  for (const d of deals) {
    const url = d.product_url || d.url || '';
    if (!url && !d.name) continue;

    const key = extractParentId(d.site, url, d.name, d.image_url || d.image);
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, d);
      continue;
    }

    const existingPrice = parsePlnAmount(existing.sale_price) ?? parsePlnAmount(existing.price) ?? Infinity;
    const candidatePrice = parsePlnAmount(d.sale_price) ?? parsePlnAmount(d.price) ?? Infinity;
    const existingUrl = existing.product_url || existing.url || '';
    const candidateUrl = d.product_url || d.url || '';
    const isBetter = candidatePrice < existingPrice
      || (candidatePrice === existingPrice && candidateUrl && !existingUrl);
    if (isBetter) {
      seen.set(key, d);
    }
  }
  return Array.from(seen.values());
}

async function scrapeDeals() {
  console.log(`Starting the unified scraping process based on the Implementation Plan...`);

  const allDeals = [];
  const dataDir = path.join(__dirname, '../public/data');

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const scrapedAt = new Date().toISOString();
  const summaryRows = [];
  let strictFailed = false;

  const requiredIds = (process.env.SCRAPER_REQUIRED || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const scrapers = [
    { name: 'Bershka', id: 'bershka', fn: scrapeBershka },
    { name: 'Pull&Bear', id: 'pullandbear', fn: scrapePullAndBear },
    { name: 'Stradivarius', id: 'stradivarius', fn: scrapeStradivarius },
    { name: 'H&M', id: 'hm', fn: scrapeHM },
    { name: 'Rossmann', id: 'rossmann', fn: scrapeRossmann },
    { name: 'Hebe', id: 'hebe', fn: scrapeHebe },
    { name: 'Douglas', id: 'douglas', fn: scrapeDouglas },
    { name: 'Sephora', id: 'sephora', fn: scrapeSephora },
  ];

  for (const scraper of scrapers) {
    const t0 = Date.now();
    let errMsg = '';
    let resultCount = 0;
    try {
      console.log(`\n--- Running Scraper: ${scraper.name} ---`);
      const rawDeals = await scraper.fn();

      if (rawDeals && rawDeals.length > 0) {
        const normalizedDeals = rawDeals
          .map((deal) => normalizeDeal(deal, scraper, scrapedAt))
          .filter(Boolean);

        resultCount = normalizedDeals.length;

        const sitePath = path.join(dataDir, `${scraper.id}_promos.json`);
        fs.writeFileSync(sitePath, JSON.stringify(normalizedDeals, null, 2));
        console.log(`Saved ${normalizedDeals.length} deals to ${scraper.id}_promos.json`);

        allDeals.push(...normalizedDeals);
      } else {
        console.log(`No deals returned for ${scraper.name}.`);
        if (requiredIds.includes(scraper.id)) {
          console.error(`[scrape-strict] REQUIRED scraper "${scraper.id}" returned 0 deals.`);
          strictFailed = true;
        }
      }

      if (resultCount === 0) {
        console.warn(`[scrape-warning] Zero normalized results for ${scraper.id}`);
      }
    } catch (error) {
      errMsg = error?.message || String(error);
      console.error(`Failed to scrape ${scraper.name}:`, errMsg);
      if (requiredIds.includes(scraper.id)) strictFailed = true;
    } finally {
      const ms = Date.now() - t0;
      logScrapeSummary(scraper.id, resultCount, ms, errMsg);
      summaryRows.push({ id: scraper.id, count: resultCount, ms, error: errMsg });
    }

    console.log(`Waiting 4 seconds before next scraper...`);
    await new Promise((r) => setTimeout(r, 4000));
  }

  console.log('\n--- Urban Outfitters ---');
  console.log('Skipping Urban Outfitters (disabled temporarily). Re-enable in scrape.js scrapers[].');

  console.log('\n--- Adidas & Nike ---');
  console.log('Skipping Adidas.pl (T4 Akamai) and Nike.com/pl (ToS). No site scrapers for these brands.');

  if (process.env.MERGE_NEWSLETTER_DEALS === '1') {
    console.log(
      'MERGE_NEWSLETTER_DEALS=1: merging public/data/nike_promos.json & adidas_promos.json if present (from npm run ingest-newsletters).'
    );
    for (const id of ['nike', 'adidas']) {
      const promoPath = path.join(dataDir, `${id}_promos.json`);
      if (!fs.existsSync(promoPath)) continue;
      try {
        const parsed = JSON.parse(fs.readFileSync(promoPath, 'utf8'));
        if (Array.isArray(parsed) && parsed.length > 0) {
          allDeals.push(...parsed);
          console.log(`Loaded ${parsed.length} deal(s) from ${id}_promos.json`);
        }
      } catch (e) {
        console.warn(`Could not read ${id}_promos.json:`, e?.message || e);
      }
    }
  } else {
    console.log(
      'Newsletter merge disabled (default). Set MERGE_NEWSLETTER_DEALS=1 to include Nike/Adidas rows from ingest. Prepared: npm run ingest-newsletters → nike_promos.json / adidas_promos.json.'
    );
  }

  const merged = dedupeDeals(allDeals);
  if (merged.length < allDeals.length) {
    console.log(`[scrape-merge] Deduplicated ${allDeals.length - merged.length} duplicate row(s) by URL/site.`);
  }

  if (merged.length > 0) {
    const allPromosPath = path.join(dataDir, 'all_promos.json');
    fs.writeFileSync(allPromosPath, JSON.stringify(merged, null, 2));

    const dealsPath = path.join(__dirname, '../public/deals.json');
    fs.writeFileSync(dealsPath, JSON.stringify(merged, null, 2));

    console.log(`\nScraping complete!`);
    console.log(`- Saved merged deals to public/data/all_promos.json`);
    console.log(`- Saved merged deals to public/deals.json`);
    console.log(`- Total deals: ${merged.length}`);
  } else {
    console.log('\nScraping complete, but no deals were found.');
  }

  console.log('\n[scrape-summary] run_totals:', JSON.stringify(summaryRows));

  if (process.env.SCRAPER_STRICT === '1' && strictFailed) {
    console.error('[scrape-strict] Exiting with code 1 (required scraper failed or returned 0).');
    process.exit(1);
  }
}

scrapeDeals();
