import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

async function testSephora() {
  console.log('--- Testing Sephora Scraper ---');
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

  try {
    console.log("1. Navigating to Sephora wyprzedaz...");
    await page.goto('https://www.sephora.pl/wyprzedaz/', { waitUntil: 'networkidle2', timeout: 60000 });
    
    // Check for bot detection
    const title = await page.title();
    console.log("Page Title:", title);
    if (title.includes("Access Denied") || title.includes("Pardon Our Interruption")) {
        console.log("BOT DETECTED!");
        await new Promise(r => setTimeout(r, 10000));
        await browser.close();
        return;
    }

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

    // Scroll multiple times
    console.log("3. Scrolling to load products...");
    for (let i = 0; i < 10; i++) {
        await page.evaluate(() => window.scrollBy(0, 1000));
        await new Promise(r => setTimeout(r, 1500));
    }

    const stats = await page.evaluate(() => {
        const cards = document.querySelectorAll('.product-tile, [class*="product-tile"], [class*="ProductTile"], .product-item, [data-testid="product-tile"], [class*="product-card"]');
        const links = document.querySelectorAll('a[href*="/p/"], a[href*="/product/"]');
        const loadMore = document.querySelector('button[class*="load-more"], .show-more, [class*="more-products"], button[class*="show-more"]');
        const pagination = document.querySelector('.pagination, [class*="paging"]');
        return {
            cardsCount: cards.length,
            linksCount: links.length,
            bodyLength: document.body.innerText.length,
            firstCardClasses: cards[0] ? cards[0].className : 'none',
            hasLoadMore: !!loadMore,
            loadMoreText: loadMore ? loadMore.innerText : null,
            hasPagination: !!pagination
        };
    });

    console.log("Stats:", stats);

    if (stats.hasLoadMore) {
        console.log("Attempting to click Load More...");
        await page.click('button[class*="load-more"], .show-more, [class*="more-products"], button[class*="show-more"]');
        await new Promise(r => setTimeout(r, 5000));
        const newCount = await page.evaluate(() => document.querySelectorAll('.product-tile').length);
        console.log("New card count:", newCount);
    }

    if (stats.cardsCount > 0) {
        const sample = await page.evaluate(() => {
            const card = document.querySelector('.product-tile, [class*="product-tile"], [class*="ProductTile"], .product-item, [data-testid="product-tile"], [class*="product-card"]');
            return {
                html: card.outerHTML.substring(0, 500),
                text: card.innerText
            };
        });
        console.log("Sample Card HTML:", sample.html);
        console.log("Sample Card Text:", sample.text);
    }

  } catch (e) {
      console.error("Error:", e.message);
  } finally {
      await new Promise(r => setTimeout(r, 5000));
      await browser.close();
  }
}

testSephora();
