import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { inditexDetailMainImageUrl } from '../lib/inditexImage.js';

puppeteer.use(StealthPlugin());

export async function scrapePullAndBear() {
  console.log('--- Scraping Pull&Bear (API Hybrid Approach) ---');
  const browser = await puppeteer.launch({ 
    headless: "new", 
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-web-security',
      '--ignore-certificate-errors'
    ] 
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

  const deals = [];

  try {
    console.log("1. Navigating to Pull&Bear to solve bot protection...");
    await page.goto('https://www.pullandbear.com/pl/', { waitUntil: 'networkidle2', timeout: 45000 });

    console.log("2. Extracting dynamic IDs and finding Sale category...");
    const saleData = await page.evaluate(`(async () => {
        const inditex = window.inditex || {};
        const storeId = inditex.iStoreId;
        const catalogId = inditex.iCatalogId;
        const languageId = inditex.iLanguageId || '-22';
        
        if (!storeId || !catalogId) return null;

        const catUrl = 'https://www.pullandbear.com/itxrest/2/catalog/store/' + storeId + '/' + catalogId + '/category?languageId=' + languageId + '&typeCatalog=1&appId=1';
        const catRes = await fetch(catUrl);
        const catData = await catRes.json();
        
        let foundCategoryId = null;
        function searchCategories(categories, path) {
            for (let i = 0; i < categories.length; i++) {
                const cat = categories[i];
                const currentPath = path + " > " + cat.name;
                const nameLower = cat.name.toLowerCase();
                if (nameLower.includes('promocj') || nameLower.includes('wyprzeda') || nameLower.includes('sale')) {
                    if (currentPath.toLowerCase().includes('niej') || currentPath.toLowerCase().includes('kobieta')) {
                         return cat.id; 
                    }
                    foundCategoryId = cat.id;
                }
                if (cat.subcategories && !foundCategoryId) {
                    const subResult = searchCategories(cat.subcategories, currentPath);
                    if (subResult) return subResult;
                }
            }
            return foundCategoryId;
        }
        
        const saleCategoryId = searchCategories(catData.categories, "");
        return { storeId, catalogId, languageId, saleCategoryId };
    })()`);

    if (saleData && saleData.saleCategoryId) {
        console.log("3. Fetching product IDs for category " + saleData.saleCategoryId + "...");
        const productsData = await page.evaluate(`(async () => {
            const prodUrl = 'https://www.pullandbear.com/itxrest/3/catalog/store/${saleData.storeId}/${saleData.catalogId}/category/${saleData.saleCategoryId}/product?languageId=${saleData.languageId}&appId=1';
            const res = await fetch(prodUrl);
            return await res.json();
        })()`);
        
        const productIds = productsData.productIds || [];
        console.log("Found " + productIds.length + " product IDs.");
        
        // Take top 20 products
        const topProductIds = productIds.slice(0, 20);
        
        if (topProductIds.length > 0) {
            console.log("4. Fetching details for top " + topProductIds.length + " products...");
            const idsString = topProductIds.join(',');
            
            const productDetail = await page.evaluate(`(async () => {
                const detailUrl = 'https://www.pullandbear.com/itxrest/3/catalog/store/${saleData.storeId}/${saleData.catalogId}/productsArray?languageId=${saleData.languageId}&productIds=${idsString}&appId=1';
                const res = await fetch(detailUrl);
                return await res.json();
            })()`);
            
            // Parse the details
            for (const product of productDetail.products || []) {
                const name = product.name;
                // Clean up name for URL
                const urlName = product.name.replace(/\\s+/g, '-').toLowerCase();
                const url = "https://www.pullandbear.com/pl/" + urlName + "-c0p" + product.id + ".html";
                
                for (const summary of product.bundleProductSummaries || []) {
                    if (!summary.detail || !summary.detail.colors) continue;
                    
                    // Just take the first color variant for the deal list to avoid duplicates
                    if (summary.detail.colors.length > 0) {
                        const color = summary.detail.colors[0];
                        const imageUrl = inditexDetailMainImageUrl(summary.detail, {
                            legacyHost: 'static.pullandbear.net',
                            legacyPathPrefix: '/2/photos',
                            legacySuffix: '_2_1_8.jpg',
                        });
                        
                        let currentPrice = null;
                        let oldPrice = null;
                        let discount = null;
                        
                        for (const size of color.sizes || []) {
                            if (size.price) {
                                currentPrice = parseInt(size.price) / 100;
                                if (size.oldPrice) {
                                    oldPrice = parseInt(size.oldPrice) / 100;
                                }
                                if (size.discountsPercentages && size.discountsPercentages.oldPriceDiscount) {
                                    discount = "-" + size.discountsPercentages.oldPriceDiscount + "%";
                                }
                                break;
                            }
                        }
                        
                        if (currentPrice) {
                            deals.push({
                                title: name,
                                brand: "Pull&Bear",
                                category: "Odzież",
                                discount: discount,
                                price: currentPrice.toString(),
                                currency: "PLN",
                                url: url,
                                image: imageUrl,
                                description: summary.detail.longDescription || "Wyprzedaż Pull&Bear",
                                valid_until: null,
                                tags: ["Odzież", "sale"],
                                confidence_score: 1.0,
                                source_type: "dynamic_scrape",
                                source_name: "Pull&Bear API"
                            });
                        }
                    }
                }
            }
        }
    } else {
        console.log("Could not find Pull&Bear sale category or configuration.");
    }
  } catch (e) {
      console.error("Error scraping Pull&Bear:", e.message);
  } finally {
      await browser.close();
  }
  
  console.log("Successfully extracted " + deals.length + " items from Pull&Bear");
  return deals;
}
