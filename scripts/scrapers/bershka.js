import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

export async function scrapeBershka() {
  console.log('--- Scraping Bershka (API Hybrid Approach) ---');
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
    console.log("1. Navigating to Bershka to solve bot protection...");
    await page.goto('https://www.bershka.com/pl/', { waitUntil: 'networkidle2', timeout: 45000 });

    console.log("2. Extracting dynamic IDs and finding Sale category...");
    const saleData = await page.evaluate(`(async () => {
        const inditex = window.inditex || {};
        const storeId = inditex.iStoreId || '44009421'; // Fallback to PL store
        const catalogId = inditex.iCatalogId || '40259535';
        const languageId = inditex.iLanguageId || '-46'; // Polish
        
        const catUrl = 'https://www.bershka.com/itxrest/2/catalog/store/' + storeId + '/' + catalogId + '/category?languageId=' + languageId + '&typeCatalog=1&appId=1';
        const catRes = await fetch(catUrl);
        const catData = await catRes.json();
        
        let foundCategoryId = null;
        function searchCategories(categories, path) {
            for (let i = 0; i < categories.length; i++) {
                const cat = categories[i];
                const currentPath = path + " > " + cat.name;
                const nameLower = cat.name.toLowerCase();
                // Look for "Wyprzedaż", "Sale", "Promocja", "Special Prices"
                const isSale = nameLower.includes('promocj') || 
                               nameLower.includes('wyprzeda') || 
                               nameLower.includes('sale') || 
                               nameLower.includes('special prices') ||
                               nameLower.includes('okazje');
                               
                if (isSale) {
                    // Prefer Woman/Kobieta categories if possible
                    if (currentPath.toLowerCase().includes('kobieta') || currentPath.toLowerCase().includes('woman')) {
                         return cat.id; 
                    }
                    foundCategoryId = cat.id;
                }
                if (cat.subcategories) {
                    const subResult = searchCategories(cat.subcategories, currentPath);
                    if (subResult) return subResult;
                }
            }
            return foundCategoryId;
        }
        
        let saleCategoryId = searchCategories(catData.categories, "");
        
        // Fallback to a known sale category ID if not found (this ID is common for Bershka PL Sale)
        if (!saleCategoryId) {
            saleCategoryId = '1010193133'; // Common ID for Bershka PL Sale
        }
        
        return { storeId, catalogId, languageId, saleCategoryId };
    })()`);

    if (saleData && saleData.saleCategoryId) {
        console.log("3. Fetching product IDs for category " + saleData.saleCategoryId + "...");
        const productsData = await page.evaluate(`(async () => {
            const prodUrl = 'https://www.bershka.com/itxrest/3/catalog/store/${saleData.storeId}/${saleData.catalogId}/category/${saleData.saleCategoryId}/product?languageId=${saleData.languageId}&appId=1';
            const res = await fetch(prodUrl);
            return await res.json();
        })()`);
        
        const productIds = productsData.productIds || [];
        console.log("Found " + productIds.length + " product IDs.");
        
        // Take top 10 products
        const topProductIds = productIds.slice(0, 10);
        
        if (topProductIds.length > 0) {
            console.log("4. Fetching details for top " + topProductIds.length + " products...");
            const idsString = topProductIds.join(',');
            
            const productDetail = await page.evaluate(`(async () => {
                const detailUrl = 'https://www.bershka.com/itxrest/3/catalog/store/${saleData.storeId}/${saleData.catalogId}/productsArray?languageId=${saleData.languageId}&productIds=${idsString}&appId=1';
                const res = await fetch(detailUrl);
                return await res.json();
            })()`);
            
            // Parse the details
            for (const product of productDetail.products || []) {
                const name = product.name;
                const urlName = product.name.replace(/\\s+/g, '-').toLowerCase();
                const url = "https://www.bershka.com/pl/" + urlName + "-c0p" + product.id + ".html";
                
                for (const summary of product.bundleProductSummaries || []) {
                    if (!summary.detail || !summary.detail.colors) continue;
                    
                    if (summary.detail.colors.length > 0) {
                        const color = summary.detail.colors[0];
                        // Bershka image URL pattern
                        const imageUrl = color.image && color.image.url ? "https://static.bershka.net/4/photos2" + color.image.url + "_2_1_4.jpg" : null;
                        
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
                                brand: "Bershka",
                                category: "Odzież",
                                discount: discount,
                                price: currentPrice.toString(),
                                currency: "PLN",
                                url: url,
                                image: imageUrl,
                                description: summary.detail.longDescription || "Wyprzedaż Bershka",
                                valid_until: null,
                                tags: ["Odzież", "sale"],
                                confidence_score: 1.0,
                                source_type: "dynamic_scrape",
                                source_name: "Bershka API"
                            });
                        }
                    }
                }
            }
        }
    } else {
        console.log("Could not find Bershka sale category or configuration.");
    }
  } catch (e) {
      console.error("Error scraping Bershka:", e.message);
  } finally {
      await browser.close();
  }
  
  console.log("Successfully extracted " + deals.length + " items from Bershka");
  return deals;
}
