import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();

  console.log('Navigating to Pull&Bear sale...');
  await page.goto('https://www.pullandbear.com/pl/kobieta/wyprzedaz-n6417', { waitUntil: 'networkidle2' });

  const scripts = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('script')).map(s => s.innerText).filter(t => t.includes('products') || t.includes('productElements'));
  });
  console.log("Scripts with products:", scripts.length);
  if (scripts.length > 0) {
    console.log(scripts[0].substring(0, 200));
  }

  await browser.close();
})();
