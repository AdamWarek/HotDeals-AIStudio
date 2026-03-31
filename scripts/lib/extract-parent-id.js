/**
 * Extracts a canonical "parent product ID" from a deal's site, URL, and name.
 *
 * Products listed multiple times as color/size variants share the same parent ID,
 * allowing deduplication to a single card per product.
 *
 * @param {string} site  - Scraper identifier (e.g. 'bershka', 'hm', 'douglas')
 * @param {string} url   - Product URL (may include query params)
 * @param {string} name  - Product display name (fallback when URL is absent)
 * @returns {string} Opaque key suitable for Map lookups — never rendered as HTML.
 */

const MAX_URL_LENGTH = 2048;

export function extractParentId(site, url, name) {
  const safeSite = String(site || '').toLowerCase();
  const safePath = String(url || '').slice(0, MAX_URL_LENGTH).split('?')[0];
  const safeName = String(name || '').trim().toLowerCase();

  switch (safeSite) {
    case 'bershka':
    case 'pullandbear': {
      const m = safePath.match(/\/([^/]+)-c0p\d+\.html$/);
      return m ? `${safeSite}|${m[1]}` : `${safeSite}|${safePath || safeName}`;
    }
    case 'stradivarius': {
      const m = safePath.match(/\/([^/]+)-l\d+$/);
      return m ? `${safeSite}|${m[1]}` : `${safeSite}|${safePath || safeName}`;
    }
    case 'hm': {
      const m = safePath.match(/productpage\.(\d{7})\d{3}\.html$/);
      return m ? `${safeSite}|${m[1]}` : `${safeSite}|${safePath || safeName}`;
    }
    case 'douglas': {
      const m = safePath.match(/\/p\/(\d+)/);
      return m ? `${safeSite}|${m[1]}` : `${safeSite}|${safePath || safeName}`;
    }
    case 'sephora': {
      const m = safePath.match(/\/p\/(.+)-P\d+\.html$/);
      return m ? `${safeSite}|${m[1]}` : `${safeSite}|${safePath || safeName}`;
    }
    default:
      return `${safeSite}|${safePath || safeName}`;
  }
}
