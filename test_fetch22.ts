const url = "https://www.pullandbear.com/integration/cms/api/materialized/page/home-woman-web?country=PL&lang=pl";

fetch(url, {
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "Accept": "application/json"
  }
}).then(async res => {
  const data = await res.json();
  console.log("Content keys:", Object.keys(data.content));
  if (data.content.components) {
    console.log("Components count:", data.content.components.length);
    console.log("First component type:", data.content.components[0].type);
  }
}).catch(console.error);
