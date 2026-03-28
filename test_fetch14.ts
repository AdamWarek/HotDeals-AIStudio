const url = "https://www.pullandbear.com/itxrest/2/catalog/store/25009524/20309453/category?languageId=-22&typeCatalog=1&appId=1";

fetch(url, {
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "Accept": "application/json"
  }
}).then(async res => {
  console.log("Status:", res.status);
  const data = await res.json();
  console.log("Categories:", data.categories?.length);
  if (data.categories && data.categories.length > 0) {
    const cat = data.categories[0];
    console.log("First category name:", cat.name);
    console.log("First category id:", cat.id);
  }
}).catch(console.error);
