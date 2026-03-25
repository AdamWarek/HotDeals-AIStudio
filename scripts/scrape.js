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

// Helper to parse price strings like "199,90 zł" or "199.90 PLN" into numbers
const parsePrice = (priceStr) => {
  if (!priceStr) return 0;
  const cleaned = priceStr.replace(/[^\d,.-]/g, '').replace(',', '.');
  const match = cleaned.match(/\d+\.\d+|\d+/);
  return match ? parseFloat(match[0]) : 0;
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

async function scrapeDeals() {
  console.log('Starting the scraping process for 11 brands...');
  
  const args = [
    '--no-sandbox', 
    '--disable-setuid-sandbox',
    '--disable-blink-features=AutomationControlled',
    '--disable-web-security',
    '--ignore-certificate-errors'
  ];

  if (process.env.SCRAPER_API_KEY) {
    console.log('Using Scrape.do Proxy...');
    args.push('--proxy-server=http://proxy.scrape.do:8080');
  }

  const browser = await puppeteer.launch({
    headless: "new",
    ignoreHTTPSErrors: true,
    args: args
  });

  const allDeals = [];
  let idCounter = 1;

  for (const config of BRANDS_CONFIG) {
    console.log(`\n--- Scraping ${config.brand} ---`);
    const page = await browser.newPage();
    
    if (process.env.SCRAPER_API_KEY) {
      await page.authenticate({
        username: process.env.SCRAPER_API_KEY,
        password: ''
      });
    }

    // Set realistic viewport and user agent
    await page.setViewport({ width: 1366, height: 768 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    let items = [];

    try {
      // Go to the URL and wait for network to be somewhat idle
      const response = await page.goto(config.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      
      // Check if we got blocked (403 Forbidden or CAPTCHA page)
      const status = response.status();
      const content = await page.content();
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
        const cards = Array.from(document.querySelectorAll(sel.card)).slice(0, 10); // Get top 10 deals per brand
        
        return cards.map(card => {
          const nameEl = card.querySelector(sel.name);
          const saleEl = card.querySelector(sel.sale);
          const origEl = card.querySelector(sel.orig);
          const imgEl = card.querySelector(sel.img);
          const linkEl = card.querySelector(sel.link);

          // Get image (handle lazy loading data-src attributes)
          let img = '';
          if (imgEl) {
            img = imgEl.getAttribute('data-src') || imgEl.getAttribute('data-original') || imgEl.src;
          }

          // Get link (make absolute if relative)
          let url = '';
          if (linkEl) {
            url = linkEl.href;
            if (url && url.startsWith('/')) {
              url = window.location.origin + url;
            }
          }

          return {
            brand: brand,
            name: nameEl ? nameEl.innerText.trim() : 'Brak nazwy',
            saleStr: saleEl ? saleEl.innerText.trim() : '0',
            origStr: origEl ? origEl.innerText.trim() : '0',
            img: img || null,
            url: url || window.location.href,
            cat: cat,
            isNew: Math.random() > 0.7, // Randomly mark some as new
            scrape_status: 'R'
          };
        });
      }, config.selectors, config.brand, config.cat);

      if (items.length === 0) {
        const title = await page.title();
        console.log(`Puppeteer succeeded but found 0 items for ${config.brand}. Page title was: "${title}"`);
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
