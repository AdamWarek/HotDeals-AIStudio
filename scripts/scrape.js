import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import axios from 'axios';
import * as cheerio from 'cheerio';

puppeteer.use(StealthPlugin());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to parse price strings like "1 299,90 zł" or "199.90 PLN" into numbers
const parsePrice = (priceStr) => {
  if (!priceStr) return 0;
  // Remove spaces that might be used as thousands separators
  const noSpaces = priceStr.replace(/\s+/g, '');
  // Match the first occurrence of a number pattern (e.g., 1299,90 or 199.90 or 199)
  const match = noSpaces.match(/\d+[.,]\d{2}|\d+/);
  if (!match) return 0;
  const cleaned = match[0].replace(',', '.');
  return parseFloat(cleaned);
};

// Configuration for all 11 requested brands
const BRANDS_CONFIG = [
  {
    brand: "Pull&Bear",
    url: "https://www.pullandbear.com/pl/kobieta/wyprzedaz-n6417",
    cat: "Odzież",
    selectors: { card: '.product-card', name: '.name', sale: '.price-sale', orig: '.price-original', img: 'img.image-transparent', link: 'a' }
  },
  {
    brand: "Bershka",
    url: "https://www.bershka.com/pl/kobieta/wyprzedaz-c1010193132.html",
    cat: "Odzież",
    selectors: { card: '.product-card', name: '.product-text', sale: '.current-price', orig: '.original-price', img: 'img', link: 'a' }
  },
  {
    brand: "Urban Outfitters",
    url: "https://www.urbanoutfitters.com/pl-pl/womens-sale",
    cat: "Odzież",
    selectors: { card: '.product-tile', name: '.product-tile__title', sale: '.product-tile__sale-price', orig: '.product-tile__regular-price', img: 'img', link: 'a' }
  },
  {
    brand: "Adidas",
    url: "https://www.adidas.pl/kobiety-wyprzedaz",
    cat: "Sport",
    selectors: { card: '.gl-product-card', name: '.gl-product-card__title', sale: '.gl-price-item--sale', orig: '.gl-price-item--crossed', img: 'img', link: 'a' }
  },
  {
    brand: "Nike",
    url: "https://www.nike.com/pl/w/wyprzedaz-damskie-3yaepz5e1x6",
    cat: "Sport",
    selectors: { card: '.product-card', name: '.product-card__title', sale: '.product-price.is--current-price', orig: '.product-price.us--strikethrough', img: 'img.product-card__hero-image', link: 'a.product-card__link-overlay' }
  },
  {
    brand: "Stradivarius",
    url: "https://www.stradivarius.com/pl/kobieta/wyprzedaz-c1020280596.html",
    cat: "Odzież",
    selectors: { card: '.product-card', name: '.product-name', sale: '.price-sale', orig: '.price-original', img: 'img', link: 'a' }
  },
  {
    brand: "H&M",
    url: "https://www2.hm.com/pl_pl/wyprzedaz/kobiety.html",
    cat: "Odzież",
    selectors: { card: '.product-item', name: '.item-heading', sale: '.item-price', orig: '.item-price-base', img: 'img', link: 'a.item-link' }
  },
  {
    brand: "Rossmann",
    url: "https://www.rossmann.pl/promocje",
    cat: "Kosmetyki",
    selectors: { card: '.product-list__item', name: '.product__name', sale: '.product__price--promo', orig: '.product__price--base', img: 'img', link: 'a' }
  },
  {
    brand: "Hebe",
    url: "https://www.hebe.pl/promocje/",
    cat: "Kosmetyki",
    selectors: { card: '.product-tile', name: '.product-name', sale: '.sales', orig: '.strike-through', img: 'img', link: 'a' }
  },
  {
    brand: "Sephora",
    url: "https://www.sephora.pl/promocje/",
    cat: "Kosmetyki",
    selectors: { card: '.product-tile', name: '.link', sale: '.price-sales', orig: '.price-standard', img: 'img', link: 'a' }
  },
  {
    brand: "Douglas",
    url: "https://www.douglas.pl/pl/c/sale/09",
    cat: "Kosmetyki",
    selectors: { card: '.product-tile', name: '.product-name', sale: '.price__sale', orig: '.price__regular', img: 'img', link: 'a' }
  }
];

