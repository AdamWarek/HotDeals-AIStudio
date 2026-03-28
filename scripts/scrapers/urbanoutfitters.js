import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

export async function scrapeUrbanOutfitters() {
  console.log('--- Scraping Urban Outfitters (API Approach) ---');
  const browser = await puppeteer.launch({ 
    headless: "new", 
    args: ['--no-sandbox', '--disable-setuid-sandbox'] 
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

  // Sniff responses
  page.on('response', response => {
    const url = response.url();
    if (url.includes('api') && (url.includes('product') || url.includes('search'))) {
        console.log('UO API RESPONSE:', url);
    }
  });

  // Pipe browser console to terminal
  page.on('console', msg => {
    if (msg.type() === 'log') console.log('BROWSER LOG:', msg.text());
  });

    await page.setExtraHTTPHeaders({
        'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7',
    });

    const deals = [];

    try {
        // 1. Navigate to the main page first
        const mainUrl = 'https://www.urbanoutfitters.com/pl-pl/';
        console.log("Navigating to Urban Outfitters main page...");
        await page.goto(mainUrl, { waitUntil: 'networkidle2', timeout: 60000 });
        await new Promise(r => setTimeout(r, 5000));

        // 2. Navigate to the sale page
        const saleUrl = 'https://www.urbanoutfitters.com/pl-pl/shop/sale';
        console.log("Navigating to Urban Outfitters sale page...");
        await page.goto(saleUrl, { waitUntil: 'networkidle2', timeout: 60000 });
        await new Promise(r => setTimeout(r, 5000));

    // Wait a bit for requests to fire
    await new Promise(r => setTimeout(r, 5000));
    
    // 2. Try to extract JSON from the page source or HTML fallback
    const extractedDeals = await page.evaluate(() => {
        const results = [];
        
        // Try to find JSON in script tags
        const scripts = Array.from(document.querySelectorAll('script'));
        for (const script of scripts) {
            const text = script.innerText;
            if (text.includes('window.__INITIAL_STATE__') || text.includes('window.__PRELOADED_STATE__') || text.includes('INITIAL_STATE')) {
                try {
                    const match = text.match(/\{.*\}/s);
                    if (match) {
                        const state = JSON.parse(match[0]);
                        const products = state?.productListing?.products || state?.catalog?.products || [];
                        if (products.length > 0) {
                            console.log(`Found ${products.length} products in UO state.`);
                            return products.map(p => ({
                                title: p.name || p.productName,
                                brand: "Urban Outfitters",
                                category: "Odzież",
                                price: (p.salePrice || p.price || "").toString(),
                                currency: "PLN",
                                url: `https://www.urbanoutfitters.com${p.url}`,
                                image: p.primaryImage || p.image,
                                description: "Wyprzedaż Urban Outfitters",
                                tags: ["Odzież", "sale"],
                                confidence_score: 0.9,
                                source_type: "dynamic_scrape",
                                source_name: "Urban Outfitters API"
                            }));
                        }
                    }
                } catch (e) {}
            }
        }

        // HTML Fallback
        console.log("UO JSON failed, trying HTML fallback...");
        const priceEls = Array.from(document.querySelectorAll('*')).filter(el => {
            const text = el.innerText || '';
            return (text.includes('zł') || text.includes('PLN')) && text.length < 20 && el.children.length === 0;
        });
        
        return priceEls.map(priceEl => {
            const card = priceEl.closest('article, li, [class*="item"], [class*="product"]');
            if (!card) return null;
            
            const nameEl = card.querySelector('h3, a[title], [class*="title"], [class*="heading"]');
            const imgEl = card.querySelector('img');
            const linkEl = card.querySelector('a');
            
            return {
                title: nameEl ? nameEl.innerText.trim() : "Produkt Urban Outfitters",
                brand: "Urban Outfitters",
                category: "Odzież",
                price: priceEl.innerText.trim().replace(/[^\d.,]/g, '').replace(',', '.'),
                currency: "PLN",
                url: linkEl ? linkEl.href : null,
                image: imgEl ? (imgEl.getAttribute('data-src') || imgEl.src) : null,
                description: "Wyprzedaż Urban Outfitters (HTML)",
                tags: ["Odzież", "sale"],
                confidence_score: 0.8,
                source_type: "dynamic_scrape",
                source_name: "Urban Outfitters HTML"
            };
        }).filter(item => item && item.url && item.price && item.title !== "Produkt Urban Outfitters");
    });

    if (extractedDeals && extractedDeals.length > 0) {
        deals.push(...extractedDeals.slice(0, 30));
    }
  } catch (e) {
      console.error("Error scraping Urban Outfitters:", e.message);
  } finally {
      await browser.close();
  }
  
  console.log("Successfully extracted " + deals.length + " items from Urban Outfitters");
  return deals;
}
