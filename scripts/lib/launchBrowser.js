import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

/**
 * Launch a headless Chromium instance with Stealth plugin.
 * Reads SCRAPER_PROXY_URL from env to route traffic through a proxy.
 * @param {string[]} extraArgs - Additional Chromium flags
 */
export async function launchBrowser(extraArgs = []) {
  const args = ['--no-sandbox', '--disable-setuid-sandbox', ...extraArgs];
  const proxyUrl = process.env.SCRAPER_PROXY_URL;
  if (proxyUrl) {
    args.push(`--proxy-server=${proxyUrl}`);
    console.log('[proxy] Routing Puppeteer through:', proxyUrl.replace(/\/\/[^@]+@/, '//***@'));
  }
  return puppeteer.launch({ headless: 'new', args });
}
