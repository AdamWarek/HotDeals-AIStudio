import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

const HM_ORIGIN = 'https://www2.hm.com';
const SALE_PAGE_URL = `${HM_ORIGIN}/pl_pl/wyprzedaz/ona/view-all.html`;
const PAGE_SIZE = 36;
const MAX_JSON_PRODUCTS = 90;

/** H&M / Akamai often use OneTrust or in-page "accept" for PL locale. */
async function acceptHmCookies(page) {
  const selectors = [
    '#onetrust-accept-btn-handler',
    'button#onetrust-accept-btn-handler',
    '[id*="accept"][id*="onetrust"]',
    'button[data-testid="cookie-accept-all"]',
    'button.cmpboxbtnyes',
  ];
  for (const sel of selectors) {
    try {
      const btn = await page.waitForSelector(sel, { timeout: 3500 });
      if (btn) {
        await btn.click();
        await new Promise((r) => setTimeout(r, 2000));
        console.log('H&M: cookie / consent dismissed.');
        return;
      }
    } catch {
      /* try next */
    }
  }
  // Text-based fallback (PL / EN)
  try {
    const clicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, a[role="button"], [role="button"]'));
      const re = /(akceptuj|zaakceptuj|zgadzam|accept all|allow all|tylko niezbędne)/i;
      for (const b of buttons) {
        const t = (b.innerText || b.textContent || '').trim();
        if (t.length > 80) continue;
        if (re.test(t) && /wszystk|all|essential/i.test(t)) {
          b.click();
          return true;
        }
      }
      const acceptAll = buttons.find((b) => /accept all|akceptuj wszystkie/i.test(b.innerText || ''));
      if (acceptAll) {
        acceptAll.click();
        return true;
      }
      return false;
    });
    if (clicked) {
      await new Promise((r) => setTimeout(r, 2000));
      console.log('H&M: consent clicked via text match.');
    }
  } catch {
    /* ignore */
  }
}

/**
 * From loaded sale path e.g. /pl_pl/wyprzedaz/ona/view-all.html → listing JSON base path.
 */
function listingJsonUrlFromPathname(pathname, offset, pageSize) {
  const path = pathname.replace(/\.html$/i, '').replace(/\/$/, '');
  return `${HM_ORIGIN}${path}/_jcr_content/main/productlisting.display.json?offset=${offset}&page-size=${pageSize}`;
}

function staticFallbackListingUrls(offset, pageSize) {
  const paths = [
    '/pl_pl/ona/wyprzedaz/zobacz-wszystko',
    '/pl_pl/wyprzedaz/ona/view-all',
    '/pl_pl/wyprzedaz/kobiety/view-all',
    '/pl_pl/wyprzedaz/kobiety',
    '/pl_pl/wyprzedaz/damskie/view-all',
  ];
  return paths.map(
    (p) => `${HM_ORIGIN}${p}/_jcr_content/main/productlisting.display.json?offset=${offset}&page-size=${pageSize}`
  );
}

/** H&M payload shape varies; normalize to a product array. */
function extractProductListFromHmJson(data) {
  if (!data || typeof data !== 'object') return [];
  if (Array.isArray(data.products) && data.products.length) return data.products;
  const alt = data.productList || data.plp?.products || data.results || data.items;
  if (Array.isArray(alt) && alt.length) return alt;
  return [];
}

function pickProductImage(product) {
  const img = product.image;
  if (!img) return null;
  if (Array.isArray(img) && img.length > 0) {
    const first = img[0];
    return typeof first === 'string' ? first : first?.src || first?.url || null;
  }
  if (typeof img === 'string') return img;
  return img?.src || img?.url || null;
}

function mapHmProductToDeal(product) {
  const priceRaw = product.price;
  const priceStr =
    typeof priceRaw === 'string'
      ? priceRaw.replace(/[^\d,]/g, '').replace(',', '.')
      : String(priceRaw ?? '').replace(/[^\d,]/g, '').replace(',', '.');

  const link = product.link || product.url || '';
  const path = link.startsWith('http') ? link : `${HM_ORIGIN}${link.startsWith('/') ? '' : '/'}${link}`;

  return {
    title: product.title || product.productName || 'H&M',
    brand: 'H&M',
    category: 'Odzież',
    discount: product.discountMarker || product.discountPercent || null,
    price: priceStr,
    currency: 'PLN',
    url: path,
    image: pickProductImage(product),
    description: 'Wyprzedaż H&M',
    valid_until: null,
    tags: ['Odzież', 'sale'],
    confidence_score: 1.0,
    source_type: 'dynamic_scrape',
    source_name: 'H&M API',
  };
}

