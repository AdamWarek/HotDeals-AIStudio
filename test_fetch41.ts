const url = "https://www.pullandbear.com/itxrest/3/catalog/store/25009524/20309453/category/1030616887/product?languageId=-22&appId=1&showProducts=true";

fetch(url, {
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "Accept": "application/json"
  }
}).then(async res => {
  console.log("Status:", res.status);
  const data = await res.json();
  console.log("Products:", data.productElements?.length || data.products?.length || Object.keys(data.products || {}).length);
}).catch(console.error);
