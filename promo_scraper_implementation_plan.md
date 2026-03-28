# 🛍️ Promo Scraper — Implementation Plan
**Target:** Daily promotional data from 11 Polish fashion & beauty websites  
**Audience:** Teenage females (Poland)  
**Date:** 2026-03-27  
**Personal/non-commercial use only.**

---

## 1. Site Classification & Legal Summary

| # | Site | Group | Permission | Anti-Bot Tier | Approach |
|---|------|-------|------------|---------------|----------|
| 1 | pullandbear.com | Inditex | ⚠️ Ambiguous — ToS prohibits automated scraping; low enforcement for personal use | T3 (Cloudflare + JS challenge) | Internal JSON API |
| 2 | bershka.com/pl/ | Inditex | ⚠️ Ambiguous — same ToS group | T3 (Cloudflare + JS challenge) | Internal JSON API |
| 3 | stradivarius.com/pl/ | Inditex | ⚠️ Ambiguous — same ToS group | T3 (Cloudflare + JS challenge) | Internal JSON API |
| 4 | hm.com | H&M Group | ⚠️ Ambiguous | T2/T3 (Akamai CDN, TLS check) | Internal JSON API |
| 5 | urbanoutfitters.com | URBN | ⚠️ Ambiguous | T3 (Cloudflare) | Internal JSON API |
| 6 | adidas.pl | Adidas | ❌ High risk — Akamai Bot Manager confirmed | T4 (Akamai Bot Manager behavioral) | Architecture only / RSS fallback |
| 7 | nike.com/pl | Nike | ❌ Prohibited — ToS PL explicitly bans robots, scraping, data mining | T4 (Cloudflare Enterprise + queue) | Skip or RSS-only fallback |
| 8 | rossmann.pl | Rossmann PL | ⚠️ Ambiguous — promotions page is public | T2 (light Cloudflare, mostly static) | HTML scraping (curl_cffi + BS4) |
| 9 | hebe.pl | Hebe PL | ⚠️ Ambiguous | T2 (light protection) | HTML scraping (curl_cffi + BS4) |
| 10 | sephora.pl | Sephora/LVMH | ⚠️ Ambiguous | T3 (Cloudflare, JS-rendered) | Playwright/Camoufox |
| 11 | douglas.pl/pl | Douglas | ⚠️ Ambiguous | T2/T3 (light Cloudflare) | curl_cffi + BS4 |

### Legal Notes
- **Nike.com/pl ToS** (Polish version) explicitly forbids: robots, scrapers, data mining, automated access, and using data to train AI/ML models. **Recommendation: skip or use public RSS only.**
- **Adidas.pl** uses Akamai Bot Manager (confirmed across sneaker/bot research). Free tools cannot reliably bypass T4 behavioral analysis. **Recommendation: architecture-only, no live scraping with free tools.**
- All other sites: publicly visible promotional data scraped at low rate for personal use falls in a legally grey but widely tolerated category. Respect robots.txt crawl delays.
- **Never scrape login-gated content, account data, or personal information.**

---

## 2. Site-by-Site Technical Analysis

### 2.1 Inditex Group: Pull&Bear, Bershka, Stradivarius

**Tech Stack:** React SPA frontend + shared Inditex REST JSON API backend. All three brands share the same platform architecture — once you crack one, the others follow the same pattern.

**Key API pattern (confirmed by Apify actors & community research):**
```
# Sale/promotional category listings
GET https://www.bershka.com/itxrest/2/catalog/store/{storeId}/category/{categoryId}/product
    ?languageId={langId}&appId=1&offset=0&limit=40&orderBy=1

# Example storeId: 44009421 (PL), langId: -46 (Polish)
# Sale category IDs differ per brand — must be discovered via DevTools Network tab
```

**Promotion URL targets:**
- Pull&Bear: `https://www.pullandbear.com/pl/sale-n7682.html`
- Bershka: `https://www.bershka.com/pl/sale-n7682.html`
- Stradivarius: `https://www.stradivarius.com/pl/wyprzedaz/`

**Anti-bot:** T3 — Cloudflare standard challenge on the HTML pages, but the **JSON API endpoints are significantly less protected** than HTML pages. `curl_cffi` impersonating Chrome is typically sufficient to hit the API directly.

**Promotion data available per item:**
- `name`, `price` (original), `salePrice` (discounted), `discountPercent`
- `mainImage` URL (CDN-hosted, public)
- `productPageUrl`
- `category`, `colors[]`

