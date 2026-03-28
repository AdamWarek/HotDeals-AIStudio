import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

export async function scrapeSephora() {
  console.log('--- Scraping Sephora (Stealth Approach) ---');
  const browser = await puppeteer.launch({ 
    headless: "new", 
    args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled'
    ] 
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

  const deals = [];

  try {
    // Sephora is very sensitive, we add a longer wait and human-like delays
    console.log("Navigating to Sephora promotions...");
    await page.goto('https://www.sephora.pl/promocje/', { waitUntil: 'networkidle2', timeout: 60000 });
    
    // Extra wait for JS hydration
    await new Promise(r => setTimeout(r, 8000));

    const items = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('.product-tile, [class*="product-tile"], [class*="ProductTile"], .product-item')).slice(0, 15);
        return cards.map(card => {
            const nameEl = card.querySelector('.link, [class*="name"], h3, h4');
            const saleEl = card.querySelector('.price-sales, [class*="price--promo"], [class*="promo-price"], .price-promo, .price-sales');
            const origEl = card.querySelector('.price-standard, [class*="price--base"], [class*="old-price"], .price-old, .price-standard');
            const imgEl = card.querySelector('img');
            const linkEl = card.querySelector('a');

            return {
                name: nameEl ? nameEl.innerText.trim() : null,
                salePrice: saleEl ? saleEl.innerText.trim() : null,
                origPrice: origEl ? origEl.innerText.trim() : null,
                img: imgEl ? imgEl.src : null,
                url: linkEl ? linkEl.href : null
            };
        });
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
            brand: "Sephora",
            category: "Kosmetyki",
            discount: discount,
            price: cleanSale,
            currency: "PLN",
            url: item.url,
            image: item.img,
            description: "Promocja Sephora",
            valid_until: null,
            tags: ["Kosmetyki", "sale"],
            confidence_score: 1.0,
            source_type: "dynamic_scrape",
            source_name: "Sephora Stealth"
        });
    }
  } catch (e) {
      console.error("Error scraping Sephora:", e.message);
  } finally {
      await browser.close();
  }
  
  console.log("Successfully extracted " + deals.length + " items from Sephora");
  return deals;
}
