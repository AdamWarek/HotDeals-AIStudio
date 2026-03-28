/**
 * Extract and normalize promotional rows from brand marketing email HTML and plain text.
 * Shared by ingest-newsletters.js and tests.
 */

import { load } from 'cheerio';

/**
 * Strip common forward prefixes from Subject (Thunderbird / Outlook).
 * @param {string} subject
 */
export function stripFwdSubject(subject) {
  if (!subject || typeof subject !== 'string') return '';
  return subject
    .replace(/^\s*(fwd|fw|wg|przekazana wiadomość|przekazano)\s*:\s*/i, '')
    .trim();
}

function dedupeKeyFromUrl(urlStr) {
  try {
    const o = new URL(urlStr);
    return `${o.hostname}${o.pathname}${o.search}`;
  } catch {
    return urlStr;
  }
}

/**
 * Prefer HTML rows (richer titles/images); add plain-only URLs not seen in HTML.
 * @param {object[]} htmlRaws
 * @param {object[]} plainRaws
 */
export function mergeRawDealsByUrl(htmlRaws, plainRaws) {
  const map = new Map();
  for (const r of htmlRaws) {
    map.set(dedupeKeyFromUrl(r.url), r);
  }
  for (const r of plainRaws) {
    const k = dedupeKeyFromUrl(r.url);
    if (!map.has(k)) map.set(k, r);
  }
  return [...map.values()];
}

/** Parse "129,99 PLN", "129.99 zł", or number → float */
export function parsePlnAmount(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const t = String(value).replace(/[^\d,.]/g, '').replace(',', '.');
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {string} hostname
 * @param {'nike' | 'adidas'} brand
 */
export function hostMatchesBrand(hostname, brand) {
  const h = String(hostname)
    .replace(/^www\./, '')
    .toLowerCase();
  if (brand === 'nike') {
    return h === 'nike.com' || h.endsWith('.nike.com');
  }
  if (brand === 'adidas') {
    return (
      h === 'adidas.pl' ||
      h.endsWith('.adidas.pl') ||
      h === 'adidas.com' ||
      h.endsWith('.adidas.com')
    );
  }
  return false;
}

/**
 * @param {string} blob
 * @returns {number}
 */
export function extractDiscountPct(blob) {
  const m = String(blob).match(/(?:^|[^\d])(\d{1,2})\s*%/);
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  return n > 0 && n < 100 ? n : 0;
}

/**
 * Try "od 399,99 zł" / "399.99 PLN"
 * @param {string} blob
 * @returns {{ sale: number | null, original: number | null }}
 */
export function extractPricesFromText(blob) {
  const text = String(blob);
  const od = text.match(/od\s+([\d,.]+)\s*(?:zł|pln)?/i);
  if (od) {
    const sale = parsePlnAmount(od[1]);
    return { sale, original: null };
  }
  const pair = text.match(/([\d,.]+)\s*(?:zł|pln).{0,12}([\d,.]+)\s*(?:zł|pln)/i);
  if (pair) {
    const a = parsePlnAmount(pair[1]);
    const b = parsePlnAmount(pair[2]);
    if (a != null && b != null) {
      const hi = Math.max(a, b);
      const lo = Math.min(a, b);
      return { sale: lo, original: hi };
    }
  }
  return { sale: null, original: null };
}

/**
 * @param {string} html
 * @param {string} subject
 * @param {'nike' | 'adidas'} brand
 * @returns {Array<{ url: string, image: string, title: string, sale_price?: string, original_price?: string, discount?: string, category?: string }>}
 */
export function extractRawDealsFromNewsletterHtml(html, subject, brand) {
  if (!html || typeof html !== 'string') return [];
  const $ = load(html, { decodeEntities: true });
  const raw = [];
  const seen = new Set();

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href || href.startsWith('mailto:') || href.startsWith('#')) return;
    let urlObj;
    try {
      urlObj = new URL(href, 'https://www.nike.com');
    } catch {
      return;
    }
    if (!hostMatchesBrand(urlObj.hostname, brand)) return;

    const dedupeKey = dedupeKeyFromUrl(href.trim());
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);

    const text = $(el).text().replace(/\s+/g, ' ').trim();
    const img = $(el).find('img').first();
    let imgSrc = img.attr('src') || '';
    const alt = (img.attr('alt') || '').trim();
    if (imgSrc && imgSrc.startsWith('//')) imgSrc = `https:${imgSrc}`;

    const blob = `${text} ${alt} ${subject || ''}`;
    const discountPct = extractDiscountPct(blob);
    const prices = extractPricesFromText(blob);

    const title = (text || alt || subject || 'Promocja newsletter').slice(0, 220);

    raw.push({
      url: href.trim(),
      image: imgSrc,
      title,
      sale_price: prices.sale != null ? String(prices.sale) : undefined,
      original_price: prices.original != null ? String(prices.original) : undefined,
      discount: discountPct > 0 ? `-${discountPct}%` : undefined,
      category: 'Newsletter',
    });
  });

  return raw.slice(0, 24);
}

