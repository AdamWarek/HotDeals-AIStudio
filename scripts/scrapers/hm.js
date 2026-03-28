import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

export async function scrapeHM() {
  console.log('--- Scraping H&M (API Approach) ---');
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
    if (url.includes('json') && (url.includes('product') || url.includes('listing'))) {
        console.log('H&M JSON RESPONSE:', url);
    }
  });

  // Pipe browser console to terminal
  page.on('console', msg => {
    if (msg.type() === 'log') console.log('BROWSER LOG:', msg.text());
  });

  const deals = [];

  try {
    // 1. Navigate to the main page first
    const mainUrl = 'https://www2.hm.com/pl_pl/index.html';
    console.log("Navigating to H&M main page...");
    await page.goto(mainUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 3000));

    // 2. Navigate to the sale page
    const salePageUrl = 'https://www2.hm.com/pl_pl/wyprzedaz/ona/view-all.html';
    console.log("Navigating to H&M sale page...");
    await page.goto(salePageUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    // Wait for product grid
    try {
        await page.waitForSelector('article[data-articlecode], .product-item', { timeout: 10000 });
        console.log("Product grid found on H&M.");
    } catch (e) {
        console.log("Product grid not found via selector, scrolling...");
        await page.evaluate(() => window.scrollBy(0, 1000));
        await new Promise(r => setTimeout(r, 3000));
    }

    // 2. Fetch the JSON data using the browser's fetch to include cookies
    const apiUrl = 'https://www2.hm.com/pl_pl/wyprzedaz/kobiety/view-all/_jcr_content/main/productlisting.display.json?offset=0&page-size=36';
    
    console.log("Fetching H&M sale data from JSON API via browser fetch...");
    let jsonContent = null;
    try {
        jsonContent = await page.evaluate(async (url) => {
            const response = await fetch(url);
            if (!response.ok) {
                // Try another fallback URL if 404
                const fallbackUrl = 'https://www2.hm.com/pl_pl/wyprzedaz/kobiety/_jcr_content/main/productlisting.display.json?offset=0&page-size=36';
                const fallbackResponse = await fetch(fallbackUrl);
                if (!fallbackResponse.ok) return null;
                return await fallbackResponse.json();
            }
            return await response.json();
        }, apiUrl);
    } catch (e) {
        console.log("JSON fetch failed, will try HTML fallback.");
    }

    if (jsonContent && jsonContent.products) {
        console.log(`Found ${jsonContent.products.length} products in H&M JSON.`);
        for (const product of jsonContent.products.slice(0, 15)) {
            deals.push({
                title: product.title,
                brand: "H&M",
                category: "Odzież",
                discount: product.discountMarker || null,
                price: product.price.replace(/[^\d,]/g, '').replace(',', '.'),
                currency: "PLN",
                url: "https://www2.hm.com" + product.link,
                image: product.image[0].src,
                description: "Wyprzedaż H&M",
                valid_until: null,
                tags: ["Odzież", "sale"],
                confidence_score: 1.0,
                source_type: "dynamic_scrape",
                source_name: "H&M API"
            });
        }
    } else {
        console.log("No products in H&M JSON, trying HTML fallback...");
        const htmlItems = await page.evaluate(() => {
            const cards = Array.from(document.querySelectorAll('article[data-articlecode], .product-item, [class*="product-item"]')).slice(0, 20);
            
            if (cards.length === 0) {
                // Try to find any links
                const links = Array.from(document.querySelectorAll('a[href*="/pl_pl/productpage"]')).slice(0, 5);
                console.log("Found " + links.length + " potential product links.");
            }
            
            // Try to find price elements first
            const priceEls = Array.from(document.querySelectorAll('*')).filter(el => {
                const text = el.innerText || '';
                return text.includes('PLN') && text.length < 20 && el.children.length === 0;
            });
            
            if (priceEls.length > 0) {
                return priceEls.map(priceEl => {
                    const card = priceEl.closest('article, li, [class*="item"], [class*="product"]');
                    if (!card) return null;
                    
                    const nameEl = card.querySelector('h3, a[title], [class*="title"], [class*="heading"]');
                    const imgEl = card.querySelector('img');
                    const linkEl = card.querySelector('a');
                    
                    let name = nameEl ? (nameEl.innerText || nameEl.getAttribute('title')).trim() : null;
                    if (name) name = name.replace(/ZAPISZ W ULUBIONYCH/gi, '').trim();

                    return {
                        name: name,
                        salePrice: priceEl.innerText.trim(),
                        origPrice: null,
                        img: imgEl ? (imgEl.getAttribute('data-src') || imgEl.src) : null,
                        url: linkEl ? linkEl.href : null
                    };
                }).filter(item => item && item.name && item.salePrice);
            }
        });
        
        for (const item of htmlItems) {
            if (!item.name || !item.salePrice) continue;
            deals.push({
                title: item.name,
                brand: "H&M",
                category: "Odzież",
                discount: null,
                price: item.salePrice.replace(/[^\d,]/g, '').replace(',', '.'),
                currency: "PLN",
                url: item.url,
                image: item.img,
                description: "Wyprzedaż H&M (HTML)",
                valid_until: null,
                tags: ["Odzież", "sale"],
                confidence_score: 0.8,
                source_type: "dynamic_scrape",
                source_name: "H&M HTML"
            });
        }
    }
  } catch (e) {
      console.error("Error scraping H&M:", e.message);
  } finally {
      await browser.close();
  }
  
  console.log("Successfully extracted " + deals.length + " items from H&M");
  return deals;
}
