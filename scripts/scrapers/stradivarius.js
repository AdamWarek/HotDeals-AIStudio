import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

export async function scrapeStradivarius() {
  console.log('Starting Stradivarius API scraper...');
  
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    console.log('Navigating to Stradivarius to solve bot protection...');
    await page.goto('https://www.stradivarius.com/pl/kobieta/wyprzedaz-c1020280596.html', { waitUntil: 'networkidle2', timeout: 45000 });

    console.log('Extracting dynamic IDs...');
    const inditexData = await page.evaluate(() => {
      if (window.inditex && window.inditex.iSeoParamMap) {
        let catalogId = null;
        const catalogs = window.inditex.iSeoParamMap.catalogId;
        for (const id in catalogs) {
          if (catalogs[id] === 'stradivarius') {
            catalogId = id;
            break;
          }
        }
        
        let storeId = null;
        const stores = window.inditex.iSeoParamMap.storeId;
        for (const id in stores) {
          if (stores[id] === 'pl') {
            storeId = id;
            break;
          }
        }
        
        let languageId = null;
        const langs = window.inditex.iSeoParamMap.langId;
        for (const id in langs) {
          if (langs[id] === 'pl') {
            languageId = id;
            break;
          }
        }
        
        return { storeId, catalogId, languageId };
      }
      return null;
    });

    if (!inditexData || !inditexData.storeId || !inditexData.catalogId) {
      throw new Error('Could not find window.inditex object. Page might be blocked.');
    }

    const { storeId, catalogId, languageId } = inditexData;
    
    console.log('Fetching category tree...');
    const catUrl = `https://www.stradivarius.com/itxrest/2/catalog/store/${storeId}/${catalogId}/category?languageId=${languageId}&typeCatalog=1`;
    
    const categories = await page.evaluate(async (url) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      return data.categories;
    }, catUrl);
    
    // Find the "Special prices" or "Wyprzedaż" category
    let saleCategory = null;
    
    function findSaleCategory(cats) {
      for (const cat of cats) {
        // Try known sale/special prices IDs
        const knownIds = ['1020470597', '1020096049', '1020470588', '1020716770', '1020269549', '1020480589'];
        if (knownIds.includes(cat.id.toString())) {
          saleCategory = cat;
          return true;
        }
        if (cat.subcategories && cat.subcategories.length > 0) {
          if (findSaleCategory(cat.subcategories)) return true;
        }
      }
      return false;
    }
    
    if (!findSaleCategory(categories)) {
      // Fallback to name search
      function findSaleCategoryByName(cats) {
        for (const cat of cats) {
          if (cat.name && (cat.name.toLowerCase() === 'wyprzedaż' || cat.name.toLowerCase() === 'special prices')) {
            saleCategory = cat;
            return true;
          }
          if (cat.subcategories && cat.subcategories.length > 0) {
            if (findSaleCategoryByName(cat.subcategories)) return true;
          }
        }
        return false;
      }
      findSaleCategoryByName(categories);
    }
    
    let categoryIdsToFetch = [];
    
    if (saleCategory) {
      console.log(`Found Sale Category: ${saleCategory.name} (ID: ${saleCategory.id})`);
      if (saleCategory.subcategories && saleCategory.subcategories.length > 0) {
        function collectLeafCategories(cat) {
          if (!cat.subcategories || cat.subcategories.length === 0) {
            categoryIdsToFetch.push(cat.id);
          } else {
            for (const sub of cat.subcategories) {
              collectLeafCategories(sub);
            }
          }
        }
        collectLeafCategories(saleCategory);
      } else {
        categoryIdsToFetch.push(saleCategory.id);
      }
    } else {
      console.log(`Could not find Sale Category. Using fallback IDs.`);
      categoryIdsToFetch = ['1020470597', '1020269549'];
    }
    
    let allProductIds = [];
    
    for (const catId of categoryIdsToFetch) {
      const endpointsToTry = [
        `https://www.stradivarius.com/itxrest/3/catalog/store/${storeId}/${catalogId}/category/${catId}/product?languageId=${languageId}&showProducts=false&appId=1`,
        `https://www.stradivarius.com/itxrest/3/catalog/store/${storeId}/${catalogId}/category/${catId}/product?languageId=${languageId}&appId=1`
      ];
      
      for (const url of endpointsToTry) {
        try {
          const result = await page.evaluate(async (fetchUrl) => {
            try {
              const response = await fetch(fetchUrl);
              if (!response.ok) return { success: false, status: response.status };
              const data = await response.json();
              return { 
                success: true, 
                productIds: data.productIds || [], 
                products: data.products || []
              };
            } catch (e) {
              return { success: false, error: e.message };
            }
          }, url);
          
          if (result.success) {
            if (result.productIds && result.productIds.length > 0) {
              allProductIds = allProductIds.concat(result.productIds);
              break;
            } else if (result.products && result.products.length > 0) {
              const ids = result.products.map(p => p.id);
              allProductIds = allProductIds.concat(ids);
              break;
            }
          }
        } catch (e) {
          // Ignore errors and try next endpoint
        }
      }
    }
    
    allProductIds = [...new Set(allProductIds)];
    console.log(`Found ${allProductIds.length} unique product IDs.`);
    
    if (allProductIds.length === 0) {
      throw new Error('No products found in sale categories.');
    }
    
    console.log(`Fetching details for products...`);
    const batchSize = 50;
    let allProducts = [];
    
    for (let i = 0; i < allProductIds.length; i += batchSize) {
      const batchIds = allProductIds.slice(i, i + batchSize).join(',');
      const detailsUrl = `https://www.stradivarius.com/itxrest/3/catalog/store/${storeId}/${catalogId}/productsArray?languageId=${languageId}&productIds=${batchIds}&appId=1`;
      
      const products = await page.evaluate(async (url) => {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        return data.products || [];
      }, detailsUrl);
      
      allProducts = allProducts.concat(products);
    }
    
    const deals = [];
    
    for (const p of allProducts) {
      try {
        let price = null;
        let oldPrice = null;
        let imageUrl = null;
        
        if (p.bundleProductSummaries && p.bundleProductSummaries.length > 0) {
          const summary = p.bundleProductSummaries[0].detail;
          if (summary && summary.colors && summary.colors.length > 0) {
            const color = summary.colors[0];
            if (color.sizes && color.sizes.length > 0) {
              price = color.sizes[0].price ? color.sizes[0].price / 100 : null;
              oldPrice = color.sizes[0].oldPrice ? color.sizes[0].oldPrice / 100 : null;
            }
            
            if (color.image && color.image.url) {
              imageUrl = `https://static.stradivarius.net/5/photos3${color.image.url}_1_1_1.jpg`;
            } else if (summary.xmedia && summary.xmedia.length > 0) {
              const media = summary.xmedia.find(m => m.path);
              if (media) {
                imageUrl = `https://static.stradivarius.net/5/photos3${media.path}_1_1_1.jpg`;
              }
            }
          }
        }
        
        // Skip if no price or not discounted
        if (!price || !oldPrice || price >= oldPrice) continue;
        
        const discountPercentage = Math.round(((oldPrice - price) / oldPrice) * 100);
        
        deals.push({
          title: p.name,
          brand: 'Stradivarius',
          category: p.familyName || 'Odzież',
          discount: `${discountPercentage}%`,
          price: `${price.toFixed(2)} PLN`,
          currency: 'PLN',
          url: `https://www.stradivarius.com/pl/${p.productUrl}`,
          image: imageUrl,
          description: `Stradivarius: ${p.name}`,
          valid_until: null,
          tags: ['moda', 'stradivarius', 'wyprzedaż', p.familyName ? p.familyName.toLowerCase() : 'odzież'],
          confidence_score: 1.0,
          source_type: 'dynamic_scrape',
          source_name: 'Stradivarius API'
        });
        
        if (deals.length >= 20) {
          break;
        }
      } catch (e) {
        console.error(`Error parsing product ${p.id}:`, e.message);
      }
    }
    
    console.log(`Successfully scraped ${deals.length} deals from Stradivarius.`);
    return deals;
    
  } catch (error) {
    console.error('Stradivarius API scraper failed:', error.message);
    return [];
  } finally {
    await browser.close();
  }
}
