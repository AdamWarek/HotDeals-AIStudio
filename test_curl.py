import asyncio
from curl_cffi.requests import AsyncSession

async def main():
    async with AsyncSession(impersonate="chrome120") as session:
        url = "https://www.bershka.com/itxrest/3/catalog/store/45109524/40259532/category/1010419519/product"
        params = {
            "languageId": "-22",
            "appId": "1",
            "showProducts": "false"
        }
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
            "Accept": "application/json",
            "Referer": "https://www.bershka.com/pl/",
            "Origin": "https://www.bershka.com"
        }
        res = await session.get(url, params=params, headers=headers)
        print("Status:", res.status_code)
        if res.status_code == 200:
            data = res.json()
            print("Products:", len(data.get("productIds", [])))
            print("Keys:", data.keys())

asyncio.run(main())
