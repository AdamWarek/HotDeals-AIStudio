const url = "https://www.pullandbear.com/itxrest/2/web/seo/config?appId=1";

fetch(url, {
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "Accept": "application/json"
  }
}).then(async res => {
  const data = await res.json();
  console.log(Object.keys(data.seoCatalogMap).slice(0, 10));
  console.log(data.seoCatalogMap["pl"]);
}).catch(console.error);
