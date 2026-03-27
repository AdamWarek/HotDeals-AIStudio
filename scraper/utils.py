import json
import os
import asyncio
import random
from datetime import datetime

def get_timestamp():
    return datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

async def random_delay(min_sec=2, max_sec=5):
    delay = random.uniform(min_sec, max_sec)
    await asyncio.sleep(delay)

def save_promos(site_name, promos):
    os.makedirs("data", exist_ok=True)
    filename = f"data/{site_name}_promos.json"
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(promos, f, ensure_ascii=False, indent=2)
    print(f"Saved {len(promos)} items to {filename}")

def merge_all_promos():
    all_promos = []
    os.makedirs("data", exist_ok=True)
    for filename in os.listdir("data"):
        if filename.endswith("_promos.json") and filename != "all_promos.json":
            with open(os.path.join("data", filename), "r", encoding="utf-8") as f:
                try:
                    promos = json.load(f)
                    all_promos.extend(promos)
                except json.JSONDecodeError:
                    print(f"Error reading {filename}")
    
    with open("data/all_promos.json", "w", encoding="utf-8") as f:
        json.dump(all_promos, f, ensure_ascii=False, indent=2)
    print(f"Merged {len(all_promos)} total items into data/all_promos.json")

    # Also write to public/deals.json for the React app
    os.makedirs("public", exist_ok=True)
    with open("public/deals.json", "w", encoding="utf-8") as f:
        json.dump(all_promos, f, ensure_ascii=False, indent=2)
    print(f"Copied {len(all_promos)} total items into public/deals.json")
