import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();

  console.log('Navigating to Pull&Bear sale...');
  await page.goto('https://www.pullandbear.com/pl/kobieta/wyprzedaz-n6417', { waitUntil: 'networkidle2' });

  const inditex = await page.evaluate(() => {
    return Object.keys((window as any).inditex || {});
  });
  console.log("window.inditex keys:", inditex);

  await browser.close();
})();
