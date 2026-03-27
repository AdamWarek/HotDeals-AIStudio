import asyncio
from api_scraper import run_api_scrapers
from html_scraper import run_html_scrapers
from browser_scraper import scrape_sephora
from utils import merge_all_promos

async def main():
    print("Starting Daily Promo Scraper...")
    
    print("\n--- Running API Scrapers ---")
    await run_api_scrapers()
    
    print("\n--- Running HTML Scrapers ---")
    await run_html_scrapers()
    
    print("\n--- Running Browser Scraper ---")
    await scrape_sephora()
    
    print("\n--- Merging Results ---")
    merge_all_promos()
    
    print("\nScraping Complete!")

if __name__ == "__main__":
    asyncio.run(main())
