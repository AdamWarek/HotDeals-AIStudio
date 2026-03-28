const storeId = "44009421"; // Standard Bershka PL storeId
const categoryId = "1010419519"; // From celement
const url = `https://www.bershka.com/itxrest/2/catalog/store/${storeId}/category/${categoryId}/product?languageId=-46&appId=1`;

fetch(url, {
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Referer": "https://www.bershka.com/pl/",
    "Origin": "https://www.bershka.com"
  }
}).then(async res => {
  console.log("Status:", res.status);
  const data = await res.json();
  console.log("Products found:", data.productElements?.length);
}).catch(console.error);
