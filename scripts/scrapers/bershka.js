import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { inditexDetailMainImageUrl } from '../lib/inditexImage.js';

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

  // Pipe browser console to terminal
  page.on('console', msg => {
    if (msg.type() === 'log') console.log('BROWSER LOG:', msg.text());
  });

  const deals = [];

  try {
    console.log("1. Navigating to Bershka to solve bot protection...");
    await page.goto('https://www.bershka.com/pl/', { waitUntil: 'networkidle2', timeout: 45000 });

    console.log("2. Extracting dynamic IDs and finding Sale category...");
    const saleData = await page.evaluate(`(async () => {
        let inditex = window.inditex || {};
        
        console.log("Initial inditex object:", JSON.stringify(inditex));

        // If inditex object is missing or incomplete, try to find it in scripts
        if (!inditex.iStoreId || !inditex.iCatalogId) {
            const scripts = Array.from(document.querySelectorAll('script'));
            for (const s of scripts) {
                const text = s.innerText;
                if (text.includes('iStoreId')) {
                    console.log("Found script with iStoreId");
                    const storeMatch = text.match(/iStoreId\\s*:\\s*['"]?(\\d+)['"]?/);
                    if (storeMatch) inditex.iStoreId = storeMatch[1];
                    const catMatch = text.match(/iCatalogId\\s*:\\s*['"]?(\\d+)['"]?/);
                    if (catMatch) inditex.iCatalogId = catMatch[1];
                    const langMatch = text.match(/iLanguageId\\s*:\\s*['"]?(-?\\d+)['"]?/);
                    if (langMatch) inditex.iLanguageId = langMatch[1];
                }
            }
        }

        const storeId = inditex.iStoreId || '44009421'; 
        const catalogId = inditex.iCatalogId || '40259535';
        const languageId = inditex.iLanguageId || inditex.iLangId || '-46'; 
        
        console.log("Using IDs:", JSON.stringify({ storeId, catalogId, languageId }));

        const catUrl = 'https://www.bershka.com/itxrest/2/catalog/store/' + storeId + '/' + catalogId + '/category?languageId=' + languageId + '&typeCatalog=1&appId=1';
        console.log("Fetching categories from:", catUrl);
        
        try {
            const catRes = await fetch(catUrl);
            if (!catRes.ok) throw new Error("Category fetch failed: " + catRes.status);
            const catData = await catRes.json();
            
            if (!catData.categories) {
                console.log("No categories field in response:", JSON.stringify(catData).substring(0, 200));
                return null;
            }

            console.log("Root categories count:", catData.categories.length);
            if (catData.categories.length > 0) {
                console.log("First root category keys:", Object.keys(catData.categories[0]).join(', '));
                console.log("First root category sample:", JSON.stringify(catData.categories[0]).substring(0, 500));
            }
            
            let foundCategoryId = null;
            function searchCategories(categories, path) {
                for (let i = 0; i < categories.length; i++) {
                    const cat = categories[i];
                    const catName = cat.name || cat.label || "";
                    const currentPath = path + " > " + catName;
                    const nameLower = catName.toLowerCase();
                    
                    const isSale = nameLower.includes('promocj') || 
                                   nameLower.includes('wyprzeda') || 
                                   nameLower.includes('sale') || 
                                   nameLower.includes('special prices') ||
                                   nameLower.includes('okazje') ||
                                   nameLower.includes('procent') ||
                                   nameLower.includes('mid season');
                                   
                    if (isSale) {
                        console.log("Found potential sale category:", currentPath, "ID:", cat.id);
                        // Prefer Woman/Kobieta categories
                        if (currentPath.toLowerCase().includes('kobieta') || currentPath.toLowerCase().includes('woman')) {
                             return cat.id; 
                        }
                        if (!foundCategoryId) foundCategoryId = cat.id;
                    }
                    if (cat.subcategories) {
                        const subResult = searchCategories(cat.subcategories, currentPath);
                        if (subResult) return subResult;
                    }
                }
                return foundCategoryId;
            }
            
            let saleCategoryId = searchCategories(catData.categories, "");
            
            if (!saleCategoryId) {
                console.log("Recursive search failed, trying flat search...");
                const flatCategories = [];
                function flatten(cats) {
                    cats.forEach(c => {
                        flatCategories.push(c);
                        if (c.subcategories) flatten(c.subcategories);
                    });
                }
                flatten(catData.categories);
                const saleCat = flatCategories.find(c => {
                    const name = (c.name || c.label || "").toLowerCase();
                    return name.includes('sale') || 
                           name.includes('wyprzeda') ||
                           name.includes('promocja');
                });
                if (saleCat) {
                    console.log("Flat search found:", saleCat.name || saleCat.label, "ID:", saleCat.id);
                    saleCategoryId = saleCat.id;
                }
            }
            
            return { storeId, catalogId, languageId, saleCategoryId };
        } catch (err) {
            console.log("Error in evaluate:", err.message);
            return null;
        }
    })()`);

    if (saleData && saleData.saleCategoryId) {
        console.log("3. Navigating to category page to sniff product API URL...");
        const categoryUrl = `https://www.bershka.com/pl/kobieta/special-prices-c${saleData.saleCategoryId}.html`;
        console.log("Navigating to:", categoryUrl);
        
        const interceptedUrls = [];
        page.on('request', request => {
            const url = request.url();
            if (url.includes('itxrest') && (url.includes('product') || url.includes('productsArray'))) {
                interceptedUrls.push(url);
            }
        });

        try {
            await page.goto(categoryUrl, { waitUntil: 'networkidle2', timeout: 30000 });
            // Wait a bit for extra requests
            await new Promise(r => setTimeout(r, 3000));
        } catch (err) {
            console.log("Navigation error (might be okay if we got URLs):", err.message);
        }

        console.log("Intercepted URLs:", interceptedUrls.length);
        
        let productIds = [];
        let foundUrl = null;

        // Try to fetch from intercepted URLs or construct one
        const urlsToTry = [...new Set(interceptedUrls)];
        
        // Add constructed ones as fallback
        const storeId = saleData.storeId;
        const catalogId = saleData.catalogId;
        const categoryId = saleData.saleCategoryId;
        const languageId = saleData.languageId;
        
        urlsToTry.push(`https://www.bershka.com/itxrest/3/catalog/store/${storeId}/${catalogId}/category/${categoryId}/product?languageId=${languageId}&showProducts=false&appId=1`);
        urlsToTry.push(`https://www.bershka.com/itxrest/3/catalog/store/${storeId}/${catalogId}/category/${categoryId}/product?languageId=${languageId}&appId=1`);

        for (const url of urlsToTry) {
            console.log("Trying product URL:", url);
            try {
                const res = await page.evaluate(async (fetchUrl) => {
                    const r = await fetch(fetchUrl);
                    if (!r.ok) return null;
                    return await r.json();
                }, url);
                
                if (res && (res.productIds || res.products)) {
                    productIds = res.productIds || (res.products ? res.products.map(p => p.id) : []);
                    if (productIds.length > 0) {
                        console.log("Found " + productIds.length + " products using:", url);
                        foundUrl = url;
                        break;
                    }
                }
            } catch (err) {
                console.log("Error fetching from intercepted URL:", err.message);
            }
        }
        
        console.log("Final product IDs count:", productIds.length);
        
        // Take top 20 products
        const topProductIds = productIds.slice(0, 20);
        
        if (topProductIds.length > 0) {
            console.log("4. Fetching details for top " + topProductIds.length + " products...");
            const idsString = topProductIds.join(',');
            
            const productDetail = await page.evaluate(`(async () => {
                const detailUrl = 'https://www.bershka.com/itxrest/3/catalog/store/${saleData.storeId}/${saleData.catalogId}/productsArray?languageId=${saleData.languageId}&productIds=${idsString}&appId=1';
                console.log("Fetching details from:", detailUrl);
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
                        const imageUrl = inditexDetailMainImageUrl(summary.detail, {
                            legacyHost: 'static.bershka.net',
                            legacyPathPrefix: '/4/photos2',
                            legacySuffix: '_2_1_4.jpg',
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
