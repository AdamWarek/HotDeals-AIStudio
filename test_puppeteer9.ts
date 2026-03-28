import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();

  console.log('Navigating to Pull&Bear sale...');
  await page.goto('https://www.pullandbear.com/pl/kobieta/wyprzedaz-n6417', { waitUntil: 'networkidle2' });

  const html = await page.content();
  const match = html.match(/productElements/g);
  console.log("Matches for productElements:", match?.length);
  
  const match2 = html.match(/products/g);
  console.log("Matches for products:", match2?.length);

  await browser.close();
})();