export async function scrapeHM() {
  console.log('--- Scraping H&M (API Approach) ---');
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

  /** Akamai often serves listing JSON to document requests; capture from network. */
  const listingJsonFromNetwork = [];

  const onListingResponse = async (response) => {
    const url = response.url();
    if (url.includes('json') && (url.includes('product') || url.includes('listing'))) {
      console.log('H&M JSON RESPONSE:', url, response.status());
    }
    if (!url.includes('productlisting.display.json') || !response.ok()) return;
    try {
      const data = await response.json();
      const products = extractProductListFromHmJson(data);
      if (products.length > 0) {
        listingJsonFromNetwork.push(...products);
        console.log(`H&M: network capture +${products.length} from listing JSON`);
      }
    } catch {
      /* non-JSON body */
    }
  };
  page.on('response', onListingResponse);

  page.on('console', (msg) => {
    if (msg.type() === 'log') console.log('BROWSER LOG:', msg.text());
  });

  const deals = [];

  try {
    console.log('Navigating to H&M main page…');
    await page.goto(`${HM_ORIGIN}/pl_pl/index.html`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await acceptHmCookies(page);
    await new Promise((r) => setTimeout(r, 1500));

    console.log('Navigating to H&M sale page…');
    await page.goto(SALE_PAGE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await acceptHmCookies(page);
    await new Promise((r) => setTimeout(r, 2000));

    try {
      await page.waitForSelector('article[data-articlecode], .product-item, li.product-item', {
        timeout: 15000,
      });
      console.log('Product grid found on H&M.');
    } catch {
      console.log('H&M: product grid selector timeout; continuing to JSON fetch…');
      await page.evaluate(() => window.scrollBy(0, 800));
      await new Promise((r) => setTimeout(r, 2000));
    }

    // Trigger lazy XHR for more listing pages
    console.log('H&M: scrolling to capture listing JSON from network…');
    for (let i = 0; i < 6; i++) {
      await page.evaluate(() => window.scrollBy(0, 900));
      await new Promise((r) => setTimeout(r, 1200));
    }
    await new Promise((r) => setTimeout(r, 2500));

    const currentPath = new URL(page.url()).pathname;
    const listingStem = listingJsonUrlFromPathname(currentPath, 0, PAGE_SIZE).split('?')[0];
    console.log('H&M: listing JSON template from current path:', listingStem);

    const allProducts = [];
    let jsonWorked = false;

    if (listingJsonFromNetwork.length > 0) {
      allProducts.push(...listingJsonFromNetwork);
      jsonWorked = true;
      console.log(`H&M: total ${allProducts.length} raw products from network JSON`);
    }

    const referer = page.url();

    for (let offset = jsonWorked ? PAGE_SIZE : 0; offset < MAX_JSON_PRODUCTS; offset += PAGE_SIZE) {
      const primaryUrl = listingJsonUrlFromPathname(currentPath, offset, PAGE_SIZE);
      const fallbackUrls = staticFallbackListingUrls(offset, PAGE_SIZE);
      const tryUrls = [...new Set([primaryUrl, ...fallbackUrls])];

      const chunk = await page.evaluate(
        async ({ urls, referer: ref }) => {
          const headers = {
            Accept: 'application/json, text/plain, */*',
            Referer: ref,
            'X-Requested-With': 'XMLHttpRequest',
          };
          for (const u of urls) {
            try {
              const res = await fetch(u, { credentials: 'include', headers });
              if (!res.ok) continue;
              const data = await res.json();
              const products = Array.isArray(data.products)
                ? data.products
                : data.productList || data.plp?.products || data.results || data.items || [];
              if (Array.isArray(products) && products.length > 0) {
                return { products, url: u };
              }
            } catch {
              /* next */
            }
          }
          return { products: [], url: null };
        },
        { urls: tryUrls, referer }
      );

      if (chunk.products.length === 0) {
        if (offset === 0 && !jsonWorked) {
          console.log('H&M: no products from JSON at offset 0; will use HTML fallback if needed.');
        }
        break;
      }

      jsonWorked = true;
      console.log(`H&M: JSON page offset=${offset} → ${chunk.products.length} products (${chunk.url})`);
      allProducts.push(...chunk.products);
      if (chunk.products.length < PAGE_SIZE) break;
    }

    if (jsonWorked && allProducts.length > 0) {
      const seen = new Set();
      for (const product of allProducts) {
        const key =
          product.articleCode ||
          product.id ||
          product.defaultArticleCode ||
          product.link ||
          product.title;
        if (key) {
          if (seen.has(key)) continue;
          seen.add(key);
        }

        const deal = mapHmProductToDeal(product);
        if (!deal.price || parseFloat(deal.price) <= 0) continue;
        if (!deal.url || !deal.title) continue;
        deals.push(deal);
        if (deals.length >= MAX_JSON_PRODUCTS) break;
      }
      console.log(`H&M: normalized ${deals.length} deals from JSON.`);
    }

    if (deals.length === 0) {
      console.log('No products in H&M JSON, using structured HTML (product articles)…');
    }

    // PL grid: JSON often returns total:0 while SSR/hydrated articles exist — always merge articles when JSON short.
    if (deals.length < MAX_JSON_PRODUCTS) {
      const htmlItems = await page.evaluate(() => {
        const normPrice = (s) => {
          if (!s) return null;
          const t = String(s).replace(/\u00a0/g, ' ').replace(/\s/g, '').replace(',', '.');
          const n = parseFloat(t.replace(/[^\d.]/g, ''));
          return Number.isFinite(n) ? String(n) : null;
        };

        const articles = Array.from(document.querySelectorAll('article[data-articlecode]')).slice(0, 80);
        const out = [];

        for (const article of articles) {
          const link = article.querySelector('a[href*="/productpage"]');
          if (!link) continue;
          const href = link.getAttribute('href') || '';
          const url = href.startsWith('http')
            ? href
            : `https://www2.hm.com${href.startsWith('/') ? '' : '/'}${href}`;
          let title =
            (link.getAttribute('title') || link.getAttribute('aria-label') || '').trim() ||
            (article.querySelector('h3, h2')?.innerText || '').trim();
          title = title.replace(/ZAPISZ W ULUBIONYCH/gi, '').replace(/\s+/g, ' ').trim();
          if (!title) continue;

          const imgEl = article.querySelector('img[data-src], img[srcset], img[src]');
          let img = imgEl?.getAttribute('data-src') || imgEl?.src || null;

          const t = article.innerText || '';
          let sale = null;
          let orig = null;

          const obn = t.match(/Obniżona cena\s*[\n\r]*\s*([\d\s,\u00a0]+)\s*PLN/i);
          if (obn) sale = normPrice(obn[1]);

          const reg = t.match(/Cena regularna\s*[\n\r]*\s*([\d\s,\u00a0]+)\s*PLN/i);
          const pop = t.match(/Poprzednia cena\s*[\n\r]*\s*([\d\s,\u00a0]+)\s*PLN/i);
          const naj = t.match(/Najniższa cena:?\s*[\n\r]*\s*([\d\s,\u00a0]+)\s*PLN/i);
          if (reg) orig = normPrice(reg[1]);
          else if (pop) orig = normPrice(pop[1]);
          else if (naj) orig = normPrice(naj[1]);

          if (!sale) {
            const prices = [];
            const re = /([\d\s,\u00a0]+)\s*PLN/g;
            let m;
            while ((m = re.exec(t)) !== null) {
              const v = normPrice(m[1]);
              if (v) prices.push(parseFloat(v));
            }
            if (prices.length >= 2) {
              sale = String(Math.min(...prices));
              orig = String(Math.max(...prices));
            } else if (prices.length === 1) {
              sale = String(prices[0]);
            }
          }

          if (!sale) continue;

          out.push({
            name: title,
            salePrice: sale,
            origPrice: orig,
            img,
            url,
            articleCode: article.getAttribute('data-articlecode'),
          });
        }
        return out;
      });

      const seenUrl = new Set(deals.map((d) => d.url).filter(Boolean));
      const hadJsonDeals = deals.length > 0;
      for (const item of htmlItems) {
        if (!item.name || !item.salePrice || !item.url) continue;
        if (seenUrl.has(item.url)) continue;
        seenUrl.add(item.url);

        let discount = null;
        if (item.origPrice && parseFloat(item.origPrice) > parseFloat(item.salePrice)) {
          const pct = Math.round(
            ((parseFloat(item.origPrice) - parseFloat(item.salePrice)) /
              parseFloat(item.origPrice)) *
              100
          );
          discount = `-${pct}%`;
        }

        deals.push({
          title: item.name,
          brand: 'H&M',
          category: 'Odzież',
          discount,
          price: item.salePrice,
          currency: 'PLN',
          url: item.url,
          image: item.img,
          description: 'Wyprzedaż H&M',
          valid_until: null,
          tags: ['Odzież', 'sale'],
          confidence_score: 0.92,
          source_type: 'dynamic_scrape',
          source_name: hadJsonDeals ? 'H&M HTML+API' : 'H&M HTML',
        });
        if (deals.length >= MAX_JSON_PRODUCTS) break;
      }
      if (htmlItems.length > 0) {
        console.log(`H&M: parsed ${htmlItems.length} product article(s) from DOM.`);
      }
    }
  } catch (e) {
    console.error('Error scraping H&M:', e.message);
  } finally {
    try {
      page.off('response', onListingResponse);
    } catch {
      /* page may be gone */
    }
    await browser.close();
  }

  console.log('Successfully extracted ' + deals.length + ' items from H&M');
  return deals;
}
