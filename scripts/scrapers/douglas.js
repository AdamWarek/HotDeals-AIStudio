import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

/** Random integer in [min, max] */
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

/** Human-like delay: random pause between minMs and maxMs */
const humanDelay = (minMs = 800, maxMs = 2200) =>
  new Promise(r => setTimeout(r, randInt(minMs, maxMs)));

/** Parse proxy URL → { server, username, password } */
function parseProxy(proxyUrl) {
  if (!proxyUrl) return null;
  try {
    const u = new URL(proxyUrl);
    return {
      server: `${u.protocol}//${u.hostname}${u.port ? ':' + u.port : ''}`,
      username: u.username ? decodeURIComponent(u.username) : null,
      password: u.password ? decodeURIComponent(u.password) : null,
    };
  } catch {
    // Bare host:port — treat as http
    return { server: proxyUrl.startsWith('http') ? proxyUrl : `http://${proxyUrl}`, username: null, password: null };
  }
}

/**
 * Resolve proxy config from available env vars.
 * Priority: SCRAPER_API_KEY (ScraperAPI) → SCRAPER_PROXY_URL (raw proxy).
 * ScraperAPI proxy: proxy-server.scraperapi.com:8001, user=scraperapi, pass=<key>
 */
function resolveProxy() {
  const apiKey = process.env.SCRAPER_API_KEY;
  if (apiKey) {
    return {
      server: 'http://proxy-server.scraperapi.com:8001',
      username: 'scraperapi',
      password: apiKey,
      source: 'ScraperAPI (SCRAPER_API_KEY)',
    };
  }
  const raw = parseProxy(process.env.SCRAPER_PROXY_URL);
  return raw ? { ...raw, source: 'SCRAPER_PROXY_URL' } : null;
}

// Rotate a small pool of realistic User-Agents so the same string isn't
// sent on every CI run (less fingerprint-able).
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
];