/**
 * Extract https URLs from plain-text forwards (Thunderbird-style), keep brand hosts only.
 * @param {string} text
 * @param {string} subject
 * @param {'nike' | 'adidas'} brand
 */
export function extractRawDealsFromNewsletterPlainText(text, subject, brand) {
  if (!text || typeof text !== 'string') return [];
  const seen = new Set();
  const raw = [];
  const re = /https?:\/\/[^\s<>"']+/g;
  const titleBase = stripFwdSubject(subject) || 'Promocja newsletter';
  let m;

  while ((m = re.exec(text)) !== null) {
    let href = m[0].replace(/[),\].;>]+$/g, '');
    let urlObj;
    try {
      urlObj = new URL(href);
    } catch {
      continue;
    }
    if (!hostMatchesBrand(urlObj.hostname, brand)) continue;

    const dedupeKey = dedupeKeyFromUrl(href.trim());
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const lineStart = text.lastIndexOf('\n', m.index) + 1;
    const lineEnd = text.indexOf('\n', m.index);
    const line = text.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
    const blob = `${line} ${subject || ''}`;
    const discountPct = extractDiscountPct(blob);
    const prices = extractPricesFromText(blob);

    raw.push({
      url: href.trim(),
      image: '',
      title: titleBase.slice(0, 220),
      sale_price: prices.sale != null ? String(prices.sale) : undefined,
      original_price: prices.original != null ? String(prices.original) : undefined,
      discount: discountPct > 0 ? `-${discountPct}%` : undefined,
      category: 'Newsletter',
    });
  }

  return raw.slice(0, 24);
}

/**
 * @param {object} raw
 * @param {string} brandId
 * @param {string} brandName
 * @param {string} scrapedAt ISO
 */
