import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import axios from 'axios';
import * as cheerio from 'cheerio';

puppeteer.use(StealthPlugin());

const PROMO_URL = 'https://www.hebe.pl/promocje/';
const SFCC_SEARCH_BASE = 'https://www.hebe.pl/on/demandware.store/Sites-Hebe-Site/pl_PL/Search-Show';
const SFCC_CGIDS = ['promotions', 'wyprzedaz'];
const SFCC_PAGE_SIZE = 48;

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

/**
 * Parse product tiles from SFCC Search-Show HTML fragment (format=ajax).
 * Returns raw item objects similar to the Puppeteer evaluate path.
 */
function parseSfccHtml(html) {
  const $ = cheerio.load(html);
  const items = [];

  $('.product-tile[data-product-gtm]').each((_, el) => {
    let gtm = {};
    try { gtm = JSON.parse($(el).attr('data-product-gtm')); } catch { /* skip */ }

    const brand = gtm.item_brand || $(el).find('.product-tile__name').text().trim();
    const desc = gtm.item_description || $(el).find('.product-tile__description').text().trim();
    const saleRaw = gtm.current_price ?? gtm.price ?? gtm.item_price;
    const origRaw = gtm.regular_price ?? gtm.item_list_price;

    let name = '';
    if (brand) name += brand + ' ';
    if (desc) name += desc;
    if (!name.trim() && gtm.item_name) name = String(gtm.item_name);

    const linkEl = $(el).find('a[href]').first();
    let href = linkEl.attr('data-href') || linkEl.attr('href') || '';
    if (href && !href.startsWith('http')) href = 'https://www.hebe.pl' + href;

    const imgEl = $(el).find('img').first();
    let img = imgEl.attr('data-src') || imgEl.attr('data-lazy-src') || imgEl.attr('src') || '';
    if (img.startsWith('//')) img = 'https:' + img;
    if (img.startsWith('/')) img = 'https://www.hebe.pl' + img;

    items.push({
      name: name.trim() || null,
      salePrice: saleRaw != null ? String(saleRaw) : null,
      origPrice: origRaw != null ? String(origRaw) : null,
      img: img || null,
      url: href || null,
    });
  });

  return items;
}

/**
 * Try fetching Hebe deals via SFCC Search-Show (Axios, no browser).
 * CF often applies lighter rules to XHR-like requests than to full page loads.
 */
async function hebeApiFallback() {
  const headers = {
    'User-Agent': BROWSER_UA,
    'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept': 'text/html, */*; q=0.01',
    'X-Requested-With': 'XMLHttpRequest',
    'Referer': PROMO_URL,
  };

  for (const cgid of SFCC_CGIDS) {
    const url = `${SFCC_SEARCH_BASE}?cgid=${cgid}&sz=${SFCC_PAGE_SIZE}&format=ajax`;
    try {
      const resp = await axios.get(url, { headers, timeout: 15000, validateStatus: () => true });
      if (resp.status !== 200) {
        console.log(`Hebe API: cgid=${cgid} → HTTP ${resp.status}`);
        continue;
      }
      const html = String(resp.data);
      if (html.length < 500 || html.includes('Just a moment') || html.includes('Attention Required')) {
        console.log(`Hebe API: cgid=${cgid} → CF challenge or empty (${html.length} bytes)`);
        continue;
      }
      const items = parseSfccHtml(html);
      if (items.length > 0) {
        console.log(`Hebe API: cgid=${cgid} → ${items.length} product(s) from SFCC Search-Show`);
        return items;
      }
      console.log(`Hebe API: cgid=${cgid} → 0 GTM tiles in ${html.length} bytes`);
    } catch (e) {
      console.log(`Hebe API: cgid=${cgid} → error: ${e.message}`);
    }
  }
  return [];
}

/**
 * Cookie consent handler for Puppeteer path.
 */