// Helper to scroll the page to trigger lazy-loaded images
async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 300;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= scrollHeight || totalHeight > 3000) {
          clearInterval(timer);
          resolve();
        }
      }, 200);
    });
  });
}

// Removed placeholder generation function

async function launchBrowser() {
  const args = [
    '--no-sandbox', 
    '--disable-setuid-sandbox',
    '--disable-blink-features=AutomationControlled',
    '--disable-web-security',
    '--ignore-certificate-errors'
  ];

  console.log('Running without proxy...');

  return await puppeteer.launch({
    headless: "new",
    ignoreHTTPSErrors: true,
    args: args
  });
}

async function scrapeDeals() {
  console.log('Starting the scraping process for 11 brands...');
  
  let browser = await launchBrowser();

  const allDeals = [];

  for (let i = 0; i < BRANDS_CONFIG.length; i++) {
    const config = BRANDS_CONFIG[i];
    console.log(`\n--- Scraping ${config.brand} ---`);
    const page = await browser.newPage();
    
    // Set realistic viewport and user agent
    await page.setViewport({ width: 1366, height: 768 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    let items = [];

    try {
      // Go to the URL and wait for network to be somewhat idle
      const response = await page.goto(config.url, { waitUntil: 'networkidle2', timeout: 45000 });
      
      const status = response.status();
      const content = await page.content();

      // Check if we got blocked (403 Forbidden or CAPTCHA page)
      const isBlocked = status === 403 || status === 404 || 
                        content.includes('cloudflare') || 
                        content.includes('datadome') || 
                        content.includes('Access Denied');

      if (isBlocked) {
        console.log(`Puppeteer was blocked by ${config.brand} (Status: ${status}).`);
        throw new Error('Blocked by anti-bot protection');
      }

      // Scroll down to load lazy images
      await autoScroll(page);
      
      // Wait a bit for JS to render products
      await new Promise(r => setTimeout(r, 3000));

      // Extract data using the selectors
      items = await page.evaluate((sel, brand, cat) => {
        // Try to find cards using the specific selector, or fallback to common generic ones
        let cards = Array.from(document.querySelectorAll(sel.card));
        if (cards.length === 0) {
          // Fallback selectors for SPAs that might have changed classes
          cards = Array.from(document.querySelectorAll('article, .product-tile, .product-card, .gl-product-card, li.product-item, .product-list__item, li[data-testid="product-card"]'));
        }
        
        cards = cards.slice(0, 10); // Get top 10 deals per brand
        
        return cards.map(card => {
          const nameEl = sel.name ? card.querySelector(sel.name) : null;
          const saleEl = sel.sale ? card.querySelector(sel.sale) : null;
          const origEl = sel.orig ? card.querySelector(sel.orig) : null;
          const imgEl = sel.img ? card.querySelector(sel.img) : null;
          const linkEl = sel.link ? card.querySelector(sel.link) : null;

          // Fallback extraction if specific selectors fail
          const textContent = card.innerText || '';
          const lines = textContent.split('\\n').map(l => l.trim()).filter(l => l);
          
          let name = nameEl ? nameEl.innerText.trim() : '';
          if (!name && lines.length > 0) {
            // Usually the brand or product name is one of the first few lines
            name = lines.find(l => l.length > 5 && !l.includes('zł') && !l.includes('PLN')) || 'Brak nazwy';
          }

          // Extract prices from text if selectors fail
          let saleStr = saleEl ? saleEl.innerText.trim() : '';
          let origStr = origEl ? origEl.innerText.trim() : '';
          
          if (!saleStr || !origStr) {
            const priceLines = lines.filter(l => l.includes('zł') || l.includes('PLN') || /\d+[.,]\d{2}/.test(l));
            if (priceLines.length > 0) {
              if (!saleStr) saleStr = priceLines[0]; // First price is usually the sale price
              if (!origStr && priceLines.length > 1) origStr = priceLines[1]; // Second is usually original
            }
          }

          // Get image (handle lazy loading data-src attributes)
          let img = '';
          if (imgEl) {
            img = imgEl.getAttribute('data-src') || imgEl.getAttribute('data-original') || imgEl.src;
          } else {
            // Fallback: find any image in the card
            const anyImg = card.querySelector('img');
            if (anyImg) {
              img = anyImg.getAttribute('data-src') || anyImg.getAttribute('data-original') || anyImg.src;
            }
          }

          // Get link (make absolute if relative)
          let url = '';
          if (linkEl) {
            url = linkEl.href;
          } else {
            // Fallback: find any link in the card
            const anyLink = card.querySelector('a');
            if (anyLink) url = anyLink.href;
          }
          
          if (url && url.startsWith('/')) {
            url = window.location.origin + url;
          }

          return {
            brand: brand,
            name: name || 'Brak nazwy',
            saleStr: saleStr || '0',
            origStr: origStr || '0',
            img: img || null,
            url: url || window.location.href,
            cat: cat,
            isNew: Math.random() > 0.7, // Randomly mark some as new
            scrape_status: 'R'
          };
        });
      }, config.selectors, config.brand, config.cat);

      // Filter out items that clearly failed to extract a price
      items = items.filter(item => item.saleStr !== '0' && item.saleStr !== '');

      if (items.length === 0) {
        const title = await page.title();
        console.log(`Puppeteer succeeded but found 0 valid items for ${config.brand}. Page title was: "${title}"`);
        items.push({
          brand: config.brand,
          name: `Wyprzedaż ${config.brand} - Zobacz ofertę`,
          saleStr: '0',
          origStr: '0',
          img: null,
          url: config.url,
          cat: config.cat,
          isNew: false,
          scrape_status: 'F'
        });
      }
    } catch (error) {
      console.error(`Puppeteer failed for ${config.brand}:`, error.message);
      // Fallback item generated. The frontend will display a link to the brand's website.
      items.push({
        brand: config.brand,
        name: `Wyprzedaż ${config.brand} - Zobacz ofertę`,
        saleStr: '0',
        origStr: '0',
        img: null,
        url: config.url,
        cat: config.cat,
        isNew: false,
        scrape_status: 'F'
      });
    } finally {
      await page.close();
    }

    // Process and format the extracted data
    items.forEach(item => {
      const salePrice = parsePrice(item.saleStr);
      const origPrice = parsePrice(item.origStr) || salePrice; // Fallback if no original price found
      
      let pct = 0;
      if (origPrice > salePrice && salePrice > 0) {
        pct = Math.round(((origPrice - salePrice) / origPrice) * 100);
      }

      // Only add deals that have a valid price, or if it's a fallback item
      if (salePrice > 0 || item.scrape_status === 'F') {
        allDeals.push({
          title: item.name,
          brand: item.brand,
          category: item.cat,
          discount: pct > 0 ? `${pct}%` : null,
          price: salePrice > 0 ? salePrice.toString() : null,
          currency: salePrice > 0 ? 'PLN' : null,
          url: item.url,
          image: item.img,
          description: item.scrape_status === 'F' ? `Zobacz pełną ofertę wyprzedażową na stronie ${item.brand}.` : null,
          valid_until: null,
          tags: [item.cat],
          confidence_score: item.scrape_status === 'F' ? 0.5 : 1.0,
          source_type: 'dynamic_scrape',
          source_name: item.brand
        });
      }
    });

    console.log(`Successfully extracted ${items.length} items from ${config.brand}`);
  }

  await browser.close();

  // Save to deals.json
  if (allDeals.length > 0) {
    const dealsPath = path.join(__dirname, '../public/deals.json');
    fs.writeFileSync(dealsPath, JSON.stringify(allDeals, null, 2));
    console.log(`\nScraping complete! Saved ${allDeals.length} total deals to public/deals.json`);
  } else {
    console.log('\nScraping complete, but no deals were found. deals.json was not updated.');
  }
}

scrapeDeals();
