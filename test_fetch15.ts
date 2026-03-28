const url = "https://www.pullandbear.com/itxrest/2/catalog/store/25009524/20309453/category?languageId=-22&typeCatalog=1&appId=1";

fetch(url, {
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "Accept": "application/json"
  }
}).then(async res => {
  const data = await res.json();
  const saleCategory = data.categories.find(c => c.name === "Wyprzedaż" || c.name === "Sale" || c.name === "Dla Niej");
  console.log("Sale category:", saleCategory?.name, saleCategory?.id);
  
  if (saleCategory && saleCategory.subcategories) {
    console.log("Subcategories:", saleCategory.subcategories.map(s => `${s.name}: ${s.id}`).join(", "));
  }
}).catch(console.error);
