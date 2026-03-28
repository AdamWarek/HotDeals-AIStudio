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

  const deals = [];

  try {
    // 1. Navigate to the sale page first to establish session/cookies
    const salePageUrl = 'https://www2.hm.com/pl_pl/wyprzedaz/kobiety/view-all.html';
    console.log("Navigating to H&M sale page...");
    await page.goto(salePageUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    // 2. Fetch the JSON data using the browser's fetch to include cookies
    const apiUrl = 'https://www2.hm.com/pl_pl/wyprzedaz/kobiety/_jcr_content/main/productlisting.display.json?page=0&page-size=36&sort=ascPrice&format=json';
    
    console.log("Fetching H&M sale data from JSON API via browser fetch...");
    const jsonContent = await page.evaluate(async (url) => {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    }, apiUrl);

    if (jsonContent && jsonContent.products) {
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
    }
  } catch (e) {
      console.error("Error scraping H&M:", e.message);
  } finally {
      await browser.close();
  }
  
  console.log("Successfully extracted " + deals.length + " items from H&M");
  return deals;
}
