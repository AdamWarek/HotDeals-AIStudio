const url = "https://www.pullandbear.com/itxrest/2/catalog/store/25009524/1030128502/category?languageId=-22&typeCatalog=1&appId=1";

fetch(url, {
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "Accept": "application/json"
  }
}).then(async res => {
  const data = await res.json();
  console.log("Keys:", Object.keys(data));
}).catch(console.error);
