const url = "https://www.bershka.com/itxrest/3/catalog/store/45109524/40259532/productsArray?categoryId=1010419519&productIds=209100349,209100350&appId=1&languageId=-22&locale=pl_PL";

fetch(url, {
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Referer": "https://www.bershka.com/pl/",
    "Origin": "https://www.bershka.com"
  }
}).then(async res => {
  const data = await res.json();
  console.log("Products:", data.products?.length);
  if (data.products?.length > 0) {
    const p = data.products[0];
    console.log("First product:", p.name);
    console.log("Price:", p.detail?.colors?.[0]?.sizes?.[0]?.price);
    console.log("Old Price:", p.detail?.colors?.[0]?.sizes?.[0]?.oldPrice);
  }
}).catch(console.error);
