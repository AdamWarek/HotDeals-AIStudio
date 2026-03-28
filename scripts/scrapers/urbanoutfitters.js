import axios from 'axios';

const UO_ORIGIN = 'https://www.urbanoutfitters.com';
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const SALE_URLS = [
  `${UO_ORIGIN}/pl-pl/shop/sale`,
  `${UO_ORIGIN}/en-gb/shop/sale`,
];

const API_PROBE_URLS = [
  `${UO_ORIGIN}/api/catalog/products?slug=sale&locale=pl-PL&country=PL`,
  `${UO_ORIGIN}/api/catalog/products?slug=sale&locale=en-GB&country=GB`,
  `${UO_ORIGIN}/api/v1/products?category=sale&locale=pl-PL`,
];

function mapApiProductToDeal(p) {
  const name = p.name || p.productName || p.title || '';
  const rawUrl = p.url || p.pdpUrl || p.productUrl || '';
  const url = rawUrl.startsWith('http')
    ? rawUrl
    : `${UO_ORIGIN}${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;

  let img =
    p.primaryImage ||
    p.image ||
    (Array.isArray(p.images) && p.images[0]) ||
    p.thumbnailImage;
  if (img && typeof img === 'object') img = img.url || img.src || img.uri;

  const sale =
    p.salePrice ?? p.sale_price ?? p.promoPrice ?? p.price ?? p.listPrice ?? p.originalPrice;
  const priceStr = sale != null ? String(sale).replace(/[^\d.,]/g, '').replace(',', '.') : '';

  return {
    title: name,
    brand: 'Urban Outfitters',
    category: 'Odzież',
    price: priceStr,
    currency: 'PLN',
    url,
    image: img || null,
    description: 'Wyprzedaż Urban Outfitters',
    tags: ['Odzież', 'sale'],
    confidence_score: 0.95,
    source_type: 'dynamic_scrape',
    source_name: 'Urban Outfitters API',
    scrape_fallback: false,
  };
}

function extractProductsFromPayload(data) {
  if (!data || typeof data !== 'object') return [];
  const candidates = [
    data.products,
    data.productList,
    data.results,
    data.items,
    data.response?.products,
    data.data?.products,
    data.catalog?.products,
    data.productListing?.products,
  ];
  for (const c of candidates) {
    if (Array.isArray(c) && c.length > 0) return c;
  }
  return [];
}

/**
 * Probe UO product listing APIs directly via Axios.
 * Likely geo-blocked on datacenter IPs, but fast to fail (~2s per probe).
 */
async function uoApiFallback() {
  const headers = {
    'User-Agent': BROWSER_UA,
    'Accept': 'application/json',
    'Accept-Language': 'pl-PL,pl;q=0.9,en-GB;q=0.8,en;q=0.7',
    'Referer': `${UO_ORIGIN}/pl-pl/shop/sale`,
  };

  for (const url of API_PROBE_URLS) {
    try {
      const resp = await axios.get(url, {
        headers,
        timeout: 8000,
        validateStatus: () => true,
      });
      if (resp.status !== 200) {
        console.log(`UO API: ${url.split('?')[0].split('/').pop()} → HTTP ${resp.status}`);
        continue;
      }
      const ct = resp.headers['content-type'] || '';
      if (!ct.includes('json')) {
        console.log(`UO API: non-JSON response (${ct.substring(0, 40)})`);
        continue;
      }
      const products = extractProductsFromPayload(resp.data);
      if (products.length > 0) {
        console.log(`UO API: found ${products.length} product(s) from direct API`);
        return products;
      }
    } catch (e) {
      console.log(`UO API: error probing ${url.split('?')[0].split('/').pop()}: ${e.message}`);
    }
  }
  return [];
}

export async function scrapeUrbanOutfitters() {
  console.log('--- Scraping Urban Outfitters ---');

  // Strategy 1: API-direct probe (fast, may be geo-blocked)
  console.log('UO: trying API-direct probe…');
  const apiProducts = await uoApiFallback();
  if (apiProducts.length > 0) {
    const deals = [];
    const seen = new Set();
    for (const p of apiProducts) {
      const d = mapApiProductToDeal(p);
      if (!d.title || !d.price || parseFloat(d.price) <= 0) continue;
      const key = d.url || d.title;
      if (seen.has(key)) continue;
      seen.add(key);
      deals.push(d);
      if (deals.length >= 48) break;
    }
    console.log(`Successfully extracted ${deals.length} items from Urban Outfitters (API-direct)`);
    return deals;
  }
  console.log('UO: API-direct returned 0; falling back to Puppeteer…');

  // Strategy 2: Puppeteer with proxy support
  const { launchBrowser } = await import('../lib/launchBrowser.js');
  const browser = await launchBrowser(['--disable-blink-features=AutomationControlled']);

  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });
  await page.setUserAgent(BROWSER_UA);
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7',
  });

  const interceptedProducts = [];
  const seenApiUrls = new Set();

  const onResponse = async (response) => {
    const url = response.url();
    if (!response.ok()) return;
    const isUoApi =
      url.includes('api.urbanoutfitters.com') ||
      (url.includes('urbanoutfitters.com') && url.includes('/api/'));
    if (!isUoApi) return;
    if (!/product|search|browse|category|plp|items/i.test(url)) return;
    if (seenApiUrls.has(url)) return;
    try {
      const ct = response.headers()['content-type'] || '';
      if (!ct.includes('json') && !ct.includes('javascript')) return;
      const data = await response.json();
      const products = extractProductsFromPayload(data);
      if (products.length === 0) return;
      seenApiUrls.add(url);
      interceptedProducts.push(...products);
      console.log(`UO: captured ${products.length} product(s) from API response`);
    } catch {
      /* not JSON */
    }
  };
  page.on('response', onResponse);

  page.on('console', (msg) => {
    if (msg.type() === 'log') console.log('BROWSER LOG:', msg.text());
  });

  const deals = [];

  try {
    for (const saleUrl of SALE_URLS) {
      console.log(`Navigating to ${saleUrl}…`);
      await page.goto(saleUrl, { waitUntil: 'networkidle2', timeout: 60000 });

      const finalUrl = page.url();
      const pageInfo = await page.evaluate(() => ({
        title: document.title,
        snippet: document.body?.innerText?.substring(0, 200) || '',
      }));
      console.log('UO: final URL:', finalUrl);
      console.log('UO: page title:', pageInfo.title);

      const isBlocked =
        /checking your browser|attention required|access denied|just a moment/i.test(pageInfo.snippet) ||
        /access.*denied|blocked|captcha|challenge/i.test(pageInfo.title);
      if (isBlocked) {
        console.log('UO: bot/geo challenge detected. Trying next locale…');
        continue;
      }

      await new Promise((r) => setTimeout(r, 5000));

      for (let i = 0; i < 10; i++) {
        await page.evaluate(() => window.scrollBy(0, 900));
        await new Promise((r) => setTimeout(r, 1200));
      }
      await new Promise((r) => setTimeout(r, 3000));

      if (interceptedProducts.length > 0) {
        console.log(`UO: API captured ${interceptedProducts.length} total product(s).`);
        break;
      }

      const hasProducts = await page.evaluate(() => {
        return document.querySelectorAll('a[href*="/product"], [data-product], [class*="ProductCard"], [class*="product-tile"]').length;
      });
      if (hasProducts > 0) {
        console.log(`UO: found ${hasProducts} product element(s) in DOM at ${saleUrl}`);
        break;
      }

      console.log(`UO: no products at ${saleUrl}, trying next locale…`);
    }

    page.off('response', onResponse);

    if (interceptedProducts.length > 0) {
      const seen = new Set();
      for (const p of interceptedProducts) {
        const d = mapApiProductToDeal(p);
        if (!d.title || !d.price || parseFloat(d.price) <= 0) continue;
        const key = d.url || d.title;
        if (seen.has(key)) continue;
        seen.add(key);
        deals.push(d);
        if (deals.length >= 48) break;
      }
    }

    // Safe __NEXT_DATA__ read
    if (deals.length === 0) {
      const nextDataResult = await page.evaluate(() => {
        try {
          const el = document.getElementById('__NEXT_DATA__');
          if (!el || !el.textContent) return { ok: false, error: 'no __NEXT_DATA__' };
          const state = JSON.parse(el.textContent);
          const products =
            state?.props?.pageProps?.products ||
            state?.props?.pageProps?.productList ||
            state?.props?.initialState?.productListing?.products ||
            [];
          if (!Array.isArray(products) || products.length === 0) {
            return { ok: false, error: 'empty products in __NEXT_DATA__' };
          }
          return { ok: true, products };
        } catch (e) {
          return { ok: false, error: e?.message || String(e) };
        }
      });
      if (nextDataResult.ok && nextDataResult.products?.length) {
        console.log(`UO: __NEXT_DATA__ returned ${nextDataResult.products.length} product(s)`);
        for (const p of nextDataResult.products.slice(0, 48)) {
          const d = mapApiProductToDeal(p);
          if (!d.title || !d.price || parseFloat(d.price) <= 0) continue;
          deals.push(d);
        }
      } else if (nextDataResult.error) {
        console.log('UO: __NEXT_DATA__:', nextDataResult.error);
      }
    }

    // HTML fallback
    if (deals.length === 0) {
      const htmlResult = await page.evaluate(() => {
        try {
          const results = [];
          const seenUrls = new Set();
          const links = Array.from(document.querySelectorAll(
            'a[href*="/product/"], a[href*="/pl-pl/"], a[href*="/en-gb/"], [data-sku], [data-productid]'
          ));
          for (const el of links) {
            let card = el;
            let foundCard = false;
            for (let i = 0; i < 8; i++) {
              if (!card.parentElement) break;
              card = card.parentElement;
              const text = card.innerText || '';
              const hasPrice = /\d/.test(text) && (text.includes('zł') || text.includes('PLN') || text.includes('£') || text.includes('€'));
              const hasImg = card.querySelector('img');
              if (hasPrice && hasImg) { foundCard = true; break; }
            }
            if (!foundCard) continue;
            const nameEl = card.querySelector('h2, h3, a[title], [class*="title"], [class*="heading"], [data-testid*="title"]');
            const imgEl = card.querySelector('img');
            const linkEl = card.querySelector('a[href*="/product"], a[href*="/pl-pl/"], a[href*="/en-gb/"]');
            const title = (nameEl?.innerText || nameEl?.getAttribute('title') || '').trim();
            const url = linkEl?.href || el.href || null;
            if (!title || !url || seenUrls.has(url)) continue;
            seenUrls.add(url);
            const priceText = card.innerText || '';
            const priceMatch = priceText.match(/(\d{1,3}(?:[.,]\d{2})?)\s*(?:zł|PLN|£|€)/);
            const price = priceMatch ? priceMatch[1].replace(',', '.') : '';
            if (!price || parseFloat(price) <= 0) continue;
            results.push({ title, price, url, img: imgEl?.getAttribute('data-src') || imgEl?.src || null });
            if (results.length >= 48) break;
          }
          return { ok: true, items: results };
        } catch (e) {
          return { ok: false, error: e?.message || String(e), items: [] };
        }
      });
      if (!htmlResult.ok && htmlResult.error) console.log('UO HTML evaluate:', htmlResult.error);
      for (const item of htmlResult.items || []) {
        deals.push({
          title: item.title,
          brand: 'Urban Outfitters',
          category: 'Odzież',
          price: item.price,
          currency: 'PLN',
          url: item.url,
          image: item.img,
          description: 'Wyprzedaż Urban Outfitters (HTML)',
          tags: ['Odzież', 'sale'],
          confidence_score: 0.75,
          source_type: 'dynamic_scrape',
          source_name: 'Urban Outfitters HTML',
          scrape_fallback: true,
        });
      }
      if (deals.length) {
        console.log(`UO: HTML fallback extracted ${deals.length} item(s)`);
      }
    }

    if (deals.length === 0) {
      console.log('[scrape-info] site=urbanoutfitters status=geo_blocked hint=set SCRAPER_PROXY_URL for residential IP access');
    }
  } catch (e) {
    console.error('Error scraping Urban Outfitters:', e.message);
  } finally {
    try { page.off('response', onResponse); } catch { /* */ }
    await browser.close();
  }

  console.log('Successfully extracted ' + deals.length + ' items from Urban Outfitters');
  return deals.slice(0, 48);
}
