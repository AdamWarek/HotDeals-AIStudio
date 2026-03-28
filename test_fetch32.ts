const url = "https://www.pullandbear.com/itxrest/2/catalog/store/25009524/20309453/category?languageId=-22&typeCatalog=1&appId=1";

fetch(url, {
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "Accept": "application/json"
  }
}).then(async res => {
  const data = await res.json();
  let found = false;
  data.categories.forEach(c => {
    if (c.id === 6417 || c.name.includes("6417")) console.log("Found:", c.name, c.id);
    if (c.subcategories) {
      c.subcategories.forEach(s => {
        if (s.id === 6417 || s.name.includes("6417")) console.log("Found:", s.name, s.id);
      });
    }
  });
}).catch(console.error);
