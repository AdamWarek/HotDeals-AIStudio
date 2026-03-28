import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

export async function scrapeRossmann() {
  console.log('--- Scraping Rossmann (HTML Approach) ---');
  const browser = await puppeteer.launch({ 
    headless: "new", 
    args: ['--no-sandbox', '--disable-setuid-sandbox'] 
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
  
  const deals = [];

  try {
    await page.goto('https://www.rossmann.pl/promocje', { waitUntil: 'networkidle2', timeout: 45000 });
    
    // Wait for products to load
    try {
        await page.waitForSelector('.tile, [class*="product"], [class*="tile"], [data-testid="product-tile"]', { timeout: 15000 });
    } catch (e) {
        // Continue anyway
    }
    
    // Scroll loop to trigger lazy loading
    console.log("Scrolling to load more Rossmann products...");
    for (let i = 0; i < 8; i++) {
        await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight);
        });
        await new Promise(r => setTimeout(r, 2500));
        
        // Try to find and click "Pokaż więcej" button if it exists
        const clicked = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const moreBtn = buttons.find(b => b.innerText.includes('Pokaż więcej') || b.innerText.includes('Załaduj więcej'));
            if (moreBtn) {
                moreBtn.click();
                return true;
            }
            return false;
        });
        if (clicked) console.log("Clicked 'Load More' button.");
    }
    
    const items = await page.evaluate(() => {
        // Rossmann uses CSS modules, so classes have random suffixes
        const cards = Array.from(document.querySelectorAll('[class*="ProductTile-module_tile"], [class*="ProductTile_tile"], [data-testid="product-tile"], [class*="tile"]')).filter(el => el.innerText.includes('zł'));
        const slicedCards = cards.slice(0, 100);
        
        return slicedCards.map(card => {
            // Name is usually in a link or has a specific class
            const nameEl = card.querySelector('a[class*="ProductTile_name"], [class*="ProductTile_name"], h3, [data-testid="product-tile-name"]');
            // Price is in the priceBox
            const priceBox = card.querySelector('[class*="ProductTile_priceBox"], [data-testid="product-tile-price"]');
            
            // Regular price might be labeled "Cena regularna" or similar
            const origEl = card.querySelector('[class*="Price_old"], [class*="price-old"], .tile__price-old, [class*="ProductTile_oldPrice"]');
            
            let name = nameEl ? nameEl.innerText.trim() : null;
            let salePrice = null;

            // Find all spans or divs that look like price
            const priceCandidates = Array.from(card.querySelectorAll('span, div')).filter(el => {
                const text = el.innerText.trim();
                return (text.includes('zł') || text.match(/^\d+$/)) && 
                       !text.includes('Najniższa') && 
                       !text.includes('=') && 
                       text.length < 15 && 
                       el.children.length === 0;
            });

            if (priceCandidates.length > 0) {
                // Join all parts that look like they belong to the price
                // Rossmann often has integer and decimal in separate spans
                salePrice = priceCandidates.map(p => p.innerText.trim()).join(' ').replace(/\s+/, '');
                // If it doesn't have 'zł' yet, find it in parent
                if (!salePrice.includes('zł')) {
                    const fullText = card.innerText;
                    const match = fullText.match(/(\d+[,.]\d+)\s*zł/);
                    if (match) salePrice = match[0];
                }
            }
            
            if (!name || !salePrice) {
                const text = card.innerText;
                const lines = text.split('\n')
                    .map(l => l.trim())
                    .filter(l => l.length > 0 && !l.toLowerCase().includes('najniższa cena'));
                
                if (!name) {
                    const brandIdx = lines.findIndex(l => l === l.toUpperCase() && l.length > 2 && !l.includes('!') && !l.match(/^\d+[,.]\d+$/));
                    if (brandIdx !== -1 && lines[brandIdx+1]) {
                        name = lines[brandIdx] + " " + lines[brandIdx+1];
                    } else if (lines.length > 0) {
                        name = lines.slice(0, 2).join(' ');
                    }
                }
                
                if (!salePrice) {
                    const priceLine = lines.find(l => l.includes('zł') && !l.includes('='));
                    if (priceLine) salePrice = priceLine;
                }
            }

            // Clean name from rating
            if (name) name = name.replace(/^\d+[,.]\d+\s+/, '').trim();

            const imgEl = card.querySelector('img');
            const linkEl = card.querySelector('a');

            return {
                name: name,
                salePrice: salePrice,
                origPrice: origEl ? origEl.innerText.trim() : null,
                img: imgEl ? (imgEl.getAttribute('data-src') || imgEl.src) : null,
                url: linkEl ? linkEl.href : null
            };
        });
    });

    for (const item of items) {
        if (!item.name || !item.salePrice) continue;

        // Allow digits, commas, and dots. Then normalize to dot.
        const cleanSale = item.salePrice.replace(/[^\d,.]/g, '').replace(',', '.');
        if (!cleanSale || parseFloat(cleanSale) === 0) continue;

        const cleanOrig = item.origPrice ? item.origPrice.replace(/[^\d,.]/g, '').replace(',', '.') : null;
        
        let discount = null;
        if (cleanOrig && parseFloat(cleanOrig) > parseFloat(cleanSale)) {
            const pct = Math.round(((parseFloat(cleanOrig) - parseFloat(cleanSale)) / parseFloat(cleanOrig)) * 100);
            discount = `-${pct}%`;
        }

        deals.push({
            title: item.name,
            brand: "Rossmann",
            category: "Kosmetyki",
            discount: discount,
            price: cleanSale,
            currency: "PLN",
            url: item.url,
            image: item.img,
            description: "Promocja Rossmann",
            valid_until: null,
            tags: ["Kosmetyki", "sale"],
            confidence_score: 1.0,
            source_type: "dynamic_scrape",
            source_name: "Rossmann HTML"
        });
    }
  } catch (e) {
      console.error("Error scraping Rossmann:", e.message);
  } finally {
      await browser.close();
  }
  
  console.log("Successfully extracted " + deals.length + " items from Rossmann");
  return deals;
}
