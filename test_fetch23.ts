const url = "https://www.pullandbear.com/integration/cms/api/materialized/page/home-woman-web?country=PL&lang=pl";

fetch(url, {
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "Accept": "application/json"
  }
}).then(async res => {
  const data = await res.json();
  const types = new Set();
  Object.values(data.content).forEach((c: any) => {
    if (c.type) types.add(c.type);
  });
  console.log("Component types:", Array.from(types));
}).catch(console.error);
