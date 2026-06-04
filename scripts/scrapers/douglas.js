import axios from 'axios';
import * as cheerio from 'cheerio';

const SCRAPE_DO_API = 'https://api.scrape.do/';
const DOUGLAS_URL   = 'https://www.douglas.pl/pl/c/promocje/09';
const MAX_ITEMS     = 40;

/**
 * Fetch a URL through scrape.do's rendering API.
 * Uses residential proxies (super=true) to bypass Akamai on Douglas.
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
    render: 'true',       // headless Chromium rendering (SPA hydration)
    super: 'true',        // residential proxy pool — bypasses Akamai
    waitSelector: 'a[class*="product-tile"], .product-tile, [data-testid="product-tile"]',
    geoCode: 'pl',        // Polish IP for correct locale/pricing
    timeout: '45000',
  };

  console.log(`  scrape.do → ${targetUrl}`);
  const response = await axios.get(SCRAPE_DO_API, {
    params,
    timeout: 60000,
    validateStatus: status => status < 500,
  });

  if (response.status !== 200) {
    throw new Error(`scrape.do returned HTTP ${response.status}: ${String(response.data).slice(0, 200)}`);
  }

  return response.data;
}

/**
 * Parse price string "129,99 zł" → "129.99"
 * @param {string|undefined} raw
 * @returns {string|null}
 */
function parsePrice(raw) {
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d,]/g, '').replace(',', '.');
  return cleaned || null;
}

/**
 * Extract product cards from fully-rendered Douglas HTML using cheerio.
 * @param {string} html
 * @returns {Array<object>}
 */
function extractProducts(html) {
  const $ = cheerio.load(html);
  const results = [];
  const seenUrls = new Set();

  // Broad selector — catches Douglas's various class naming conventions
  const cards = $(
    'a[class*="product-tile"], div[class*="product-tile"], [data-testid="product-tile"]'
  ).slice(0, MAX_ITEMS);

  console.log(`  Found ${cards.length} product card(s) in HTML.`);

  cards.each((_, el) => {
    const card = $(el);

    const brand = card.find('[class*="brand"], [data-testid="brand"]').first().text().trim();
    const name  = card.find('[class*="name"], h3, [data-testid="main-link"]').first().text().trim();

    const fullTitle = [brand, name].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

    // Sale price — prefer specific class, fall back to any "zł" text
    let salePriceRaw = card.find('[class*="price-sale"], [class*="price-promo"], [class*="price-current"]').first().text().trim();
    let origPriceRaw = card.find('[class*="price-regular"], [class*="price-old"], [class*="price-base"]').first().text().trim();

    if (!salePriceRaw) {
      const priceEls = card.find('span, div, p').filter((_, el) => {
        const t = $(el).text().trim();
        return t.includes('zł') && t.length < 20 && /\d/.test(t);
      });
      salePriceRaw = $(priceEls.get(0)).text().trim();
      origPriceRaw = $(priceEls.get(1)).text().trim();
    }

    const img  = card.find('img').first().attr('data-src') || card.find('img').first().attr('src') || null;
    const href = card.is('a') ? card.attr('href') : card.find('a').first().attr('href');
    const url  = href ? new URL(href, 'https://www.douglas.pl').href : null;

    if (url && seenUrls.has(url)) return;
    if (url) seenUrls.add(url);

    if (!fullTitle || !salePriceRaw) return;

    const salePrice = parsePrice(salePriceRaw);
    const origPrice = parsePrice(origPriceRaw);

    let discount = null;
    if (origPrice && salePrice && parseFloat(origPrice) > parseFloat(salePrice)) {
      const pct = Math.round(((parseFloat(origPrice) - parseFloat(salePrice)) / parseFloat(origPrice)) * 100);
      discount = `-${pct}%`;
    }

    results.push({
      title: fullTitle.slice(0, 150),
      brand: 'Douglas',
      category: 'Kosmetyki',
      discount,
      price: salePrice,
      currency: 'PLN',
      url,
      image: img,
      description: 'Wyprzedaż Douglas',
      valid_until: null,
      tags: ['Kosmetyki', 'sale'],
      confidence_score: 1.0,
      source_type: 'dynamic_scrape',
      source_name: 'Douglas scrape.do',
    });
  });

  return results;
}

export async function scrapeDouglas() {
  console.log('--- Scraping Douglas (scrape.do API) ---');

  if (!process.env.SCRAPE_DO) {
    console.warn('Douglas: SCRAPE_DO secret not set — skipping. Add it to GitHub Actions secrets.');
    return [];
  }

  try {
    const html  = await fetchRendered(DOUGLAS_URL);
    const deals = extractProducts(html);

    if (deals.length === 0) {
      // Dump a snippet so CI logs reveal what the page actually returned
      const snippet = String(html).slice(0, 600).replace(/\s+/g, ' ');
      console.warn(`Douglas: 0 items extracted. HTML snippet: ${snippet}`);
    }

    console.log(`Successfully extracted ${deals.length} items from Douglas`);
    return deals;
  } catch (err) {
    console.error(`Error scraping Douglas: ${err.message}`);
    return [];
  }
}