async function acceptCookiesIfPresent(page) {
  const selectors = [
    '#onetrust-accept-btn-handler',
    'button#onetrust-accept-btn-handler',
    '[id*="onetrust-accept"]',
    '.ot-sdk-container button[aria-label*="Accept"]',
  ];
  for (const sel of selectors) {
    try {
      const btn = await page.waitForSelector(sel, { timeout: 4000 });
      if (btn) {
        await btn.click();
        await new Promise((r) => setTimeout(r, 1500));
        console.log('Hebe: cookie consent dismissed.');
        return;
      }
    } catch {
      // try next
    }
  }
}

/**
 * Convert raw items (from API or Puppeteer) into normalized deal objects.
 */
function itemsToDeals(items, sourceName) {
  const deals = [];
  for (const item of items) {
    if (!item.name || !item.salePrice) continue;
    const cleanSale = item.salePrice.replace(/[^\d,.]/g, '').replace(',', '.');
    if (!cleanSale || parseFloat(cleanSale) <= 0) continue;

    const cleanOrig = item.origPrice
      ? item.origPrice.replace(/[^\d,.]/g, '').replace(',', '.')
      : null;

    let discount = null;
    if (cleanOrig && parseFloat(cleanOrig) > parseFloat(cleanSale)) {
      const pct = Math.round(
        ((parseFloat(cleanOrig) - parseFloat(cleanSale)) / parseFloat(cleanOrig)) * 100
      );
      discount = `-${pct}%`;
    }

    deals.push({
      title: item.name,
      brand: 'Hebe',
      category: 'Kosmetyki',
      discount,
      price: cleanSale,
      currency: 'PLN',
      url: item.url,
      image: item.img,
      description: 'Promocja Hebe',
      valid_until: null,
      tags: ['Kosmetyki', 'sale'],
      confidence_score: item.url ? 1.0 : 0.85,
      source_type: 'dynamic_scrape',
      source_name: sourceName,
    });
  }
  return deals;
}

