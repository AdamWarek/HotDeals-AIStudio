import asyncio
from curl_cffi.requests import AsyncSession
from utils import get_timestamp, random_delay, save_promos

# Inditex constants (Placeholders for category IDs, these need to be updated from DevTools)
INDITEX_CONFIG = {
    "bershka": {
        "storeId": "44009421",
        "langId": "-46",
        "categoryId": "1010194034", # Placeholder
        "appId": "1",
        "domain": "www.bershka.com"
    },
    "pullandbear": {
        "storeId": "34009421", # Placeholder
        "langId": "-46",
        "categoryId": "1010194035", # Placeholder
        "appId": "1",
        "domain": "www.pullandbear.com"
    },
    "stradivarius": {
        "storeId": "54009421", # Placeholder
        "langId": "-46",
        "categoryId": "1010194036", # Placeholder
        "appId": "1",
        "domain": "www.stradivarius.com"
    }
}

async def scrape_inditex(brand, config, session):
    print(f"Scraping {brand} via API...")
    url = f"https://{config['domain']}/itxrest/2/catalog/store/{config['storeId']}/category/{config['categoryId']}/product"
    params = {
        "languageId": config["langId"],
        "appId": config["appId"],
        "offset": "0",
        "limit": "40",
        "orderBy": "1"
    }
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        "Accept": "application/json",
        "Referer": f"https://{config['domain']}/pl/",
        "Origin": f"https://{config['domain']}"
    }
    
    promos = []
    try:
        response = await session.get(url, params=params, headers=headers)
        if response.status_code == 200:
            data = response.json()
            products = data.get("productElements", [])
            for item in products:
                # Extract details (adjust based on actual API response structure)
                try:
                    name = item.get("name", "Unknown")
                    price_info = item.get("detail", {}).get("colors", [{}])[0].get("sizes", [{}])[0]
                    original_price = price_info.get("oldPrice", 0) / 100
                    sale_price = price_info.get("price", 0) / 100
                    
                    if original_price > 0 and sale_price > 0 and sale_price < original_price:
                        discount_pct = int((1 - (sale_price / original_price)) * 100)
                        
                        promos.append({
                            "site": brand,
                            "scraped_at": get_timestamp(),
                            "name": name,
                            "original_price": f"{original_price:.2f} PLN",
                            "sale_price": f"{sale_price:.2f} PLN",
                            "discount_pct": discount_pct,
                            "image_url": f"https://static.inditex.com/{item.get('imageUrl', '')}", # Placeholder
                            "product_url": f"https://{config['domain']}/pl/product-{item.get('id')}.html",
                            "category": "Odzież",
                            "in_stock": True
                        })
                except Exception as e:
                    continue
        else:
            print(f"Failed to fetch {brand}: HTTP {response.status_code}")
    except Exception as e:
        print(f"Error scraping {brand}: {e}")
        
    save_promos(brand, promos)
    return promos

async def scrape_hm(session):
    print("Scraping H&M via API...")
    url = "https://www2.hm.com/pl_pl/sale/women/_jcr_content/main/productlisting.display.json"
    params = {
        "page": "0",
        "page-size": "36",
        "sort": "ascPrice",
        "format": "json"
    }
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        "Accept-Language": "pl-PL,pl;q=0.9",
        "X-Country": "PL"
    }
    
    promos = []
    try:
        response = await session.get(url, params=params, headers=headers)
        if response.status_code == 200:
            data = response.json()
            products = data.get("products", [])
            for item in products:
                try:
                    name = item.get("title", "Unknown")
                    sale_price_raw = item.get("price", "0").replace(" PLN", "").replace(",", ".")
                    original_price_raw = item.get("whitePrice", sale_price_raw).replace(" PLN", "").replace(",", ".")
                    
                    sale_price = float(sale_price_raw)
                    original_price = float(original_price_raw)
                    
                    if original_price > 0 and sale_price > 0 and sale_price < original_price:
                        discount_pct = int((1 - (sale_price / original_price)) * 100)
                        
                        promos.append({
                            "site": "hm",
                            "scraped_at": get_timestamp(),
                            "name": name,
                            "original_price": f"{original_price:.2f} PLN",
                            "sale_price": f"{sale_price:.2f} PLN",
                            "discount_pct": discount_pct,
                            "image_url": item.get("image", [{}])[0].get("src", ""),
                            "product_url": f"https://www2.hm.com{item.get('link', '')}",
                            "category": item.get("category", "Odzież"),
                            "in_stock": True
                        })
                except Exception as e:
                    continue
        else:
            print(f"Failed to fetch H&M: HTTP {response.status_code}")
    except Exception as e:
        print(f"Error scraping H&M: {e}")
        
    save_promos("hm", promos)
    return promos

async def scrape_urbanoutfitters(session):
    print("Scraping Urban Outfitters via API...")
    url = "https://api.urbanoutfitters.com/api/products"
    params = {
        "category": "sale",
        "start": "0",
        "rows": "48",
        "country": "PL",
        "currency": "PLN"
    }
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        "Accept-Language": "pl-PL,pl;q=0.9"
    }
    
    promos = []
    try:
        response = await session.get(url, params=params, headers=headers)
        if response.status_code == 200:
            data = response.json()
            products = data.get("products", [])
            for item in products:
                try:
                    name = item.get("product_name", "Unknown")
                    original_price = item.get("original_price", 0)
                    sale_price = item.get("sale_price", 0)
                    
                    if original_price > 0 and sale_price > 0 and sale_price < original_price:
                        discount_pct = int((1 - (sale_price / original_price)) * 100)
                        
                        promos.append({
                            "site": "urbanoutfitters",
                            "scraped_at": get_timestamp(),
                            "name": name,
                            "original_price": f"{original_price:.2f} PLN",
                            "sale_price": f"{sale_price:.2f} PLN",
                            "discount_pct": discount_pct,
                            "image_url": item.get("image_url", ""),
                            "product_url": f"https://www.urbanoutfitters.com{item.get('product_url', '')}",
                            "category": "Odzież",
                            "in_stock": True
                        })
                except Exception as e:
                    continue
        else:
            print(f"Failed to fetch Urban Outfitters: HTTP {response.status_code}")
    except Exception as e:
        print(f"Error scraping Urban Outfitters: {e}")
        
    save_promos("urbanoutfitters", promos)
    return promos

async def run_api_scrapers():
    async with AsyncSession(impersonate="chrome110") as session:
        for brand, config in INDITEX_CONFIG.items():
            await scrape_inditex(brand, config, session)
            await random_delay(2, 4)
            
        await scrape_hm(session)
        await random_delay(2, 4)
        
        await scrape_urbanoutfitters(session)
        await random_delay(3, 5)

if __name__ == "__main__":
    asyncio.run(run_api_scrapers())
