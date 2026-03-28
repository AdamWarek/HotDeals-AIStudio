const url = "https://www.bershka.com/itxrest/3/catalog/store/45109524/40259532/category/1010419519/product?languageId=-22&appId=1&showProducts=false";

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
  console.log("Product IDs found:", data.productIds?.length);
}).catch(console.error);
