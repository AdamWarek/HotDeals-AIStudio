import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();

  console.log('Navigating to Pull&Bear sale...');
  await page.goto('https://www.pullandbear.com/pl/kobieta/wyprzedaz-n6417', { waitUntil: 'networkidle2' });

  const html = await page.content();
  const index = html.indexOf('6417');
  if (index !== -1) {
    console.log(html.substring(index - 100, index + 100));
  }

  await browser.close();
})();
