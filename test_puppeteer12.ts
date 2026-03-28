import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();

  console.log('Navigating to Pull&Bear sale...');
  await page.goto('https://www.pullandbear.com/pl/kobieta/wyprzedaz-n6417', { waitUntil: 'networkidle2' });

  const state = await page.evaluate(() => {
    return Object.keys(window).filter(k => k.includes('STATE') || k.includes('DATA') || k.includes('STORE'));
  });
  console.log("State keys:", state);

  await browser.close();
})();
