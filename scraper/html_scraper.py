import asyncio
from curl_cffi.requests import AsyncSession
from bs4 import BeautifulSoup
from utils import get_timestamp, random_delay, save_promos

async def scrape_rossmann(session):
    print("Scraping Rossmann via HTML...")
    url = "https://www.rossmann.pl/promocje"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        "Accept-Language": "pl-PL,pl;q=0.9"
    }
    
    promos = []
    try:
        response = await session.get(url, headers=headers)
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, 'html.parser')
            products = soup.select(".product-tile, .product-item")
            
            for item in products:
                try:
                    name_elem = item.select_one(".product-name, h3.title")
                    name = name_elem.text.strip() if name_elem else "Unknown"
                    
                    orig_elem = item.select_one(".regular-price, .strike")
                    orig_price_raw = orig_elem.text.strip().replace(" zł", "").replace(",", ".") if orig_elem else "0"
                    
                    sale_elem = item.select_one(".sale-price, .current-price")
                    sale_price_raw = sale_elem.text.strip().replace(" zł", "").replace(",", ".") if sale_elem else "0"
                    
                    img_elem = item.select_one("img.product-image[src]")
                    img_url = img_elem['src'] if img_elem else ""
                    
                    link_elem = item.select_one("a.product-name[href], a[href]")
                    link_url = link_elem['href'] if link_elem else ""
                    if link_url and not link_url.startswith("http"):
                        link_url = f"https://www.rossmann.pl{link_url}"
                    
                    original_price = float(orig_price_raw)
                    sale_price = float(sale_price_raw)
                    
                    if original_price > 0 and sale_price > 0 and sale_price < original_price:
                        discount_pct = int((1 - (sale_price / original_price)) * 100)
                        
                        promos.append({
                            "site": "rossmann",
                            "scraped_at": get_timestamp(),
                            "name": name,
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
        else:
            print(f"Failed to fetch Rossmann: HTTP {response.status_code}")
    except Exception as e:
        print(f"Error scraping Rossmann: {e}")
        
    save_promos("rossmann", promos)
    return promos

async def scrape_hebe(session):
    print("Scraping Hebe via HTML...")
    url = "https://www.hebe.pl/promocje/"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        "Accept-Language": "pl-PL,pl;q=0.9"
    }
    
    promos = []
    try:
        response = await session.get(url, headers=headers)
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, 'html.parser')
            products = soup.select(".product-card, article")
            
            for item in products:
                try:
                    name_elem = item.select_one("a.product-name, a")
                    name = name_elem.text.strip() if name_elem else "Unknown"
                    
                    orig_elem = item.select_one(".old-price, del")
                    orig_price_raw = orig_elem.text.strip().replace(" zł", "").replace(",", ".") if orig_elem else "0"
                    
                    sale_elem = item.select_one(".new-price, strong")
                    sale_price_raw = sale_elem.text.strip().replace(" zł", "").replace(",", ".") if sale_elem else "0"
                    
                    img_elem = item.select_one("img.lazy-img[data-src], img[src]")
                    img_url = img_elem.get('data-src') or img_elem.get('src') if img_elem else ""
                    
                    link_elem = item.select_one("a[href]")
                    link_url = link_elem['href'] if link_elem else ""
                    if link_url and not link_url.startswith("http"):
                        link_url = f"https://www.hebe.pl{link_url}"
                    
                    original_price = float(orig_price_raw)
                    sale_price = float(sale_price_raw)
                    
                    if original_price > 0 and sale_price > 0 and sale_price < original_price:
                        discount_pct = int((1 - (sale_price / original_price)) * 100)
                        
                        promos.append({
                            "site": "hebe",
                            "scraped_at": get_timestamp(),
                            "name": name,
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
        else:
            print(f"Failed to fetch Hebe: HTTP {response.status_code}")
    except Exception as e:
        print(f"Error scraping Hebe: {e}")
        
    save_promos("hebe", promos)
    return promos

async def scrape_douglas(session):
    print("Scraping Douglas via HTML...")
    url = "https://www.douglas.pl/pl/c/perfumy/wyprzedaz"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        "Accept-Language": "pl-PL,pl;q=0.9"
    }
    
    promos = []
    try:
        response = await session.get(url, headers=headers)
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, 'html.parser')
            products = soup.select(".product-tile__wrapper")
            
            for item in products:
                try:
                    name_elem = item.select_one(".product-tile__name")
                    name = name_elem.text.strip() if name_elem else "Unknown"
                    
                    orig_elem = item.select_one(".price__list .value")
                    orig_price_raw = orig_elem.text.strip().replace(" zł", "").replace(",", ".") if orig_elem else "0"
                    
                    sale_elem = item.select_one(".price__sales .value")
                    sale_price_raw = sale_elem.text.strip().replace(" zł", "").replace(",", ".") if sale_elem else "0"
                    
                    img_elem = item.select_one("img.product-tile__image[src]")
                    img_url = img_elem['src'] if img_elem else ""
                    
                    link_elem = item.select_one("a.product-tile__details[href]")
                    link_url = link_elem['href'] if link_elem else ""
                    if link_url and not link_url.startswith("http"):
                        link_url = f"https://www.douglas.pl{link_url}"
                    
                    original_price = float(orig_price_raw)
                    sale_price = float(sale_price_raw)
                    
                    if original_price > 0 and sale_price > 0 and sale_price < original_price:
                        discount_pct = int((1 - (sale_price / original_price)) * 100)
                        
                        promos.append({
                            "site": "douglas",
                            "scraped_at": get_timestamp(),
                            "name": name,
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
        else:
            print(f"Failed to fetch Douglas: HTTP {response.status_code}")
    except Exception as e:
        print(f"Error scraping Douglas: {e}")
        
    save_promos("douglas", promos)
    return promos

async def run_html_scrapers():
    async with AsyncSession(impersonate="chrome110") as session:
        await scrape_rossmann(session)
        await random_delay(3, 6)
        
        await scrape_hebe(session)
        await random_delay(3, 5)
        
        await scrape_douglas(session)

if __name__ == "__main__":
    asyncio.run(run_html_scrapers())
