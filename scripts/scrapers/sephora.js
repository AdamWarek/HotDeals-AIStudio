import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

const SEPHORA_SALE = 'https://www.sephora.pl/wyprzedaz/';

export async function scrapeSephora() {
  console.log('--- Scraping Sephora (Stealth Approach) ---');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  );
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7',
  });

  page.on('console', (msg) => {
    if (msg.type() === 'log') console.log('BROWSER LOG:', msg.text());
  });

  const deals = [];

  try {
    console.log('1. Navigating to Sephora wyprzedaz…');
    await page.goto(SEPHORA_SALE, { waitUntil: 'domcontentloaded', timeout: 60000 });

    try {
      console.log('Checking for cookie consent…');
      const cookieButton = await page.waitForSelector(
        '#onetrust-accept-btn-handler, .cookie-banner__accept, button[id*="accept"]',
        { timeout: 6000 }
      );
      if (cookieButton) {
        await cookieButton.click();
        console.log('Cookie consent accepted.');
        await new Promise((r) => setTimeout(r, 2000));
      }
    } catch {
      console.log('No cookie consent button found or timeout.');
    }

    console.log('2. Waiting for product grid / prices…');
    try {
      await page.waitForSelector(
        '#main [class*="product"], .product-listing, [class*="ProductList"], .product-tile, [data-tcproduct]',
        { timeout: 20000 }
      );
    } catch {
      console.log('Sephora: broad grid selector timeout, continuing…');
    }

    try {
      await page.waitForFunction(
        () => {
          const grid =
            document.querySelector('.product-listing, [class*="product-list"], [class*="ProductGrid"], #main');
          const scope = grid || document.body;
          return !!scope.querySelector(
            '[data-tcproduct], .price-sales, [class*="price-sales"], [data-testid="product-price-promo"]'
          );
        },
        { timeout: 25000 }
      );
    } catch {
      console.log('Sephora: price/hydration wait timeout, continuing with best-effort scrape…');
    }

    await new Promise((r) => setTimeout(r, 4000));

    console.log('3. Scrolling to load products…');
    for (let i = 0; i < 12; i++) {
      await page.evaluate(() => window.scrollBy(0, 1000));
      await new Promise((r) => setTimeout(r, 1400));
      try {
        const loadMore = await page.$(
          'button[class*="load-more"], .show-more, [class*="more-products"], button[class*="show-more"]'
        );
        if (loadMore) {
          await loadMore.click();
          console.log('Clicked Load More button');
          await new Promise((r) => setTimeout(r, 2500));
        }
      } catch {
        /* ignore */
      }
    }

    const items = await page.evaluate(() => {
      const grid =
        document.querySelector(
          '.product-listing, [class*="product-list"], [class*="ProductGrid"], [class*="plp"], #main [role="main"], main'
        ) || document.body;

      const cardSelectors = [
        '.product-tile',
        '[class*="ProductTile"]',
        '[class*="product-tile"]',
        '[data-tcproduct]',
        '[data-testid="product-tile"]',
        'li.product-item',
      ];
      const seen = new Set();
      let cards = [];
      for (const sel of cardSelectors) {
        grid.querySelectorAll(sel).forEach((el) => {
          if (seen.has(el)) return;
          seen.add(el);
          cards.push(el);
        });
      }
      if (cards.length > 80) cards = cards.slice(0, 80);

      console.log('Evaluating page content…');
      console.log('Scoped cards: ' + cards.length);

      function parseTcProduct(card) {
        const raw = card.getAttribute('data-tcproduct');
        if (!raw) return null;
        try {
          return JSON.parse(raw);
        } catch {
          return null;
        }
      }

      function extractPricesFromTc(tc) {
        if (!tc) return { sale: null, orig: null };
        const saleKeys = [
          'product_price_ati',
          'price_ati',
          'sales_price_ati',
          'product_price',
          'price',
        ];
        const origKeys = ['product_old_price_ati', 'old_price_ati', 'list_price_ati', 'base_price_ati'];
        let sale = null;
        let orig = null;
        for (const k of saleKeys) {
          if (tc[k] != null && tc[k] !== '') {
            sale = String(tc[k]).trim() + ' zł';
            break;
          }
        }
        for (const k of origKeys) {
          if (tc[k] != null && tc[k] !== '') {
            orig = String(tc[k]).trim() + ' zł';
            break;
          }
        }
        return { sale, orig };
      }

      function priceFromCardText(card) {
        const text = (card.innerText || '').replace(/\s+/g, ' ');
        const re = /(\d{1,3}(?:[\s\u00a0]?\d{3})*(?:[,.]\d{2})?)\s*zł/gi;
        const matches = [];
        let m;
        while ((m = re.exec(text)) !== null) {
          const idx = m.index;
          const slice = text.substring(idx, idx + 30);
          if (/\/\s*\d|\d\s*ml|\d\s*g\b|za\s+\d/i.test(slice)) continue;
          if (/najni|za szt|za opak|\/\s*100/i.test(slice)) continue;
          matches.push(m[0]);
        }
        if (matches.length >= 2) {
          const nums = matches.map((x) =>
            parseFloat(x.replace(/[^\d,]/g, '').replace(',', '.'))
          );
          const minI = nums.indexOf(Math.min(...nums));
          const maxI = nums.indexOf(Math.max(...nums));
          return { sale: matches[minI], orig: matches[maxI] };
        }
        if (matches.length === 1) return { sale: matches[0], orig: null };
        return { sale: null, orig: null };
      }

      return cards
        .map((card) => {
          const tc = parseTcProduct(card);
          const fromTc = extractPricesFromTc(tc);

          const brandEl = card.querySelector(
            '.product-brand, .brand, [class*="brand"], [data-testid="product-brand"]'
          );
          const nameEl = card.querySelector(
            '.product-title, .link, [class*="name"], h3, h4, .product-name, [data-testid="product-name"], [class*="title"]'
          );
          let saleEl = card.querySelector(
            '.price-sales, [class*="price--promo"], [class*="promo-price"], .price-promo, [data-testid="product-price-promo"], [class*="price-sales"]'
          );
          let origEl = card.querySelector(
            '.price-standard, [class*="price--base"], [class*="old-price"], .price-old, [data-testid="product-price-base"], [class*="price-standard"]'
          );

          let salePrice = fromTc.sale || (saleEl ? saleEl.innerText.trim() : null);
          let origPrice = fromTc.orig || (origEl ? origEl.innerText.trim() : null);

          if (!salePrice) {
            const fromText = priceFromCardText(card);
            salePrice = fromText.sale;
            if (!origPrice) origPrice = fromText.orig;
          }

          if (!salePrice && card.innerHTML) {
            const hm = card.innerHTML.match(/>([^<]*\d[\d\s,\u00a0]*\s*zł)/i);
            if (hm) salePrice = hm[1].replace(/^[\s>]+/, '').trim();
          }

          const allImgs = Array.from(card.querySelectorAll('img'));
          const imgEl =
            allImgs.find((img) => {
              const src = img.src || '';
              return !src.includes('svg') && !src.includes('icon') && !src.includes('wishlist');
            }) || allImgs[0];

          const linkEl = card.querySelector('a[href*="/p/"], a[href*="/product/"], a[href*="sephora.pl"]');

          let brand = brandEl ? brandEl.innerText.trim() : tc?.product_trademark || '';
          let name = nameEl ? nameEl.innerText.trim() : tc?.product_pid_name || tc?.product_name || '';
          let fullTitle = (brand + ' ' + name).replace(/\s+/g, ' ').trim();
          if (fullTitle.length > 150) fullTitle = fullTitle.substring(0, 147) + '...';

          if (!fullTitle || !salePrice) {
            console.log(
              'Skipping card: name=' +
                !!fullTitle +
                ', price=' +
                !!salePrice +
                ', text=' +
                card.innerText.substring(0, 50)
            );
          }

          return {
            name: fullTitle || null,
            salePrice,
            origPrice,
            img: imgEl ? imgEl.getAttribute('data-src') || imgEl.src : null,
            url: linkEl ? linkEl.href : null,
          };
        })
        .filter((row) => row.name && row.salePrice);
    });

    for (const item of items) {
      if (!item.name || !item.salePrice) continue;

      const cleanSale = item.salePrice.replace(/[^\d,]/g, '').replace(',', '.');
      const cleanOrig = item.origPrice ? item.origPrice.replace(/[^\d,]/g, '').replace(',', '.') : null;

      let discount = null;
      if (cleanOrig && parseFloat(cleanOrig) > parseFloat(cleanSale)) {
        const pct = Math.round(
          ((parseFloat(cleanOrig) - parseFloat(cleanSale)) / parseFloat(cleanOrig)) * 100
        );
        discount = `-${pct}%`;
      }

      deals.push({
        title: item.name,
        brand: 'Sephora',
        category: 'Kosmetyki',
        discount,
        price: cleanSale,
        original_price: cleanOrig ? `${parseFloat(cleanOrig).toFixed(2)} PLN` : undefined,
        currency: 'PLN',
        url: item.url,
        image: item.img,
        description: 'Promocja Sephora',
        valid_until: null,
        tags: ['Kosmetyki', 'sale'],
        confidence_score: 1.0,
        source_type: 'dynamic_scrape',
        source_name: 'Sephora Stealth',
      });
    }
  } catch (e) {
    console.error('Error scraping Sephora:', e.message);
  } finally {
    await browser.close();
  }

  console.log('Successfully extracted ' + deals.length + ' items from Sephora');
  return deals;
}
