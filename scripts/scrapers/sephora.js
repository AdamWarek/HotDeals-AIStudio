import axios from 'axios';
import * as cheerio from 'cheerio';

const SCRAPE_DO_API = 'https://api.scrape.do/';

/**
 * Sephora PL uses Salesforce Commerce Cloud (SFCC/Demandware) and is protected by
 * Akamai EdgeSuite WAF — headless Chromium (even with stealth) gets 403 "Access Denied".
 * We bypass it via scrape.do with residential proxies (super=true) and JS rendering.
 *
 * The `format=page-element` query param returns a bare HTML fragment of product tiles
 * (no full page shell), which makes cheerio parsing straightforward.
 */
const SEPHORA_SALE_URL =
  'https://www.sephora.pl/wyprzedaz/?srule=Best%20Sellers_def&start=0&sz=96&format=page-element&on=onclickload';

const MAX_ITEMS = 80;

/**
 * Fetch Sephora sale page through scrape.do with residential proxy + JS rendering.
 * @param {string} targetUrl
 * @returns {Promise<string>} rendered HTML
 */
async function fetchRendered(targetUrl) {
  const token = process.env.SCRAPE_DO;
  if (!token) {
    throw new Error('SCRAPE_DO env var is not set. Add it to GitHub Actions secrets.');
  }

  const params = {
    token,
    url: targetUrl,
    render: 'true',
    super: 'true',        // residential proxy pool — bypasses Akamai EdgeSuite
    waitSelector: '.product-tile',
    geoCode: 'pl',
    timeout: '45000',
  };

  console.log(`  scrape.do → ${targetUrl}`);
  const response = await axios.get(SCRAPE_DO_API, {
    params,
    timeout: 60000,
    validateStatus: (status) => status < 500,
  });

  if (response.status !== 200) {
    throw new Error(`scrape.do returned HTTP ${response.status}: ${String(response.data).slice(0, 200)}`);
  }

  return response.data;
}

/**
 * Parse price string "565,00 zł" → "565.00"
 * @param {string|undefined} raw
 * @returns {string|null}
 */
function parsePrice(raw) {
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d,]/g, '').replace(',', '.');
  const value = parseFloat(cleaned);
  return Number.isFinite(value) && value > 0 ? cleaned : null;
}

/**
 * Extract the first product image URL that points to actual product photos
 * (hosted on media.sephora.eu), skipping wishlist/icon SVGs from demandware.static.
 * @param {import('cheerio').CheerioAPI} $
 * @param {import('cheerio').Cheerio} card
 * @returns {string|null}
 */
function extractProductImage($, card) {
  const imgs = card.find('img').toArray();
  for (const img of imgs) {
    const src = $(img).attr('data-src') || $(img).attr('src') || '';
    if (src.includes('media.sephora.eu') || src.includes('sephora.eu/content/dam')) {
      return src;
    }
  }
  return null;
}

/**
 * Parse product data from SFCC product tiles using cheerio.
 * Each tile carries a `data-tcproduct` JSON attribute with reliable telemetry fields.
 * @param {string} html
 * @returns {Array<object>}
 */
function extractProducts(html) {
  const $ = cheerio.load(html);
  const results = [];
  const seenUrls = new Set();

  const cards = $('.product-tile').slice(0, MAX_ITEMS);
  console.log(`  Found ${cards.length} product tile(s) in HTML.`);

  cards.each((_, el) => {
    const card = $(el);

    // SFCC telemetry attribute holds structured product metadata.
    let tc = {};
    try {
      tc = JSON.parse(card.attr('data-tcproduct') || '{}');
    } catch {
      /* malformed attribute — fall back to DOM extraction below */
    }

    const brand = (tc.product_trademark || '').trim();
    const productName = (tc.product_pid_name || card.find('[class*="product-name"]').first().text()).trim();
    const fullTitle = [brand, productName]
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    // SFCC prices are in "565.00" decimal string format inside data-tcproduct.
    // The visible DOM uses "565,00 zł" in .price-sales-standard.
    let salePrice =
      parsePrice(card.find('[class*="price-sales"]').first().text().trim()) ||
      parsePrice(tc.product_price_ati);
    const origPrice =
      parsePrice(card.find('[class*="price-standard"], .strike-through').first().text().trim()) ||
      parsePrice(tc.product_old_price_ati);

    const url = tc.product_url_page || (() => {
      const href = card.find('a[href*="sephora.pl/p/"]').first().attr('href');
      return href ? new URL(href, 'https://www.sephora.pl').href : null;
    })();

    if (!url || seenUrls.has(url)) return;
    seenUrls.add(url);

    if (!fullTitle || !salePrice) return;

    const image = extractProductImage($, card);

    let discount = null;
    const salePriceNum = parseFloat(salePrice);
    const origPriceNum = parseFloat(origPrice || '0');
    if (origPriceNum > salePriceNum) {
      const pct = Math.round(((origPriceNum - salePriceNum) / origPriceNum) * 100);
      discount = `-${pct}%`;
    }

    results.push({
      title: fullTitle.slice(0, 150),
      brand: 'Sephora',
      category: 'Kosmetyki',
      discount,
      price: salePrice,
      original_price: origPrice ? `${parseFloat(origPrice).toFixed(2)} PLN` : undefined,
      currency: 'PLN',
      url,
      image,
      description: 'Promocja Sephora',
      valid_until: null,
      tags: ['Kosmetyki', 'sale'],
      confidence_score: 1.0,
      source_type: 'dynamic_scrape',
      source_name: 'Sephora scrape.do',
    });
  });

  return results;
}

export async function scrapeSephora() {
  console.log('--- Scraping Sephora (scrape.do API) ---');

  if (!process.env.SCRAPE_DO) {
    console.warn('Sephora: SCRAPE_DO secret not set — skipping. Add it to GitHub Actions secrets.');
    return [];
  }

  try {
    const html = await fetchRendered(SEPHORA_SALE_URL);
    const deals = extractProducts(html);

    if (deals.length === 0) {
      const snippet = String(html).slice(0, 600).replace(/\s+/g, ' ');
      console.warn(`Sephora: 0 items extracted. HTML snippet: ${snippet}`);
    }

    console.log(`Successfully extracted ${deals.length} items from Sephora`);
    return deals;
  } catch (err) {
    console.error(`Error scraping Sephora: ${err.message}`);
    return [];
  }
}
