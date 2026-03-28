/**
 * Resolve a product hero image from Inditex `productsArray` bundle detail.
 * New APIs expose full CDN URLs under xmedia; legacy `/N/photos` + suffix patterns often 404.
 *
 * @param {object|null|undefined} detail - `bundleProductSummaries[].detail`
 * @param {{ legacyHost?: string, legacyPathPrefix?: string, legacySuffix?: string }} [legacy]
 * @returns {string|null}
 */
export function inditexDetailMainImageUrl(detail, legacy = {}) {
  if (!detail || typeof detail !== 'object') return null;

  for (const xm of detail.xmedia || []) {
    for (const xi of xm?.xmediaItems || []) {
      for (const m of xi?.medias || []) {
        let u = m?.url || m?.extraInfo?.deliveryUrl;
        if (typeof u !== 'string' || !u.startsWith('http')) continue;
        u = u.replace(/([?&])w=:width:?/gi, '').replace(/&w=:width:?/gi, '');
        if (u.endsWith('&') || u.endsWith('?')) u = u.slice(0, -1);
        return u;
      }
    }
  }

  const rel = detail.colors?.[0]?.image?.url;
  if (typeof rel !== 'string' || !rel.trim()) return null;
  const path = rel.startsWith('/') ? rel : `/${rel}`;
  const prefix = legacy.legacyPathPrefix ?? '/2/photos';
  const suffix = legacy.legacySuffix ?? '_2_1_8.jpg';
  const host = legacy.legacyHost;
  if (!host) return null;
  return `https://${host}${prefix}${path}${suffix}`;
}
