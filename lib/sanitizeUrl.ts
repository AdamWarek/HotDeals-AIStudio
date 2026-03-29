const SAFE_PROTOCOLS = new Set(['https:', 'http:']);

/**
 * Returns the URL unchanged if it uses a safe protocol (http/https),
 * otherwise returns '#' to neutralize javascript:, data:, and other
 * dangerous URI schemes that could be injected via scraped data.
 */
export function sanitizeUrl(url: string | undefined | null): string {
  if (!url) return '#';
  try {
    const parsed = new URL(url);
    return SAFE_PROTOCOLS.has(parsed.protocol) ? url : '#';
  } catch {
    return '#';
  }
}
