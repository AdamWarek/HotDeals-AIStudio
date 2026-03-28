const url = "https://www.stradivarius.com/itxrest/1/catalog/store/54009574/placement/home/personalization?strategy=TRENDS&showProducts=true&recommendationModel=yoda&campaign=&productLimit=20&locale=pl_PL&appId=1";

fetch(url, {
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "Accept": "application/json"
  }
}).then(async res => {
  console.log("Status:", res.status);
  const data = await res.json();
  console.log("Products:", data.products?.length);
  if (data.products && data.products.length > 0) {
    console.log(data.products[0].name);
  }
}).catch(console.error);