**Recommended tool:** `curl_cffi` (Chrome impersonation for TLS fingerprint) + direct JSON API calls. No browser needed.

---

### 2.2 H&M (hm.com)

**Tech Stack:** Next.js SSR/SSG + internal GraphQL/REST API.

**Key API endpoint (documented in community):**
```
GET https://www2.hm.com/pl_pl/sale/women/_jcr_content/main/productlisting.display.json
    ?page=0&page-size=36&sort=ascPrice&format=json
```

**Alternative REST path:**
```
GET https://apifabric.hm.com/articles?country=pl&lang=pl&...
```

**Promotion URL targets:**
- Sale: `https://www2.hm.com/pl_pl/sale/damskie.html`
- New arrivals with discount: category pages with `priceFilter`

**Anti-bot:** T2/T3 — Akamai CDN for assets, but API endpoints often accessible via `curl_cffi`. Moderate header strictness.

**Promotion data:** `name`, `price`, `salePrice`, `discount`, `image`, `pdpUrl`, `availability`

**Recommended tool:** `curl_cffi` with Chrome130 impersonation + Polish locale headers.

---

### 2.3 Urban Outfitters (urbanoutfitters.com)

**Tech Stack:** React + internal Elasticsearch-powered product API.

**Key API endpoint:**
```
GET https://api.urbanoutfitters.com/api/products
    ?category=sale&start=0&rows=48&country=PL&currency=PLN
```

**Promotion URL target:**
- `https://www.urbanoutfitters.com/sale/womens-clothing`

**Anti-bot:** T3 — standard Cloudflare. Note: the site is US-centric; Polish pricing may not be available. Consider using a PL geolocation proxy header or Accept-Language `pl-PL`.

**Recommended tool:** `curl_cffi` (Chrome impersonation) or Camoufox if API endpoints block.

**Data available:** `product_name`, `original_price`, `sale_price`, `discount_pct`, `image_url`, `product_url`

---

### 2.4 Adidas.pl ❌ (T4 — Architecture Only)

**Anti-bot:** Akamai Bot Manager confirmed. This system uses deep behavioral fingerprinting, sensor data validation, and canvas fingerprinting. Free tools (including Camoufox) are unreliable against it.

**Why free tools fail here:**
- Akamai collects `_abck` cookie via JavaScript sensor data (mouse movements, keystrokes, timing patterns)
- Reuse of this cookie across sessions triggers re-validation
- GitHub Actions datacenter IPs have very low Akamai trust scores

**Architecture if paid tools were available:**
```
Residential Proxy (Polish IP) → ScraperAPI/ZenRows with asp=True
  → https://www.adidas.pl/wyprzedaz
  → Extract JSON-LD schema.org/Product blocks
  → Parse image + price + originalPrice + link
```

**Safe free fallback:** Monitor Adidas Poland's promotional RSS or email newsletter instead. No programmatic scraping recommended.

**Paid option (if desired):** ZenRows or ScraperAPI (~$50/mo) with `asp=True` + Polish residential proxy.

---

### 2.5 Nike.com/pl ❌ (Explicitly Prohibited)

**Permission:** ❌ Prohibited. The Polish ToS explicitly forbids: data mining, robots, scrapers, and use of content for AI/ML training.

**Anti-bot:** T4 — Cloudflare Enterprise + IP reputation + queue system. Mobile proxy IPs required for meaningful bypass.

**Recommendation:** Skip entirely or use Nike's public social media/newsletter for promotional awareness. No scraping implementation planned.

---

### 2.6 Rossmann.pl ✅ (Most Accessible)

**Tech Stack:** Hybris/SAP Commerce-based, SSR HTML with structured markup. Promotions page is largely static HTML.

**Target URL:**
```
https://www.rossmann.pl/promocje
```

**Anti-bot:** T2 — light Cloudflare presence, mostly static HTML. `curl_cffi` with realistic browser headers should work cleanly.

**HTML structure (typical Hybris):**
```html
<div class="product-tile product-on-sale">
  <img src="..." class="product-image" />
  <a href="/produkt/..." class="product-name">...</a>
  <span class="regular-price">29,99 zł</span>
  <span class="sale-price">14,99 zł</span>
  <span class="discount-badge">-50%</span>
</div>
```

**Selectors (verify after live fetch):**
- Product container: `.product-tile`, `.product-item`
- Name: `.product-name`, `h3.title`
- Original price: `.regular-price`, `.strike`
- Sale price: `.sale-price`, `.current-price`
- Image: `img.product-image[src]`
- Link: `a.product-name[href]` (relative → prepend `https://www.rossmann.pl`)

