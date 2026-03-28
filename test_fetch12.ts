const url = "https://www.bershka.com/itxrest/3/catalog/store/45109524/1010419519/product?languageId=-22&appId=1&showProducts=true";

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
  console.log("productElements count:", data.productElements?.length);
  console.log("products count:", Object.keys(data.products || {}).length);
  if (data.productElements?.length > 0) {
    const p = data.productElements[0];
    console.log("First product:", p.name);
    console.log("Price:", p.detail?.colors?.[0]?.sizes?.[0]?.price);
  }
}).catch(console.error);
