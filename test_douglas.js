import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

async function testDouglas() {
  console.log('--- Testing Douglas Scraper ---');
  const browser = await puppeteer.launch({ 
    headless: "new", 
    args: ['--no-sandbox', '--disable-setuid-sandbox'] 
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

  try {
    console.log("1. Navigating to Douglas promotions...");
    await page.goto('https://www.douglas.pl/pl/c/sale/09', { waitUntil: 'networkidle2', timeout: 45000 });
    
    // Check for bot detection
    const title = await page.title();
    console.log("Page Title:", title);

    // Scroll more to trigger lazy loading
    console.log("3. Scrolling to load more products...");
    for (let i = 0; i < 5; i++) {
        await page.evaluate(() => window.scrollBy(0, 1000));
        await new Promise(r => setTimeout(r, 2000));
    }

    const stats = await page.evaluate(() => {
        const cards = document.querySelectorAll('.product-tile, [class*="product-tile"], [class*="ProductTile"], [data-testid="product-tile"]');
        return {
            cardsCount: cards.length,
            bodyLength: document.body.innerText.length,
            firstCardClasses: cards[0] ? cards[0].className : 'none'
        };
    });

    console.log("Stats:", stats);

    if (stats.cardsCount > 0) {
        const sample = await page.evaluate(() => {
            const card = document.querySelector('.product-tile, [class*="product-tile"], [class*="ProductTile"], [data-testid="product-tile"]');
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
      await browser.close();
  }
}

testDouglas();