**Recommended tool:** `curl_cffi` + `BeautifulSoup4`

**Rate limit:** 1 request per 3–5 seconds. Promotions page is paginated; fetch 2–3 pages max per run (60–90 items total).

---

### 2.7 Hebe.pl ✅ (Accessible)

**Tech Stack:** Custom Polish e-commerce platform, SSR HTML.

**Target URL:**
```
https://www.hebe.pl/promocje/
```

**Anti-bot:** T2 — minimal protection. Standard browser User-Agent headers sufficient.

**HTML structure (typical):**
```html
<article class="product-card">
  <img data-src="...cdn..." class="lazy-img" />
  <a href="/product/...">Product Name</a>
  <del class="old-price">39,99 zł</del>
  <strong class="new-price">19,99 zł</strong>
</article>
```

**Recommended tool:** `curl_cffi` + `BeautifulSoup4` (with `data-src` lazy image handling)

**Note:** Hebe uses lazy loading for images — extract `data-src` attribute, not `src`.

**Rate limit:** 1 request per 2–3 seconds. Scrape up to 2 pages of promotions (~48–60 items).

---

### 2.8 Sephora.pl (T3 — Requires Browser)

**Tech Stack:** SAP Commerce + React hydration, heavy JS rendering. Promotion content is rendered client-side.

**Target URL:**
```
https://www.sephora.pl/promocje/
```

**Anti-bot:** T3 — Cloudflare standard challenge. Raw `requests` or `curl_cffi` will return challenge page. Needs JS execution.

**Recommended tool:** Camoufox (Firefox stealth browser) with Polish locale. Single-page scrape — no deep crawl.

```python
# Camoufox approach
async with AsyncCamoufox(headless=True, geoip=True) as browser:
    page = await browser.new_page()
    await page.goto("https://www.sephora.pl/promocje/")
    await asyncio.sleep(random.uniform(3, 6))  # human-like wait
    products = await page.query_selector_all(".product-item-tile")
```

**Rate limit:** Single run: scrape 1 page only (24–36 items). No pagination crawl.

---

### 2.9 Douglas.pl (T2/T3 — curl_cffi first, fallback to Camoufox)

**Tech Stack:** Douglas EU platform (SAP Commerce hybrid), mostly SSR with some JS hydration.

**Target URL:**
```
https://www.douglas.pl/pl/c/perfumy/wyprzedaz
https://www.douglas.pl/pl/c/kosmetyki/wyprzedaz
```

**Anti-bot:** T2/T3 — moderate Cloudflare. Try `curl_cffi` first; if 403, fall back to Camoufox.

**HTML key selectors:**
- Products: `.product-tile__wrapper`
- Name: `.product-tile__name`
- Price: `.price__sales .value`, `.price__list .value` (original)
- Image: `img.product-tile__image[src]`
- Link: `a.product-tile__details[href]`

**Rate limit:** 1 request per 3 seconds. Max 1–2 pages per category.

---

## 3. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                   GitHub Actions (Cron: daily 06:00 UTC)             │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐   │
│  │  orchestrator.py                                              │   │
│  │    ├── api_scraper.py         ← Pull&Bear, Bershka, Stradivarius, H&M, UO │
│  │    ├── html_scraper.py        ← Rossmann, Hebe, Douglas       │
│  │    └── browser_scraper.py     ← Sephora (Camoufox)            │
│  │                                                               │
│  │  Each scraper writes to: data/{site}_promos.json              │
│  │  Orchestrator merges to: data/all_promos.json                 │
│  └───────────────────────────────────────────────────────────────┘
│                                                                      │
│  On success: git commit → push → GitHub Pages serves JSON            │
└──────────────────────────────────────────────────────────────────────┘

