import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  // Pull&Bear
  console.log('Fetching Pull&Bear categories...');
  await page.goto('https://www.pullandbear.com/itxrest/2/catalog/store/25009524/20309453/category?languageId=-22&typeCatalog=1&appId=1');
  const pbData = await page.evaluate(() => JSON.parse(document.body.innerText));
  
  const findCategory = (categories, name) => {
    for (const cat of categories) {
      if (cat.name && cat.name.toLowerCase().includes(name.toLowerCase())) {
        return cat.id;
      }
      if (cat.subcategories) {
        const found = findCategory(cat.subcategories, name);
        if (found) return found;
      }
    }
    return null;
  };
  
  console.log('Pull&Bear Wyprzedaz ID:', findCategory(pbData.categories, 'Wyprzedaż') || findCategory(pbData.categories, 'Sale') || findCategory(pbData.categories, 'Promo'));

  // Stradivarius
  console.log('Fetching Stradivarius categories...');
  await page.goto('https://www.stradivarius.com/itxrest/2/catalog/store/54009574/50331078/category?languageId=-22&typeCatalog=1&appId=1');
  const stData = await page.evaluate(() => JSON.parse(document.body.innerText));
  console.log('Stradivarius Wyprzedaz ID:', findCategory(stData.categories, 'Wyprzedaż') || findCategory(stData.categories, 'Sale') || findCategory(stData.categories, 'Promo'));

  await browser.close();
})();
