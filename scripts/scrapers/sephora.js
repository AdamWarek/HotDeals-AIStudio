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
    await page.goto(SEPHORA_SALE, { waitUntil: 'networkidle2', timeout: 60000 });

    // Diagnostic: log page title + snippet to detect challenge pages
    const pageInfo = await page.evaluate(() => ({
      title: document.title,
      snippet: document.body?.innerText?.substring(0, 200) || '',
    }));
    console.log('Sephora: page title:', pageInfo.title);
    if (/checking your browser|attention required|access denied/i.test(pageInfo.snippet)) {
      console.log('Sephora: Cloudflare/bot challenge detected. Skipping.');
      await browser.close();
      return deals;
    }

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

    console.log('2. Waiting for JS hydration…');
    await new Promise((r) => setTimeout(r, 8000));

    console.log('3. Scrolling to load products…');
    for (let i = 0; i < 15; i++) {
      await page.evaluate(() => window.scrollBy(0, 1000));
      await new Promise((r) => setTimeout(r, 1500));
      try {
        const loadMore = await page.$(
          'button[class*="load-more"], .show-more, [class*="more-products"], button[class*="show-more"]'
        );
        if (loadMore) {
          await loadMore.click();
          console.log('Clicked Load More button');
          await new Promise((r) => setTimeout(r, 3000));
        }
      } catch {
        /* ignore */
      }
    }

    const items = await page.evaluate(() => {
      // --- helpers (defined inside evaluate) ---
      function parseTcProduct(card) {
        const raw = card.getAttribute('data-tcproduct');
        if (!raw) return null;
        try { return JSON.parse(raw); } catch { return null; }
      }

      function extractPricesFromTc(tc) {
        if (!tc) return { sale: null, orig: null };
        const saleKeys = ['product_price_ati', 'price_ati', 'sales_price_ati', 'product_price', 'price'];
        const origKeys = ['product_old_price_ati', 'old_price_ati', 'list_price_ati', 'base_price_ati'];
        let sale = null, orig = null;
        for (const k of saleKeys) { if (tc[k] != null && tc[k] !== '') { sale = String(tc[k]).trim() + ' zł'; break; } }
        for (const k of origKeys) { if (tc[k] != null && tc[k] !== '') { orig = String(tc[k]).trim() + ' zł'; break; } }
        return { sale, orig };
      }

      function isUnitPriceText(raw) {
        const text = String(raw || '').replace(/\s+/g, ' ').toLowerCase();
        if (!text) return false;
        // Exclude common unit price patterns (e.g. "129,99 zł / 100 g").
        return /\/\s*(?:\d+\s*)?(?:g|kg|ml|l)\b|na\s*100\s*(?:g|kg|ml|l)\b|za\s*100\s*(?:g|kg|ml|l)\b/.test(text);
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
          const nums = matches.map((x) => parseFloat(x.replace(/[^\d,]/g, '').replace(',', '.')));
          const minI = nums.indexOf(Math.min(...nums));
          const maxI = nums.indexOf(Math.max(...nums));
          return { sale: matches[minI], orig: matches[maxI] };
        }
        if (matches.length === 1) return { sale: matches[0], orig: null };
        return { sale: null, orig: null };
      }

      function extractCard(card) {
        const tc = parseTcProduct(card);
        const fromTc = extractPricesFromTc(tc);

        const brandEl = card.querySelector('.product-brand, .brand, [class*="brand"], [data-testid="product-brand"]');
        const nameEl = card.querySelector('.product-title, .link, [class*="name"], h3, h4, .product-name, [data-testid="product-name"], [class*="title"]');
        let saleEl = card.querySelector('.price-sales, [class*="price--promo"], [class*="promo-price"], .price-promo, [data-testid="product-price-promo"], [class*="price-sales"]');
        let origEl = card.querySelector('.price-standard, [class*="price--base"], [class*="old-price"], .price-old, [data-testid="product-price-base"], [class*="price-standard"]');

        const saleFromDom = saleEl ? saleEl.innerText.trim() : null;
        const origFromDom = origEl ? origEl.innerText.trim() : null;

        // Prefer visible main DOM prices for Sephora; telemetry fields can include unit-price values.
        let salePrice = !isUnitPriceText(saleFromDom) ? saleFromDom : null;
        let origPrice = !isUnitPriceText(origFromDom) ? origFromDom : null;

        if (!salePrice && fromTc.sale && !isUnitPriceText(fromTc.sale)) salePrice = fromTc.sale;
        if (!origPrice && fromTc.orig && !isUnitPriceText(fromTc.orig)) origPrice = fromTc.orig;

        if (!salePrice) { const ft = priceFromCardText(card); salePrice = ft.sale; if (!origPrice) origPrice = ft.orig; }
        if (!salePrice && card.innerHTML) { const hm = card.innerHTML.match(/>([^<]*\d[\d\s,\u00a0]*\s*zł)/i); if (hm) salePrice = hm[1].replace(/^[\s>]+/, '').trim(); }

        if (isUnitPriceText(salePrice)) salePrice = null;
        if (isUnitPriceText(origPrice)) origPrice = null;

        const allImgs = Array.from(card.querySelectorAll('img'));
        const imgEl = allImgs.find((img) => { const src = img.src || ''; return !src.includes('svg') && !src.includes('icon') && !src.includes('wishlist'); }) || allImgs[0];
        const linkEl = card.querySelector('a[href*="/p/"], a[href*="/product/"], a[href*="sephora.pl"]');

        let brand = brandEl ? brandEl.innerText.trim() : tc?.product_trademark || '';
        let name = nameEl ? nameEl.innerText.trim() : tc?.product_pid_name || tc?.product_name || '';
        let fullTitle = (brand + ' ' + name).replace(/\s+/g, ' ').trim();
        if (fullTitle.length > 150) fullTitle = fullTitle.substring(0, 147) + '...';

        return {
          name: fullTitle || null,
          salePrice,
          origPrice,
          img: imgEl ? imgEl.getAttribute('data-src') || imgEl.src : null,
          url: linkEl ? linkEl.href : null,
        };
      }

      // --- Strategy 1: scoped card selectors ---
      const cardSelectors = [
        '.product-tile',
        '[class*="ProductTile"]',
        '[class*="product-tile"]',
        '[data-tcproduct]',
        '[data-testid="product-tile"]',
        'li.product-item',
        '.product-card',
        '[class*="product-card"]',
      ];
      const seen = new Set();
      let cards = [];
      for (const sel of cardSelectors) {
        document.querySelectorAll(sel).forEach((el) => {
          if (seen.has(el)) return;
          seen.add(el);
          cards.push(el);
        });
      }

      // Diagnostic
      const diagProductCount = document.querySelectorAll('[class*="product"]').length;
      const diagLinkCount = document.querySelectorAll('a[href*="/p/"]').length;
      console.log('Sephora diag: [class*="product"] count=' + diagProductCount + ', a[href*="/p/"] count=' + diagLinkCount);
      console.log('Card selectors matched: ' + cards.length);

      if (cards.length > 80) cards = cards.slice(0, 80);

      if (cards.length > 0) {
        return cards.map(extractCard).filter((row) => row.name && row.salePrice);
      }

      // --- Strategy 2: link-based fallback (a[href*="/p/"]) ---
      console.log('Sephora: no cards from selectors, trying link-based fallback…');
      const links = Array.from(document.querySelectorAll('a[href*="/p/"], a[href*="/product/"]'));
      const extractedFromLinks = [];
      const seenUrls = new Set();

      for (const link of links) {
        const url = link.href;
        if (!url || seenUrls.has(url)) continue;
        seenUrls.add(url);

        let card = link;
        let foundCard = false;
        for (let i = 0; i < 8; i++) {
          if (!card.parentElement) break;
          card = card.parentElement;
          const hasPrice = (card.innerText || '').includes('zł');
          const hasImg = card.querySelector('img');
          if (hasPrice && hasImg) { foundCard = true; break; }
        }

        if (foundCard) {
          const result = extractCard(card);
          if (!result.url) result.url = url;
          if (result.name && result.salePrice) {
            extractedFromLinks.push(result);
          }
        }
        if (extractedFromLinks.length >= 80) break;
      }

      console.log('Sephora: link-based fallback found ' + extractedFromLinks.length + ' items');
      return extractedFromLinks;
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
