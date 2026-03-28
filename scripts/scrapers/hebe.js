import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

export async function scrapeHebe() {
  console.log('--- Scraping Hebe (HTML Approach) ---');
  const browser = await puppeteer.launch({ 
    headless: "new", 
    args: ['--no-sandbox', '--disable-setuid-sandbox'] 
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
  
  const deals = [];

  try {
    await page.goto('https://www.hebe.pl/promocje/', { waitUntil: 'networkidle2', timeout: 45000 });
    
    // Wait for products
    try {
        await page.waitForSelector('.product-tile.js-product-tile', { timeout: 15000 });
    } catch (e) {
        // Continue anyway
    }
    
    // Scroll loop to trigger lazy loading
    console.log("Scrolling to load more Hebe products...");
    for (let i = 0; i < 10; i++) {
        await page.evaluate(() => {
            window.scrollBy(0, 800);
        });
        await new Promise(r => setTimeout(r, 1000));
    }
    
    // Specifically scroll to each product tile to ensure images load
    console.log("Triggering lazy loading for each product tile...");
    await page.evaluate(async () => {
        const cards = Array.from(document.querySelectorAll('.product-tile.js-product-tile')).slice(0, 60);
        for (const card of cards) {
            card.scrollIntoView();
            await new Promise(r => setTimeout(r, 200));
        }
    });
    await new Promise(r => setTimeout(r, 3000));
    
    const items = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('.product-tile.js-product-tile')).slice(0, 60);
        
        return cards.map(card => {
            // Extract from GTM data attribute
            let gtmData = {};
            try {
                const gtmAttr = card.getAttribute('data-product-gtm');
                if (gtmAttr) gtmData = JSON.parse(gtmAttr);
            } catch (e) {}

            const brand = gtmData.item_brand || card.querySelector('.product-tile__name')?.innerText.trim();
            const desc = gtmData.item_description || card.querySelector('.product-tile__description')?.innerText.trim();
            const salePrice = gtmData.price || gtmData.current_price;
            const origPrice = gtmData.regular_price;
            
            let name = "";
            if (brand) name += brand + " ";
            if (desc) name += desc;
            
            const allImgs = Array.from(card.querySelectorAll('img'));
            const linkEl = card.querySelector('a');

            let img = null;
            for (const imgEl of allImgs) {
                const candidate = imgEl.getAttribute('data-src') || 
                                  imgEl.getAttribute('data-lazy-src') || 
                                  imgEl.getAttribute('srcset')?.split(' ')[0] || 
                                  imgEl.src;
                
                if (candidate && candidate.length > 10 && !candidate.includes('placeholder')) {
                    img = candidate;
                    break;
                }
            }
            
            if (img && img.startsWith('//')) img = 'https:' + img;
            if (img && img.startsWith('/')) img = 'https://www.hebe.pl' + img;

            return {
                name: name.trim() || null,
                salePrice: salePrice ? salePrice.toString() : null,
                origPrice: origPrice ? origPrice.toString() : null,
                img: img,
                url: linkEl ? linkEl.href : null
            };
        });
    });

    for (const item of items) {
        if (!item.name || !item.salePrice) continue;

        // Allow digits, commas, and dots. Then normalize to dot.
        const cleanSale = item.salePrice.replace(/[^\d,.]/g, '').replace(',', '.');
        const cleanOrig = item.origPrice ? item.origPrice.replace(/[^\d,.]/g, '').replace(',', '.') : null;
        
        let discount = null;
        if (cleanOrig && parseFloat(cleanOrig) > parseFloat(cleanSale)) {
            const pct = Math.round(((parseFloat(cleanOrig) - parseFloat(cleanSale)) / parseFloat(cleanOrig)) * 100);
            discount = `-${pct}%`;
        }

        deals.push({
            title: item.name,
            brand: "Hebe",
            category: "Kosmetyki",
            discount: discount,
            price: cleanSale,
            currency: "PLN",
            url: item.url,
            image: item.img,
            description: "Promocja Hebe",
            valid_until: null,
            tags: ["Kosmetyki", "sale"],
            confidence_score: 1.0,
            source_type: "dynamic_scrape",
            source_name: "Hebe HTML"
        });
    }
  } catch (e) {
      console.error("Error scraping Hebe:", e.message);
  } finally {
      await browser.close();
  }
  
  console.log("Successfully extracted " + deals.length + " items from Hebe");
  return deals;
}
