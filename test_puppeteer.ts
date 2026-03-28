import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('request', request => {
    const url = request.url();
    if (url.includes('itxrest')) {
      console.log('API Request:', url);
    }
  });

  console.log('Navigating to Bershka...');
  await page.goto('https://www.bershka.com/pl/woman/promo-up-to-30%25-n4404.html?celement=1010419519', { waitUntil: 'networkidle2' });
  
  console.log('Navigating to Pull&Bear...');
  await page.goto('https://www.pullandbear.com/pl/kobieta/wyprzedaz-n6417', { waitUntil: 'networkidle2' });
  
  console.log('Navigating to Stradivarius...');
  await page.goto('https://www.stradivarius.com/pl/wyprzedaz-c1020395504.html', { waitUntil: 'networkidle2' });

  await browser.close();
})();