Public URL: https://{username}.github.io/{repo}/data/all_promos.json
```

**GitHub Actions suitability:**
- ✅ `api_scraper.py` — Inditex, H&M, UO via JSON APIs: Works from GitHub IPs (datacenter IPs acceptable for API-level access with proper headers)
- ⚠️ `html_scraper.py` — Rossmann, Hebe, Douglas: Moderate risk. GitHub IPs are well-known but T2 sites usually allow them. Monitor for 403s.
- ⚠️ `browser_scraper.py` — Sephora (Camoufox): Browser automation from a GitHub Actions runner has higher detection risk for T3 sites. **Fallback: run locally via cron if blocked.**

**Fallback deployment (if GitHub runner IPs get blocked):**
- Local machine cron job (residential IP)
- Upload results to GitHub Pages manually or via `rclone` to a static host
- Or: GitLab CI with self-hosted runner (your own residential machine)

---

## 4. Tool Stack Summary

| Site(s) | Tool | Reason |
|---------|------|--------|
| Pull&Bear, Bershka, Stradivarius | `curl_cffi` + JSON API | API less guarded than HTML; TLS impersonation bypasses T3 |
| H&M | `curl_cffi` + JSON API | Akamai CDN on assets, API endpoints accessible |
| Urban Outfitters | `curl_cffi` + JSON API | Cloudflare on HTML, API more permissive |
| Rossmann, Hebe, Douglas | `curl_cffi` + `BeautifulSoup4` | T2 HTML scraping, no JS needed |
| Sephora.pl | `Camoufox` (Firefox stealth browser) | T3 JS challenge requires real browser |
| Adidas.pl | Architecture only — no implementation | T4 Akamai, free tools unreliable |
| Nike.com/pl | Skipped — prohibited by ToS | T4 + explicit ToS prohibition |

**Python packages required:**
```
curl_cffi>=0.7.0
beautifulsoup4>=4.12
lxml>=5.0
camoufox[geoip]>=0.4  # for Sephora only
playwright>=1.40       # Camoufox dependency
asyncio
aiofiles
```

---

## 5. Output Schema

Each scraped record follows this unified JSON schema:

```json
{
  "site": "bershka",
  "scraped_at": "2026-03-27T06:12:03Z",
  "name": "Jeansowe spodnie rurki",
  "original_price": "129.99 PLN",
  "sale_price": "64.99 PLN",
  "discount_pct": 50,
  "image_url": "https://static.bershka.net/assets/.../product.jpg",
  "product_url": "https://www.bershka.com/pl/product-name-c0p12345678.html",
  "category": "spodnie",
  "in_stock": true
}
```

**Merged output file:** `data/all_promos.json`  
**Per-site files:** `data/rossmann_promos.json`, `data/bershka_promos.json`, etc.

---

## 6. Rate Limits per Site

| Site | Delay Between Requests | Max Requests/Day | Safe Items/Day |
|------|----------------------|-----------------|----------------|
| Pull&Bear (API) | 2–4s | 10 | ~200 items |
| Bershka (API) | 2–4s | 10 | ~200 items |
| Stradivarius (API) | 2–4s | 10 | ~200 items |
| H&M (API) | 2–4s | 8 | ~150 items |
| Urban Outfitters (API) | 3–5s | 8 | ~150 items |
| Rossmann (HTML) | 3–6s | 5 | ~100 items |
| Hebe (HTML) | 3–5s | 5 | ~100 items |
| Sephora (browser) | 5–10s + warmup | 3 | ~60 items |
| Douglas (HTML) | 3–6s | 5 | ~80 items |

**Total safe daily scrape: ~1,240 promotional items across 9 active sites.**  
This is a very conservative volume — well within "good citizen" thresholds.

---

## 7. GitHub Actions Workflow

```yaml
# .github/workflows/daily_promo_scraper.yml
name: Daily Promo Scraper

on:
  schedule:
    - cron: '0 6 * * *'   # 06:00 UTC daily (08:00 Polish summer time)
  workflow_dispatch:        # Manual trigger from GitHub UI

jobs:
  scrape:
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
          cache: 'pip'

      - name: Install dependencies
        run: |
          pip install curl_cffi beautifulsoup4 lxml aiofiles
          pip install camoufox[geoip]
          python -m camoufox fetch  # downloads browser binary

      - name: Run scrapers
        run: python src/orchestrator.py

      - name: Commit results
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add data/
          git diff --cached --quiet || git commit -m "chore: promo data update $(date -u +'%Y-%m-%dT%H:%M:%SZ')"
          git push
