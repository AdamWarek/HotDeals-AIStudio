const url = "https://www.pullandbear.com/integration/cms/api/materialized/page/home-woman-web?country=PL&lang=pl";

fetch(url, {
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "Accept": "application/json"
  }
}).then(async res => {
  console.log("Status:", res.status);
  const data = await res.json();
  console.log("Keys:", Object.keys(data));
}).catch(console.error);
