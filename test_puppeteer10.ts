import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();

  console.log('Navigating to Pull&Bear sale...');
  await page.goto('https://www.pullandbear.com/pl/kobieta/wyprzedaz-n6417', { waitUntil: 'networkidle2' });

  const html = await page.content();
  const index = html.indexOf('window.inditex');
  if (index !== -1) {
    console.log("Found window.inditex");
  }
  
  const index2 = html.indexOf('window.__PRELOADED_STATE__');
  if (index2 !== -1) {
    console.log("Found window.__PRELOADED_STATE__");
  }

  await browser.close();
})();