```

**GitHub Pages config:** Enable in repo Settings → Pages → Deploy from branch `main` → `/ (root)`.

**Public JSON URL:**
```
https://{username}.github.io/{repo-name}/data/all_promos.json
```

---

## 8. Repository Structure

```
promo-scraper/
├── .github/
│   └── workflows/
│       └── daily_promo_scraper.yml
├── src/
│   ├── orchestrator.py          # Runs all scrapers, merges output
│   ├── api_scraper.py           # Inditex, H&M, UO — curl_cffi + JSON API
│   ├── html_scraper.py          # Rossmann, Hebe, Douglas — curl_cffi + BS4
│   ├── browser_scraper.py       # Sephora — Camoufox
│   └── utils.py                 # robots.txt check, rate limiter, output writer
├── data/
│   ├── all_promos.json          # Merged daily output (served via GitHub Pages)
│   ├── bershka_promos.json
│   ├── pullandbear_promos.json
│   ├── stradivarius_promos.json
│   ├── hm_promos.json
│   ├── urbanoutfitters_promos.json
│   ├── rossmann_promos.json
│   ├── hebe_promos.json
│   ├── sephora_promos.json
│   └── douglas_promos.json
├── requirements.txt
└── README.md
```

---

## 9. Implementation Phases

### Phase 1 (Days 1–2): Foundation
- Set up GitHub repo with Actions workflow skeleton
- Implement `utils.py` (robots.txt checker, rate limiter, JSON writer)
- Implement `html_scraper.py` for Rossmann + Hebe (easiest T2 targets)
- Verify output schema, test locally

### Phase 2 (Days 3–4): API Scrapers
- Open DevTools Network tab on each Inditex site's `/wyprzedaz` page
- Capture the actual API endpoint, storeId, categoryId, languageId parameters
- Implement `api_scraper.py` for Pull&Bear, Bershka, Stradivarius
- Add H&M + Urban Outfitters to the same script
- Test with 1 request per site before enabling full run

### Phase 3 (Day 5): Browser Scraper
- Implement Camoufox scraper for Sephora.pl
- Add Douglas.pl to HTML scraper (try curl_cffi first, fallback to Camoufox)
- Test browser warmup + cookie handling

### Phase 4 (Day 6): Integration & Deployment
- Implement `orchestrator.py` with sequential execution + error handling per site
- Deploy GitHub Actions workflow
- Enable GitHub Pages
- Verify `all_promos.json` is publicly accessible

### Phase 5 (Ongoing): Maintenance
- Monitor GitHub Actions run logs weekly
- Update API parameters if Inditex changes storeId/categoryId
- Rotate User-Agent strings monthly (use latest Chrome version)
- Check for new WAF headers if 403s increase

---

## 10. Known Failure Modes & Fixes

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| HTTP 403 from Inditex API | IP reputation block or missing cookie | Add `Referer` + `Origin` headers matching the brand domain |
| Empty product list from Inditex | Wrong `storeId` or `categoryId` for PL | Re-capture via DevTools Network tab on `/wyprzedaz` page |
| Sephora returns Cloudflare challenge | Bot detection on headless browser | Add Camoufox `geoip=True`, increase warmup delay to 8–12s |
| H&M JSON returns empty `products[]` | Locale/currency headers missing | Ensure `Accept-Language: pl-PL`, `X-Country: PL` headers |
| Rossmann HTML layout changed | Hybris frontend update | Re-inspect selectors on live promotions page |
| GitHub Actions run blocked | Datacenter IP reputation drop | Switch to local cron + upload-only job in CI |

---

## 11. Sites NOT Implemented (Summary)

| Site | Reason |
|------|--------|
| **nike.com/pl** | ToS explicitly bans scraping, robots, data mining. T4 protection. Skip. |
| **adidas.pl** | T4 Akamai Bot Manager — free tools cannot reliably bypass. Use newsletter/RSS monitoring instead. |

**Alternative for Adidas & Nike promotions:**
- Subscribe to their Polish mailing lists → extract promotions from emails (no scraping needed)
- Monitor their official Instagram accounts via public API (Instagram Basic Display API)
- Check aggregator sites like pepper.pl or promocje24.pl which legally republish their deals

---

## 12. Gemini Briefing — How to Use This Document

Paste this entire document into Google AI Studio or Gemini API as your first message, then ask for:
- `"Write the full api_scraper.py for Pull&Bear, Bershka and Stradivarius based on Section 2.1"`
- `"Write the html_scraper.py for Rossmann and Hebe based on Sections 2.6 and 2.7"`
- `"Write the Camoufox browser_scraper.py for Sephora.pl based on Section 2.8"`
- `"Write the orchestrator.py that runs all three scrapers sequentially and merges output"`
- `"The Bershka scraper is returning 403 — what headers am I missing? See Section 2.1"`

> **Model recommendation:** Use `gemini-2.5-pro` for architecture tasks and code generation. Use `gemini-2.5-flash` for quick header/selector debugging questions.

**Tools section must include:** Respect `DELAY_MIN`/`DELAY_MAX` from Section 6. Never remove `asyncio.sleep()`. Default output is JSON per Section 5. Use GitHub Actions + Pages from Section 7.