export async function scrapeDouglas() {
  console.log('--- Scraping Douglas (HTML + Proxy-aware) ---');

  const proxy = resolveProxy();
  if (proxy) {
    console.log(`Using proxy: ${proxy.server} via ${proxy.source} (auth: ${proxy.username ? 'yes' : 'no'})`);
  } else {
    console.log('No SCRAPER_API_KEY or SCRAPER_PROXY_URL set — attempting without proxy (may be blocked by Akamai).');
  }

  const launchArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-blink-features=AutomationControlled',
  ];
  if (proxy) {
    launchArgs.push(`--proxy-server=${proxy.server}`);
    // ScraperAPI (and most MITM proxies) present their own TLS cert — Chrome
    // rejects it with ERR_CERT_AUTHORITY_INVALID unless we opt out of cert checks.
    launchArgs.push('--ignore-certificate-errors');
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: launchArgs,
  });

  const page = await browser.newPage();

  // Proxy authentication (if credentials are embedded in the URL)
  if (proxy && proxy.username) {
    await page.authenticate({ username: proxy.username, password: proxy.password || '' });
  }

  // Random viewport close to a typical laptop — avoids uniform 1366×768 bot fingerprint
  await page.setViewport({
    width: randInt(1280, 1440),
    height: randInt(720, 900),
    deviceScaleFactor: 1,
  });

  const ua = USER_AGENTS[randInt(0, USER_AGENTS.length - 1)];
  await page.setUserAgent(ua);

  // Extra headers that a real browser would send
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  });

  // Pipe browser console to terminal for debugging
  page.on('console', msg => {
    if (msg.type() === 'log') console.log('BROWSER LOG:', msg.text());
  });

  const deals = [];

  try {
    // Brief pre-navigation pause — avoids instant-launch bot signature
    await humanDelay(500, 1500);

    console.log('1. Navigating to Douglas promotions page...');
    // Use the confirmed promo listing URL (the /sale/09 slug was redirecting)
    await page.goto('https://www.douglas.pl/pl/c/promocje/09', {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });

    // Detect Akamai/CDN block early — bail rather than burning time scrolling
    const title = await page.title();
    const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 200) ?? '');
    if (
      title.toLowerCase().includes('access denied') ||
      title.toLowerCase().includes('just a moment') ||
      bodyText.toLowerCase().includes('access denied')
    ) {
      console.warn(`Douglas: Bot protection detected (title="${title}"). Aborting — set SCRAPER_API_KEY (ScraperAPI) or SCRAPER_PROXY_URL to bypass Akamai.`);
      return deals;
    }

    // Wait for initial paint, then try to dismiss cookie banner
    await humanDelay(2000, 3500);
    console.log('2. Attempting to dismiss cookie consent banner...');
    try {
      // Douglas uses various selectors for its consent layer
      const consentSelectors = [
        'button[data-testid="uc-accept-all-button"]',
        'button[id*="accept"]',
        'button[class*="accept-all"]',
        '#onetrust-accept-btn-handler',
        'button[aria-label*="Zaakceptuj"]',
        '.consent-button--accept',
      ];
      for (const sel of consentSelectors) {
        const btn = await page.$(sel);
        if (btn) {
          await btn.click();
          console.log(`  Clicked consent button: ${sel}`);
          await humanDelay(1000, 2000);
          break;
        }
      }
    } catch (e) {
      console.log('  No consent banner found (or could not click it) — continuing.');
    }

    // Wait for product grid to appear
    console.log('3. Waiting for product tiles...');
    try {
      await page.waitForSelector(
        '.product-tile, [class*="product-tile"], [data-testid="product-tile"], a.product-tile__main-link',
        { timeout: 15000 }
      );
      console.log('  Product tiles detected.');
    } catch {
      console.log('  Timeout waiting for product tiles — page may still be loading. Continuing with scroll.');
    }

    // Gentle scroll — 8 iterations with randomised speed and pauses
    // This mimics reading behaviour rather than a bot hammering scroll.
    console.log('4. Slowly scrolling to trigger lazy-loaded products...');
    const scrollSteps = 8;
    for (let i = 0; i < scrollSteps; i++) {
      const scrollAmount = randInt(600, 1100);
      await page.evaluate((amt) => window.scrollBy({ top: amt, behavior: 'smooth' }), scrollAmount);
      // Longer pause mid-way to look like a human reading
      const pause = i === Math.floor(scrollSteps / 2) ? randInt(2500, 4000) : randInt(1200, 2500);
      await new Promise(r => setTimeout(r, pause));
    }

    // Scroll back to top then gently down — simulates a human reviewing the page
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await humanDelay(1000, 2000);
    await page.evaluate(() => window.scrollBy({ top: 2000, behavior: 'smooth' }));
    await humanDelay(1500, 2500);

    console.log('5. Extracting product data...');
    const items = await page.evaluate(() => {
      console.log('Evaluating page content...');

      // Broaden selector to catch both class variants Douglas uses
      const cards = Array.from(document.querySelectorAll(
        '.product-tile, [class*="product-tile"], [class*="ProductTile"], [data-testid="product-tile"], a.product-tile__main-link'
      )).slice(0, 100);
      console.log('Found ' + cards.length + ' potential product cards.');

      const seenUrls = new Set();
      const results = [];

      for (const card of cards) {
        // Brand & name
        const brandEl = card.querySelector(
          '.product-tile__brand, [class*="brand"], [data-testid="brand"]'
        );
        const nameEl = card.querySelector(
          '.product-tile__name, .product-tile__main-link, [class*="name"], h3, [data-testid="main-link"]'
        );

        // Price — try specific selectors first, fall back to any text containing "zł"
        let saleEl = card.querySelector(
          '.product-tile__price--sale, .price__sale, [class*="price-sale"], [class*="price-promo"], [class*="price-current"]'
        );
        let origEl = card.querySelector(
          '.product-tile__price--regular, .price__regular, [class*="price-regular"], [class*="price-old"], [class*="price-base"]'
        );

        if (!saleEl) {
          const spans = Array.from(card.querySelectorAll('span, div, p'));
          const priceEls = spans.filter(el => {
            const t = el.innerText.trim();
            return t.includes('zł') && t.length < 20 && /\d/.test(t);
          });
          if (priceEls.length > 0) {
            saleEl = priceEls[0];
            if (priceEls.length > 1) origEl = priceEls[1];
          }
        }

        let brand = brandEl ? brandEl.innerText.trim() : '';
        let name  = nameEl  ? nameEl.innerText.trim()  : '';

        if (!name && card.innerText.length > 10) {
          const lines = card.innerText.split('\n').map(l => l.trim()).filter(Boolean);
          if (!brand) brand = lines[0];
          name = lines.slice(1, 3).join(' ');
        }

        let fullTitle = (brand + ' ' + name).replace(/\s+/g, ' ').trim();
        if (fullTitle.length > 150) fullTitle = fullTitle.substring(0, 147) + '...';

        const imgEl  = card.querySelector('img');
        const linkEl = card.querySelector('a[href*="/pl/p/"]') || card.querySelector('a[href*="/p/"]') || card.querySelector('a');
        const url    = linkEl ? linkEl.href : null;

        if (url && seenUrls.has(url)) continue;
        if (url) seenUrls.add(url);

        results.push({
          name: fullTitle || null,
          salePrice: saleEl ? saleEl.innerText.trim() : null,
          origPrice: origEl ? origEl.innerText.trim() : null,
          img: imgEl ? (imgEl.getAttribute('data-src') || imgEl.src) : null,
          url,
        });
      }

      console.log('Douglas: ' + results.length + ' unique / ' + cards.length + ' total cards.');
      return results;
    });

    for (const item of items) {
      if (!item.name || !item.salePrice) continue;

      const cleanSale = item.salePrice.replace(/[^\d,]/g, '').replace(',', '.');
      const cleanOrig = item.origPrice ? item.origPrice.replace(/[^\d,]/g, '').replace(',', '.') : null;

      let discount = null;
      if (cleanOrig && parseFloat(cleanOrig) > parseFloat(cleanSale)) {
        const pct = Math.round(((parseFloat(cleanOrig) - parseFloat(cleanSale)) / parseFloat(cleanOrig)) * 100);
        discount = `-${pct}%`;
      }

      deals.push({
        title: item.name,
        brand: 'Douglas',
        category: 'Kosmetyki',
        discount,
        price: cleanSale,
        currency: 'PLN',
        url: item.url,
        image: item.img,
        description: 'Wyprzedaż Douglas',
        valid_until: null,
        tags: ['Kosmetyki', 'sale'],
        confidence_score: 1.0,
        source_type: 'dynamic_scrape',
        source_name: 'Douglas HTML',
      });
    }
  } catch (e) {
    console.error('Error scraping Douglas:', e.message);
  } finally {
    await browser.close();
  }

  console.log(`Successfully extracted ${deals.length} items from Douglas`);
  return deals;
}
