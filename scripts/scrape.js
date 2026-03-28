import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

// Import specialized scrapers
import { scrapePullAndBear } from './scrapers/pullandbear.js';
import { scrapeStradivarius } from './scrapers/stradivarius.js';
import { scrapeBershka } from './scrapers/bershka.js';
import { scrapeHM } from './scrapers/hm.js';
import { scrapeUrbanOutfitters } from './scrapers/urbanoutfitters.js';
import { scrapeRossmann } from './scrapers/rossmann.js';
import { scrapeHebe } from './scrapers/hebe.js';
import { scrapeDouglas } from './scrapers/douglas.js';
import { scrapeSephora } from './scrapers/sephora.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function scrapeDeals() {
  console.log(`Starting the unified scraping process based on the Implementation Plan...`);
  
  const allDeals = [];
  const dataDir = path.join(__dirname, '../public/data');
  
  // Ensure data directory exists
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const scrapedAt = new Date().toISOString();

  // Sequential execution with delays to be a "good citizen"
  const scrapers = [
    { name: "Bershka", id: "bershka", fn: scrapeBershka },
    { name: "Pull&Bear", id: "pullandbear", fn: scrapePullAndBear },
    { name: "Stradivarius", id: "stradivarius", fn: scrapeStradivarius },
    { name: "H&M", id: "hm", fn: scrapeHM },
    { name: "Urban Outfitters", id: "urbanoutfitters", fn: scrapeUrbanOutfitters },
    { name: "Rossmann", id: "rossmann", fn: scrapeRossmann },
    { name: "Hebe", id: "hebe", fn: scrapeHebe },
    { name: "Douglas", id: "douglas", fn: scrapeDouglas },
    { name: "Sephora", id: "sephora", fn: scrapeSephora }
  ];

  for (const scraper of scrapers) {
    try {
      console.log(`\n--- Running Scraper: ${scraper.name} ---`);
      const rawDeals = await scraper.fn();
      
      if (rawDeals && rawDeals.length > 0) {
        // Normalize deals to include all fields from both schemas
        const normalizedDeals = rawDeals.map(deal => {
          const price = parseFloat(deal.price || '0');
          const discountStr = deal.discount || '';
          const discountPct = parseInt(discountStr.replace(/[^\d]/g, '')) || 0;
          
          // Calculate original price if missing
          let originalPriceVal = 0;
          if (discountPct > 0 && discountPct < 100) {
            originalPriceVal = price / (1 - discountPct / 100);
          } else {
            originalPriceVal = price;
          }

          return {
            // Plan Section 5 Schema
            site: scraper.id,
            scraped_at: scrapedAt,
            name: deal.title || deal.name,
            original_price: `${originalPriceVal.toFixed(2)} PLN`,
            sale_price: `${price.toFixed(2)} PLN`,
            discount_pct: discountPct,
            image_url: deal.image || deal.image_url,
            product_url: deal.url || deal.product_url,
            category: deal.category || 'Inne',
            in_stock: true,

            // Additional User Instructions Schema (Compatibility)
            title: deal.title || deal.name,
            brand: scraper.name,
            discount: deal.discount,
            price: deal.price,
            currency: deal.currency || 'PLN',
            url: deal.url || deal.product_url,
            image: deal.image || deal.image_url,
            description: deal.description || `Okazja z ${scraper.name}`,
            valid_until: deal.valid_until || null,
            tags: deal.tags || [deal.category || 'sale'],
            confidence_score: deal.confidence_score || 1.0,
            source_type: deal.source_type || 'dynamic_scrape',
            source_name: scraper.name
          };
        });

        // Write per-site file
        const sitePath = path.join(dataDir, `${scraper.id}_promos.json`);
        fs.writeFileSync(sitePath, JSON.stringify(normalizedDeals, null, 2));
        console.log(`Saved ${normalizedDeals.length} deals to ${scraper.id}_promos.json`);

        allDeals.push(...normalizedDeals);
      }
      
      // Delay between sites as per plan (3-5 seconds)
      console.log(`Waiting 4 seconds before next scraper...`);
      await new Promise(r => setTimeout(r, 4000));
    } catch (error) {
      console.error(`Failed to scrape ${scraper.name}:`, error.message);
    }
  }

  // Handle Adidas and Nike (Architecture only / Skip as per plan)
  console.log("\n--- Adidas & Nike (Skip/Architecture Only) ---");
  console.log("Skipping Adidas.pl (T4 Akamai Bot Manager confirmed).");
  console.log("Skipping Nike.com/pl (Prohibited by ToS).");

  // Save merged files
  if (allDeals.length > 0) {
    // Plan: data/all_promos.json
    const allPromosPath = path.join(dataDir, 'all_promos.json');
    fs.writeFileSync(allPromosPath, JSON.stringify(allDeals, null, 2));
    
    // Compatibility: public/deals.json
    const dealsPath = path.join(__dirname, '../public/deals.json');
    fs.writeFileSync(dealsPath, JSON.stringify(allDeals, null, 2));
    
    console.log(`\nScraping complete!`);
    console.log(`- Saved merged deals to public/data/all_promos.json`);
    console.log(`- Saved merged deals to public/deals.json`);
    console.log(`- Total deals: ${allDeals.length}`);
  } else {
    console.log('\nScraping complete, but no deals were found.');
  }
}

scrapeDeals();