export async function scrapeHebe() {
  console.log('--- Scraping Hebe ---');

  // Strategy 1: SFCC API-direct (Axios + Cheerio, no browser)
  console.log('Hebe: trying API-direct via SFCC Search-Show…');
  const apiItems = await hebeApiFallback();
  if (apiItems.length > 0) {
    const deals = itemsToDeals(apiItems, 'Hebe SFCC API');
    console.log(`Successfully extracted ${deals.length} items from Hebe (API-direct)`);
    return deals;
  }
  console.log('Hebe: API-direct returned 0; falling back to Puppeteer…');

  // Strategy 2: Puppeteer (existing browser scrape)
  const { launchBrowser } = await import('../lib/launchBrowser.js');
  const browser = await launchBrowser(['--disable-blink-features=AutomationControlled']);

  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });
  await page.setUserAgent(BROWSER_UA);
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7',
  });

  const deals = [];

  try {
    await page.goto(PROMO_URL, { waitUntil: 'networkidle2', timeout: 60000 });

    const pageInfo = await page.evaluate(() => ({
      title: document.title,
      snippet: document.body?.innerText?.substring(0, 300) || '',
    }));
    console.log('Hebe: page title:', pageInfo.title);
    console.log('Hebe: body snippet:', pageInfo.snippet.substring(0, 120));

    if (/checking your browser|attention required|access denied|just a moment/i.test(pageInfo.snippet)) {
      console.log('[scrape-info] site=hebe status=cf_blocked hint=set SCRAPER_PROXY_URL for residential IP access');
      await browser.close();
      return deals;
    }

    await new Promise((r) => setTimeout(r, 5000));
    await acceptCookiesIfPresent(page);

    try {
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 5000 });
    } catch { /* no navigation */ }

    console.log('Hebe: waiting for product tiles…');
    try {
      await page.waitForFunction(
        () => document.querySelectorAll('.product-tile[data-product-gtm]').length > 0,
        { timeout: 30000 }
      );
    } catch {
      console.log('Hebe: timeout waiting for [data-product-gtm]; trying class-based tiles…');
      try {
        await page.waitForSelector('.product-tile.js-product-tile, .product-tile', { timeout: 10000 });
      } catch {
        console.log('Hebe: no product tiles detected after waits.');
      }
    }

    await new Promise((r) => setTimeout(r, 3000));

    console.log('Scrolling to load more Hebe products…');
    for (let i = 0; i < 15; i++) {
      await page.evaluate(() => window.scrollBy(0, 900));
      await new Promise((r) => setTimeout(r, 1000));
    }

    const tileCount = await page.evaluate(() => {
      const tiles = Array.from(
        document.querySelectorAll('.product-tile[data-product-gtm], .product-tile.js-product-tile, .product-tile')
      );
      const seen = new Set();
      const unique = tiles.filter((el) => { if (seen.has(el)) return false; seen.add(el); return true; });
      unique.slice(0, 80).forEach((card) => card.scrollIntoView({ block: 'nearest' }));
      return unique.length;
    });
    console.log(`Hebe: ${tileCount} product tile(s) in DOM before extract.`);

    await new Promise((r) => setTimeout(r, 2000));

    const items = await page.evaluate(() => {
      const selectors = [
        '.product-tile[data-product-gtm]',
        '.product-tile.js-product-tile',
        '.product-tile.js-gtm-product-tile',
        '.product-tile',
      ];
      let cards = [];
      const seenEl = new Set();
      for (const sel of selectors) {
        document.querySelectorAll(sel).forEach((el) => {
          if (!seenEl.has(el)) { seenEl.add(el); cards.push(el); }
        });
      }
      cards = cards.slice(0, 80);

      return cards.map((card) => {
        let gtmData = {};
        try {
          const gtmAttr = card.getAttribute('data-product-gtm');
          if (gtmAttr) gtmData = JSON.parse(gtmAttr);
        } catch { /* ignore */ }

        const brand = gtmData.item_brand || card.querySelector('.product-tile__name')?.innerText?.trim();
        const desc = gtmData.item_description || card.querySelector('.product-tile__description')?.innerText?.trim();
        const saleRaw = gtmData.current_price ?? gtmData.price ?? gtmData.item_price;
        const origRaw = gtmData.regular_price ?? gtmData.item_list_price;

        let name = '';
        if (brand) name += brand + ' ';
        if (desc) name += desc;
        if (!name.trim() && gtmData.item_name) name = String(gtmData.item_name);

        const allImgs = Array.from(card.querySelectorAll('img'));
        const linkEl = card.querySelector('a[href*=".html"]') || card.querySelector('.js-product-link[data-href]');

        let url = null;
        if (linkEl) {
          const path = linkEl.getAttribute('data-href') || linkEl.getAttribute('href');
          if (path) url = path.startsWith('http') ? path : `https://www.hebe.pl${path}`;
        }

        let img = null;
        for (const imgEl of allImgs) {
          const c = imgEl.getAttribute('data-src') || imgEl.getAttribute('data-lazy-src') || imgEl.getAttribute('srcset')?.split(' ')[0] || imgEl.src;
          if (c && c.length > 10 && !c.includes('placeholder')) { img = c; break; }
        }
        if (img && img.startsWith('//')) img = 'https:' + img;
        if (img && img.startsWith('/')) img = 'https://www.hebe.pl' + img;

        let salePrice = saleRaw != null ? String(saleRaw) : null;
        let origPrice = origRaw != null ? String(origRaw) : null;
        if (!salePrice) {
          const priceEl = card.querySelector('.product-tile__pricing .price, .price-sales, [class*="sales"], .price');
          const t = priceEl?.innerText?.trim();
          if (t && /\d/.test(t)) salePrice = t;
        }

        return { name: name.trim() || null, salePrice, origPrice, img, url };
      });
    });

    deals.push(...itemsToDeals(items, 'Hebe HTML'));
  } catch (e) {
    console.error('Error scraping Hebe:', e.message);
  } finally {
    await browser.close();
  }

  console.log('Successfully extracted ' + deals.length + ' items from Hebe');
  return deals;
}
