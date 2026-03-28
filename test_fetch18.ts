const url = "https://www.pullandbear.com/itxrest/2/catalog/store/25009524/20309453/category/1030128502/product?languageId=-22&appId=1";

fetch(url, {
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "Accept": "application/json"
  }
}).then(async res => {
  console.log("Status:", res.status);
  const data = await res.json();
  console.log("Products:", data.productElements?.length);
}).catch(console.error);
