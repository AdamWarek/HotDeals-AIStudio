const storeId = "25009524";
const categoryId = "1030128502";
const url = `https://www.pullandbear.com/itxrest/3/catalog/store/${storeId}/${categoryId}/product?languageId=-22&appId=1&showProducts=false`;

fetch(url, {
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "Accept": "application/json"
  }
}).then(async res => {
  console.log("Pull&Bear Status:", res.status);
  const data = await res.json();
  console.log("Product IDs found:", data.productIds?.length);
}).catch(console.error);

const stradStoreId = "54009574";
const stradCategoryId = "1020480589";
const stradUrl = `https://www.stradivarius.com/itxrest/3/catalog/store/${stradStoreId}/${stradCategoryId}/product?languageId=-22&appId=1&showProducts=false`;

fetch(stradUrl, {
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "Accept": "application/json"
  }
}).then(async res => {
  console.log("Stradivarius Status:", res.status);
  const data = await res.json();
  console.log("Product IDs found:", data.productIds?.length);
}).catch(console.error);