export function normalizeNewsletterDeal(raw, brandId, brandName, scrapedAt) {
  const productUrl = raw.url || raw.product_url || '';
  if (!productUrl) return null;

  const discountStr = raw.discount || '';
  let discountPct = parseInt(discountStr.replace(/[^\d]/g, ''), 10) || 0;
  if (discountPct === 0 && raw.discount_pct) {
    discountPct = parseInt(String(raw.discount_pct), 10) || 0;
  }

  let saleVal =
    parsePlnAmount(raw.sale_price) ??
    parsePlnAmount(raw.price) ??
    parsePlnAmount(raw.salePrice) ??
    0;

  let originalVal =
    parsePlnAmount(raw.original_price) ??
    parsePlnAmount(raw.originalPrice) ??
    parsePlnAmount(raw.regular_price) ??
    null;

  if (originalVal != null && saleVal > 0 && originalVal < saleVal) {
    const tmp = originalVal;
    originalVal = saleVal;
    saleVal = tmp;
  }

  if (originalVal == null && discountPct > 0 && discountPct < 100 && saleVal > 0) {
    originalVal = saleVal / (1 - discountPct / 100);
  }

  if (
    originalVal != null &&
    saleVal > 0 &&
    originalVal > saleVal &&
    (discountPct === 0 || !discountStr)
  ) {
    discountPct = Math.round(((originalVal - saleVal) / originalVal) * 100);
  }

  const name = raw.title || raw.name || 'Newsletter';
  const baseDescription = raw.description || `Oferta z newslettera ${brandName}`;

  if (!(saleVal > 0)) {
    return {
      site: brandId,
      scraped_at: scrapedAt,
      name,
      original_price: '0.00 PLN',
      sale_price: '0.00 PLN',
      discount_pct: discountPct,
      image_url: raw.image || raw.image_url || '',
      product_url: productUrl,
      category: raw.category || 'Newsletter',
      in_stock: true,
      title: name,
      brand: brandName,
      discount: discountPct > 0 ? `-${discountPct}%` : null,
      price: '0',
      currency: 'PLN',
      url: productUrl,
      image: raw.image || raw.image_url || '',
      description: baseDescription,
      valid_until: null,
      tags: ['newsletter', brandId],
      confidence_score: 0.65,
      source_type: 'newsletter',
      source_name: brandName,
      newsletter_cta: true,
    };
  }

  if (originalVal == null && saleVal > 0) {
    originalVal = saleVal;
  }
  if (originalVal == null || !Number.isFinite(originalVal)) {
    originalVal = saleVal;
  }

  const confidence = Math.min(0.88, raw.confidence_score ?? 0.82);

  return {
    site: brandId,
    scraped_at: scrapedAt,
    name,
    original_price: `${originalVal.toFixed(2)} PLN`,
    sale_price: `${saleVal.toFixed(2)} PLN`,
    discount_pct: discountPct,
    image_url: raw.image || raw.image_url || '',
    product_url: productUrl,
    category: raw.category || 'Newsletter',
    in_stock: raw.in_stock !== false,
    title: name,
    brand: brandName,
    discount: discountPct > 0 ? `-${discountPct}%` : null,
    price: String(saleVal),
    currency: raw.currency || 'PLN',
    url: productUrl,
    image: raw.image || raw.image_url || '',
    description: baseDescription,
    valid_until: raw.valid_until || null,
    tags: raw.tags || ['newsletter', brandId],
    confidence_score: confidence,
    source_type: 'newsletter',
    source_name: brandName,
    newsletter_cta: false,
  };
}

/**
 * @param {{ html?: string, plain?: string, subject?: string }} parts
 * @param {'nike' | 'adidas'} brandKey
 * @param {string} scrapedAt
 */
export function buildNormalizedDealsFromEmailParts(parts, brandKey, scrapedAt) {
  const id = brandKey;
  const name = brandKey === 'nike' ? 'Nike' : 'Adidas';
  const html = parts.html || '';
  const plain = parts.plain || '';
  const subject = parts.subject || '';
  const htmlRaws = extractRawDealsFromNewsletterHtml(html, subject, brandKey);
  const plainRaws = extractRawDealsFromNewsletterPlainText(plain, subject, brandKey);
  const merged = mergeRawDealsByUrl(htmlRaws, plainRaws).slice(0, 24);
  const out = [];
  for (const raw of merged) {
    const row = normalizeNewsletterDeal(raw, id, name, scrapedAt);
    if (row) out.push(row);
  }
  return out;
}

/**
 * @param {string} html
 * @param {string} subject
 * @param {'nike' | 'adidas'} brandKey
 * @param {string} scrapedAt
 */
export function buildNormalizedDealsFromEmail(html, subject, brandKey, scrapedAt) {
  return buildNormalizedDealsFromEmailParts({ html, plain: '', subject }, brandKey, scrapedAt);
}
