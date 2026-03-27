import asyncio
import random
from camoufox.async_api import AsyncCamoufox
from utils import get_timestamp, random_delay, save_promos

async def scrape_sephora():
    print("Scraping Sephora via Camoufox...")
    promos = []
    try:
        async with AsyncCamoufox(headless=True, geoip=True) as browser:
            page = await browser.new_page()
            await page.goto("https://www.sephora.pl/promocje/")
            await asyncio.sleep(random.uniform(5, 10))  # human-like wait
            
            products = await page.query_selector_all(".product-item-tile, .product-tile")
            for item in products:
                try:
                    name_elem = await item.query_selector(".product-name, .link")
                    name = await name_elem.inner_text() if name_elem else "Unknown"
                    
                    orig_elem = await item.query_selector(".price-original, .old-price")
                    orig_price_raw = await orig_elem.inner_text() if orig_elem else "0"
                    orig_price_raw = orig_price_raw.strip().replace(" zł", "").replace(",", ".")
                    
                    sale_elem = await item.query_selector(".price-sales, .new-price")
                    sale_price_raw = await sale_elem.inner_text() if sale_elem else "0"
                    sale_price_raw = sale_price_raw.strip().replace(" zł", "").replace(",", ".")
                    
                    img_elem = await item.query_selector("img")
                    img_url = await img_elem.get_attribute("src") if img_elem else ""
                    
                    link_elem = await item.query_selector("a")
                    link_url = await link_elem.get_attribute("href") if link_elem else ""
                    if link_url and not link_url.startswith("http"):
                        link_url = f"https://www.sephora.pl{link_url}"
                    
                    original_price = float(orig_price_raw)
                    sale_price = float(sale_price_raw)
                    
                    if original_price > 0 and sale_price > 0 and sale_price < original_price:
                        discount_pct = int((1 - (sale_price / original_price)) * 100)
                        
                        promos.append({
                            "site": "sephora",
                            "scraped_at": get_timestamp(),
                            "name": name.strip(),
                            "original_price": f"{original_price:.2f} PLN",
                            "sale_price": f"{sale_price:.2f} PLN",
                            "discount_pct": discount_pct,
                            "image_url": img_url,
                            "product_url": link_url,
                            "category": "Kosmetyki",
                            "in_stock": True
                        })
                except Exception as e:
                    continue
    except Exception as e:
        print(f"Error scraping Sephora: {e}")
        
    save_promos("sephora", promos)
    return promos

if __name__ == "__main__":
    asyncio.run(scrape_sephora())
