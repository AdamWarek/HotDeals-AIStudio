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

  page.on('console', msg => {
    if (msg.type() === 'log') console.log('BROWSER LOG:', msg.text());
  });

  const deals = [];

  try {
    // Sephora is very sensitive, we add a longer wait and human-like delays
    console.log("1. Navigating to Sephora wyprzedaz...");
    await page.goto('https://www.sephora.pl/wyprzedaz/', { waitUntil: 'networkidle2', timeout: 60000 });
    
    // Try to handle cookie consent
    try {
        console.log("Checking for cookie consent...");
        const cookieButton = await page.waitForSelector('#onetrust-accept-btn-handler, .cookie-banner__accept, button[id*="accept"]', { timeout: 5000 });
        if (cookieButton) {
            await cookieButton.click();
            console.log("Cookie consent accepted.");
            await new Promise(r => setTimeout(r, 2000));
        }
    } catch (e) {
        console.log("No cookie consent button found or timeout.");
    }

    // Extra wait for JS hydration
    console.log("2. Waiting for JS hydration...");
    await new Promise(r => setTimeout(r, 10000));

    // Scroll multiple times and check for Load More
    console.log("3. Scrolling to load products...");
    for (let i = 0; i < 15; i++) {
        await page.evaluate(() => window.scrollBy(0, 1000));
        await new Promise(r => setTimeout(r, 1500));
        
        // Try to click Load More if visible
        try {
            const loadMore = await page.$('button[class*="load-more"], .show-more, [class*="more-products"], button[class*="show-more"]');
            if (loadMore) {
                await loadMore.click();
                console.log("Clicked Load More button");
                await new Promise(r => setTimeout(r, 3000));
            }
        } catch (e) {
            // Ignore click errors
        }
    }

    // Wait for any product-like element
    try {
        await page.waitForSelector('.product-tile, [class*="product-tile"], [class*="product-item"], [class*="ProductTile"]', { timeout: 10000 });
    } catch (e) {
        console.log("Timeout waiting for product grid, continuing with evaluation...");
    }

    const items = await page.evaluate(() => {
        console.log("Evaluating page content...");
        // Sephora product tiles: use a more inclusive selector
        const cards = Array.from(document.querySelectorAll('.product-tile, [class*="product-tile"], [class*="ProductTile"], .product-item, [data-testid="product-tile"], [class*="product-card"]')).slice(0, 150);
        console.log("Found " + cards.length + " potential product cards.");
        
        if (cards.length === 0) {
            console.log("No cards found with primary selectors, trying fallback...");
            console.log("Body text snippet:", document.body.innerText.substring(0, 500));
            // Try to find any links that might be products
            const links = Array.from(document.querySelectorAll('a[href*="/p/"], a[href*="/product/"]'));
            console.log("Found " + links.length + " potential product links.");
            
            const extractedFromLinks = [];
            const seenUrls = new Set();

            for (const link of links) {
                const url = link.href;
                if (seenUrls.has(url)) continue;
                seenUrls.add(url);

                // Find a parent that might be a card (usually within 5-8 levels)
                let card = link;
                let foundCard = false;
                for (let i = 0; i < 8; i++) {
                    if (!card.parentElement) break;
                    card = card.parentElement;
                    // Check if this parent looks like a card (has price, image, etc.)
                    const hasPrice = card.innerText.includes('zł');
                    const hasImg = card.querySelector('img');
                    if (hasPrice && hasImg) {
                        foundCard = true;
                        break;
                    }
                }

                if (foundCard) {
                    const name = link.innerText.trim() || card.innerText.split('\n')[0].trim();
                    const priceMatch = card.innerText.match(/(\d+[,.]\d+)\s*zł/g);
                    
                    if (priceMatch && name.length > 3) {
                        extractedFromLinks.push({
                            name: name,
                            salePrice: priceMatch[0],
                            origPrice: priceMatch.length > 1 ? priceMatch[1] : null,
                            img: card.querySelector('img')?.src || null,
                            url: url
                        });
                    }
                }
                if (extractedFromLinks.length >= 100) break;
            }

            if (extractedFromLinks.length > 0) return extractedFromLinks;
        }

        return processCards(cards);

        function processCards(cardsToProcess) {
            return cardsToProcess.map(card => {
                // Try to use JSON data from data-tcproduct if available
                const tcDataRaw = card.getAttribute('data-tcproduct');
                let tcData = null;
                if (tcDataRaw) {
                    try {
                        tcData = JSON.parse(tcDataRaw);
                    } catch (e) {
                        console.log("JSON Parse error for card: " + e.message);
                    }
                }

                const brandEl = card.querySelector('.product-brand, .brand, [class*="brand"], [data-testid="product-brand"]');
                const nameEl = card.querySelector('.product-title, .link, [class*="name"], h3, h4, .product-name, [data-testid="product-name"], [class*="title"]');
                const saleEl = card.querySelector('.price-sales, [class*="price--promo"], [class*="promo-price"], .price-promo, .price-sales, [data-testid="product-price-promo"], [class*="price-sales"]');
                const origEl = card.querySelector('.price-standard, [class*="price--base"], [class*="old-price"], .price-old, .price-standard, [data-testid="product-price-base"], [class*="price-standard"]');
                
                // Fallback for price
                let salePrice = saleEl ? saleEl.innerText.trim() : null;
                if (!salePrice && tcData && tcData.product_price_ati) {
                    salePrice = tcData.product_price_ati + " zł";
                }
                
                // Aggressive price finding
                if (!salePrice) {
                    const textToSearch = (card.textContent + " " + card.innerText).replace(/\s+/g, ' ');
                    const priceMatches = textToSearch.match(/(\d+[\s,.]*\d*)\s*(zł|PLN)/gi) || [];
                    const filtered = priceMatches.filter(p => {
                        const idx = textToSearch.indexOf(p);
                        const after = textToSearch.substring(idx + p.length, idx + p.length + 10);
                        return !after.includes('/') && !after.toLowerCase().includes('za');
                    });
                    if (filtered.length > 0) salePrice = filtered[0];
                }

                // If still no price, try to find any element with a price-like class or text
                if (!salePrice) {
                    const potentialPriceEls = Array.from(card.querySelectorAll('*')).filter(el => 
                        el.children.length === 0 && 
                        /(\d+[\s,.]*\d*)\s*(zł|PLN)/i.test(el.textContent || el.innerText) &&
                        !(el.textContent || el.innerText).includes('/')
                    );
                    if (potentialPriceEls.length > 0) salePrice = (potentialPriceEls[0].textContent || potentialPriceEls[0].innerText).trim();
                }
                
                // Last ditch effort: search innerHTML for price pattern
                if (!salePrice) {
                    const htmlMatches = card.innerHTML.match(/>\s*(\d+[\s,.]*\d*)\s*(zł|PLN)\s*</gi);
                    if (htmlMatches && htmlMatches.length > 0) {
                        salePrice = htmlMatches[0].replace(/[><]/g, '').trim();
                    }
                }

                let origPrice = origEl ? origEl.innerText.trim() : null;
                if (!origPrice && tcData && tcData.product_old_price_ati) {
                    origPrice = tcData.product_old_price_ati + " zł";
                }
                if (!origPrice) {
                    const priceMatches = card.innerText.match(/(\d+[\s,.]*\d*)\s*(zł|PLN)/gi) || [];
                    const filtered = priceMatches.filter(p => {
                        const idx = card.innerText.indexOf(p);
                        const after = card.innerText.substring(idx + p.length, idx + p.length + 10);
                        return !after.includes('/') && !after.toLowerCase().includes('za');
                    });
                    if (filtered.length > 1) {
                        // Try to identify which is which by parsing
                        const p1 = parseFloat(filtered[0].replace(/[^\d,.]/g, '').replace(',', '.'));
                        const p2 = parseFloat(filtered[1].replace(/[^\d,.]/g, '').replace(',', '.'));
                        if (!isNaN(p1) && !isNaN(p2)) {
                            salePrice = p1 < p2 ? filtered[0] : filtered[1];
                            origPrice = p1 < p2 ? filtered[1] : filtered[0];
                        }
                    }
                }

                // Better image selection: avoid icons
                const allImgs = Array.from(card.querySelectorAll('img'));
                const imgEl = allImgs.find(img => {
                    const src = img.src || "";
                    return !src.includes('svg') && !src.includes('icon') && !src.includes('wishlist');
                }) || allImgs[0];

                const linkEl = card.querySelector('a');

                let brand = brandEl ? brandEl.innerText.trim() : (tcData ? tcData.product_trademark : "");
                let name = nameEl ? nameEl.innerText.trim() : (tcData ? tcData.product_pid_name : "");
                
                let fullTitle = (brand + " " + name).replace(/\s+/g, ' ').trim();
                if (fullTitle.length > 150) fullTitle = fullTitle.substring(0, 147) + "...";

                if (!fullTitle || !salePrice) {
                    console.log("Skipping card: name=" + !!fullTitle + ", price=" + !!salePrice + ", text=" + card.innerText.substring(0, 50));
                }

                return {
                    name: fullTitle || null,
                    salePrice: salePrice,
                    origPrice: origPrice,
                    img: imgEl ? (imgEl.getAttribute('data-src') || imgEl.src) : null,
                    url: linkEl ? linkEl.href : null
                };
            });
        }
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
