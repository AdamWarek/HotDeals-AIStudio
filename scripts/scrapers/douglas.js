import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

export async function scrapeDouglas() {
  console.log('--- Scraping Douglas (HTML Approach) ---');
  const browser = await puppeteer.launch({ 
    headless: "new", 
    args: ['--no-sandbox', '--disable-setuid-sandbox'] 
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

  // Pipe browser console to terminal
  page.on('console', msg => {
    if (msg.type() === 'log') console.log('BROWSER LOG:', msg.text());
  });

  const deals = [];

  try {
    console.log("1. Navigating to Douglas promotions...");
    await page.goto('https://www.douglas.pl/pl/c/sale/09', { waitUntil: 'networkidle2', timeout: 45000 });
    
    // Wait for products
    console.log("2. Waiting for product elements...");
    try {
        await page.waitForSelector('.product-tile, [class*="product"], [class*="tile"], [data-testid="product-tile"]', { timeout: 15000 });
    } catch (e) {
        console.log("Timeout waiting for specific Douglas selectors, trying generic approach...");
    }
    
    // Scroll more to trigger lazy loading
    console.log("3. Scrolling to load more products...");
    for (let i = 0; i < 15; i++) {
        await page.evaluate(() => window.scrollBy(0, 1000));
        await new Promise(r => setTimeout(r, 1500));
    }

    const items = await page.evaluate(() => {
        console.log("Evaluating page content...");
        const cards = Array.from(document.querySelectorAll('.product-tile, [class*="product-tile"], [class*="ProductTile"], [data-testid="product-tile"]')).slice(0, 200);
        console.log("Found " + cards.length + " potential product cards.");

        const seenUrls = new Set();
        const results = [];

        for (const card of cards) {
            const brandEl = card.querySelector('.product-tile__brand, [class*="brand"]');
            const nameEl = card.querySelector('.product-tile__main-link, [class*="name"], h3, [data-testid="main-link"]');

            let saleEl = card.querySelector('.price__sale, [class*="price-sale"], .price-sales, [class*="price-promo"], [class*="price-current"]');
            let origEl = card.querySelector('.price__regular, [class*="price-regular"], .price-standard, [class*="price-old"], [class*="price-base"]');

            if (!saleEl) {
                const allSpans = Array.from(card.querySelectorAll('span, div, p'));
                const priceElements = allSpans.filter(el => {
                    const text = el.innerText.trim();
                    return text.includes('zł') && text.length < 20 && /\d/.test(text);
                });
                if (priceElements.length > 0) {
                    saleEl = priceElements[0];
                    if (priceElements.length > 1) origEl = priceElements[1];
                }
            }

            let brand = brandEl ? brandEl.innerText.trim() : "";
            let name = nameEl ? nameEl.innerText.trim() : "";

            if (!name && card.innerText.length > 10) {
                const lines = card.innerText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                if (!brand) brand = lines[0];
                name = lines.slice(1, 3).join(' ');
            }

            let fullTitle = (brand + " " + name).replace(/\s+/g, ' ').trim();
            if (fullTitle.length > 150) fullTitle = fullTitle.substring(0, 147) + "...";

            const imgEl = card.querySelector('img');
            const linkEl = card.querySelector('a');
            const url = linkEl ? linkEl.href : null;

            // Source-level dedup by URL
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

        console.log("Douglas: " + results.length + " unique / " + cards.length + " total cards.");
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
            brand: "Douglas",
            category: "Kosmetyki",
            discount: discount,
            price: cleanSale,
            currency: "PLN",
            url: item.url,
            image: item.img,
            description: "Wyprzedaż Douglas",
            valid_until: null,
            tags: ["Kosmetyki", "sale"],
            confidence_score: 1.0,
            source_type: "dynamic_scrape",
            source_name: "Douglas HTML"
        });
    }
  } catch (e) {
      console.error("Error scraping Douglas:", e.message);
  } finally {
      await browser.close();
  }
  
  console.log("Successfully extracted " + deals.length + " items from Douglas");
  return deals;
}
