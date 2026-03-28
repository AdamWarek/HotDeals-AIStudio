const url = "https://www.bershka.com/itxrest/3/catalog/store/45109524/40259532/category/1010419519/product?languageId=-22&appId=1&showProducts=true";

fetch(url, {
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Referer": "https://www.bershka.com/pl/",
    "Origin": "https://www.bershka.com"
  }
}).then(async res => {
  const data = await res.json();
  if (data.products) {
    const keys = Object.keys(data.products);
    if (keys.length > 0) {
      const p = data.products[keys[0]];
      console.log(Object.keys(p.detail));
      console.log(JSON.stringify(p.detail.colors, null, 2));
    }
  }
}).catch(console.error);
