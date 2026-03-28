import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();

  page.on('request', request => {
    const url = request.url();
    if (url.includes('itxrest') && url.includes('product')) {
      console.log('API Request:', url);
    }
  });

  console.log('Navigating to Pull&Bear sale...');
  await page.goto('https://www.pullandbear.com/pl/kobieta/wyprzedaz-n6417', { waitUntil: 'networkidle2' });
  
  console.log('Navigating to Stradivarius sale...');
  await page.goto('https://www.stradivarius.com/pl/kobieta/wyprzedaz-n1390', { waitUntil: 'networkidle2' });

  await browser.close();
})();
