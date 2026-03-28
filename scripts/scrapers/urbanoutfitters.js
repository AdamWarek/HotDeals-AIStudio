import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

const UO_ORIGIN = 'https://www.urbanoutfitters.com';

/**
 * Normalize assorted UO API product shapes into scraper deal objects.
 */
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

export async function scrapeUrbanOutfitters() {
  console.log('--- Scraping Urban Outfitters (API Approach) ---');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  );
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7',
  });

  const apiProducts = [];
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
      apiProducts.push(...products);
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
    console.log('Navigating to Urban Outfitters main page…');
    await page.goto(`${UO_ORIGIN}/pl-pl/`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await new Promise((r) => setTimeout(r, 3000));

    console.log('Navigating to Urban Outfitters sale page…');
    await page.goto(`${UO_ORIGIN}/pl-pl/shop/sale`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await new Promise((r) => setTimeout(r, 4000));

    for (let i = 0; i < 8; i++) {
      await page.evaluate(() => window.scrollBy(0, 900));
      await new Promise((r) => setTimeout(r, 1200));
    }
    await new Promise((r) => setTimeout(r, 3000));

    page.off('response', onResponse);

    if (apiProducts.length > 0) {
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
    }

    // Safe __NEXT_DATA__ read (single script tag, no greedy JSON.parse on whole page)
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

    // HTML fallback — small evaluate, no nested JSON.parse on arbitrary scripts
    if (deals.length === 0) {
      const htmlResult = await page.evaluate(() => {
        try {
          const results = [];
          const priceEls = Array.from(document.querySelectorAll('*')).filter((el) => {
            const text = el.innerText || '';
            return (
              (text.includes('zł') || text.includes('PLN')) &&
              text.length < 24 &&
              el.children.length === 0
            );
          });
          for (const priceEl of priceEls) {
            const card = priceEl.closest(
              'article, li, [data-product], [class*="ProductCard"], [class*="product-tile"], [class*="product"], [class*="item"]'
            );
            if (!card) continue;
            const nameEl = card.querySelector(
              'h2, h3, a[title], [class*="title"], [class*="heading"], [data-testid*="title"]'
            );
            const imgEl = card.querySelector('img');
            const linkEl = card.querySelector('a[href*="/pl-pl/"], a[href*="/product"], a[href*="/shop/"]');
            const title = (nameEl?.innerText || nameEl?.getAttribute('title') || '').trim();
            const price = priceEl.innerText.trim().replace(/[^\d.,]/g, '').replace(',', '.');
            const url = linkEl?.href || null;
            if (title && url && price && parseFloat(price) > 0) {
              results.push({
                title,
                price,
                url,
                img: imgEl?.getAttribute('data-src') || imgEl?.src || null,
              });
            }
          }
          return { ok: true, items: results };
        } catch (e) {
          return { ok: false, error: e?.message || String(e), items: [] };
        }
      });
      if (!htmlResult.ok && htmlResult.error) {
        console.log('UO HTML evaluate:', htmlResult.error);
      }
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
  } catch (e) {
    console.error('Error scraping Urban Outfitters:', e.message);
  } finally {
    try {
      page.off('response', onResponse);
    } catch {
      /* */
    }
    await browser.close();
  }

  console.log('Successfully extracted ' + deals.length + ' items from Urban Outfitters');
  return deals.slice(0, 48);
}
