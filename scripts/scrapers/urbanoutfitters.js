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

  const deals = [];

  try {
    // 1. Navigate to the main site first
    const mainUrl = 'https://www.urbanoutfitters.com/pl-pl/';
    console.log("Navigating to Urban Outfitters...");
    await page.goto(mainUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    // 2. Fetch the JSON data using browser fetch
    const apiUrl = 'https://api.urbanoutfitters.com/api/products?category=sale&start=0&rows=48&country=PL&currency=PLN';
    
    console.log("Fetching Urban Outfitters sale data from API via browser fetch...");
    const jsonContent = await page.evaluate(async (url) => {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    }, apiUrl);

    if (jsonContent && jsonContent.products) {
        for (const product of jsonContent.products.slice(0, 10)) {
            const salePrice = product.sale_price || product.price;
            const origPrice = product.original_price || product.price;
            let discount = null;
            
            if (origPrice > salePrice) {
                const pct = Math.round(((origPrice - salePrice) / origPrice) * 100);
                discount = `-${pct}%`;
            }

            deals.push({
                title: product.product_name,
                brand: "Urban Outfitters",
                category: "Odzież",
                discount: discount,
                price: salePrice.toString(),
                currency: "PLN",
                url: "https://www.urbanoutfitters.com/pl-pl/shop/" + product.slug,
                image: product.primary_image_url,
                description: "Wyprzedaż Urban Outfitters",
                valid_until: null,
                tags: ["Odzież", "sale"],
                confidence_score: 1.0,
                source_type: "dynamic_scrape",
                source_name: "UO API"
            });
        }
    }
  } catch (e) {
      console.error("Error scraping Urban Outfitters:", e.message);
  } finally {
      await browser.close();
  }
  
  console.log("Successfully extracted " + deals.length + " items from Urban Outfitters");
  return deals;
}
