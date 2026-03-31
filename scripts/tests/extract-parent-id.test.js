import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractParentId } from '../lib/extract-parent-id.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* ──────────────────────────────────────────────────────────────────────────────
 * Per-brand happy-path tests
 * ────────────────────────────────────────────────────────────────────────────── */

describe('extractParentId — per-brand happy path', () => {
  it('Bershka: two c0p color variants produce the same parent key', () => {
    const a = extractParentId(
      'bershka',
      'https://www.bershka.com/pl/jeansy baggy flare z niskim stanem-c0p209100349.html',
      'Jeansy baggy flare z niskim stanem',
    );
    const b = extractParentId(
      'bershka',
      'https://www.bershka.com/pl/jeansy baggy flare z niskim stanem-c0p209100350.html',
      'Jeansy baggy flare z niskim stanem',
    );
    assert.strictEqual(a, b);
    assert.ok(a.startsWith('bershka|'));
  });

  it('Pull&Bear: two c0p variants produce the same parent key', () => {
    const a = extractParentId(
      'pullandbear',
      'https://www.pullandbear.com/pl/jeansy proste o średnim stanie-c0p721442120.html',
      'Jeansy proste',
    );
    const b = extractParentId(
      'pullandbear',
      'https://www.pullandbear.com/pl/jeansy proste o średnim stanie-c0p721442121.html',
      'Jeansy proste',
    );
    assert.strictEqual(a, b);
    assert.ok(a.startsWith('pullandbear|'));
  });

  it('Stradivarius: two -l{id} variants produce the same parent key', () => {
    const a = extractParentId(
      'stradivarius',
      'https://www.stradivarius.com/pl/bluzka-z-dlugim-rekawem-i-marszczeniami-l06522887',
      'Bluzka',
    );
    const b = extractParentId(
      'stradivarius',
      'https://www.stradivarius.com/pl/bluzka-z-dlugim-rekawem-i-marszczeniami-l06522999',
      'Bluzka',
    );
    assert.strictEqual(a, b);
    assert.ok(a.startsWith('stradivarius|'));
  });

  it('H&M: two article+color URLs produce the same 7-digit parent key', () => {
    const a = extractParentId(
      'hm',
      'https://www2.hm.com/pl_pl/productpage.1276500005.html',
      'Bawełniana koszulka',
    );
    const b = extractParentId(
      'hm',
      'https://www2.hm.com/pl_pl/productpage.1276500003.html',
      'Bawełniana koszulka',
    );
    assert.strictEqual(a, b);
    assert.ok(a.startsWith('hm|'));
    assert.ok(a.includes('1276500'));
  });

  it('Douglas: URL with and without ?variant= produce the same key', () => {
    const a = extractParentId(
      'douglas',
      'https://www.douglas.pl/pl/p/5011406025?variant=1176639',
      'ARMANI Luminous silk',
    );
    const b = extractParentId(
      'douglas',
      'https://www.douglas.pl/pl/p/5011406025',
      'ARMANI Luminous silk',
    );
    assert.strictEqual(a, b);
    assert.ok(a.includes('5011406025'));
  });

  it('Sephora: two -P{id} variants produce the same parent key', () => {
    const a = extractParentId(
      'sephora',
      'https://www.sephora.pl/p/best-skin-ever-podklad-P10062276.html',
      'Best Skin Ever Podkład',
    );
    const b = extractParentId(
      'sephora',
      'https://www.sephora.pl/p/best-skin-ever-podklad-P10062299.html',
      'Best Skin Ever Podkład',
    );
    assert.strictEqual(a, b);
    assert.ok(a.startsWith('sephora|'));
  });

  it('Rossmann/Hebe default: different URLs produce different keys', () => {
    const a = extractParentId(
      'rossmann',
      'https://www.rossmann.pl/Produkt/Ruby-Drip,2120699,13014',
      'Ruby Drip',
    );
    const b = extractParentId(
      'rossmann',
      'https://www.rossmann.pl/Produkt/Juicy-Peach,2120697,13014',
      'Juicy Peach',
    );
    assert.notStrictEqual(a, b);
  });
});

/* ──────────────────────────────────────────────────────────────────────────────
 * Edge cases
 * ────────────────────────────────────────────────────────────────────────────── */

describe('extractParentId — edge cases', () => {
  it('null/undefined/empty URL falls back to name', () => {
    const a = extractParentId('bershka', null, 'Some Product');
    const b = extractParentId('bershka', undefined, 'Some Product');
    const c = extractParentId('bershka', '', 'Some Product');
    assert.strictEqual(a, b);
    assert.strictEqual(b, c);
    assert.ok(a.includes('some product'));
  });

  it('null URL AND null name returns site-only key', () => {
    const result = extractParentId('bershka', null, null);
    assert.strictEqual(result, 'bershka|');
  });

  it('unknown brand uses default path-based key', () => {
    const result = extractParentId(
      'newshop',
      'https://newshop.pl/product/abc-123',
      'ABC Product',
    );
    assert.ok(result.startsWith('newshop|'));
    assert.ok(result.includes('newshop.pl'));
  });

  it('URL exceeding 2048 chars is truncated safely', () => {
    const longUrl = 'https://www.bershka.com/pl/' + 'a'.repeat(3000) + '-c0p123.html';
    const result = extractParentId('bershka', longUrl, 'Test');
    assert.ok(typeof result === 'string');
    assert.ok(result.length < 2200);
  });

  it('URL with special characters (%20, unicode) handled without error', () => {
    const result = extractParentId(
      'bershka',
      'https://www.bershka.com/pl/jeansy%20baggy%20flare-c0p209100349.html',
      'Jeansy baggy',
    );
    assert.ok(result.startsWith('bershka|'));
  });
});

/* ──────────────────────────────────────────────────────────────────────────────
 * Security vectors
 * ────────────────────────────────────────────────────────────────────────────── */

describe('extractParentId — security', () => {
  it('ReDoS payload: long repeated patterns complete in < 50ms', () => {
    const malicious = 'https://evil.com/' + 'a'.repeat(10000) + '-c0p' + '1'.repeat(10000) + '.html';
    const start = performance.now();
    extractParentId('bershka', malicious, 'test');
    const elapsed = performance.now() - start;
    assert.ok(elapsed < 50, `ReDoS: took ${elapsed.toFixed(1)}ms, expected < 50ms`);
  });

  it('javascript: URL does not crash and returns safe fallback key', () => {
    const result = extractParentId('bershka', 'javascript:alert(1)', 'XSS Product');
    assert.ok(typeof result === 'string');
    assert.ok(result.startsWith('bershka|'));
  });

  it('__proto__ / constructor as site name does not cause prototype pollution', () => {
    const map = new Map();
    const keyA = extractParentId('__proto__', 'https://x.com/a', 'A');
    const keyB = extractParentId('constructor', 'https://x.com/b', 'B');
    map.set(keyA, { price: 10 });
    map.set(keyB, { price: 20 });

    assert.strictEqual(map.size, 2);
    assert.strictEqual(({}).test, undefined);
    assert.strictEqual(Object.prototype.test, undefined);
  });
});

/* ──────────────────────────────────────────────────────────────────────────────
 * Integration: dedup against real deals.json
 * ────────────────────────────────────────────────────────────────────────────── */

describe('extractParentId — integration with deals.json', () => {
  it('Bershka "Jeansy baggy flare" collapses from 3 rows to 1', () => {
    const dealsPath = path.join(__dirname, '../../public/deals.json');
    if (!fs.existsSync(dealsPath)) {
      // Skip gracefully in CI where deals.json may not exist
      return;
    }

    const deals = JSON.parse(fs.readFileSync(dealsPath, 'utf8'));
    const bershkaJeansy = deals.filter(
      (d) => d.site === 'bershka' && /jeansy baggy flare z niskim stanem/i.test(d.name),
    );

    assert.ok(bershkaJeansy.length >= 2, `Expected ≥2 Bershka "jeansy baggy flare" rows, got ${bershkaJeansy.length}`);

    const parentIds = new Set(
      bershkaJeansy.map((d) => extractParentId(d.site, d.product_url || d.url, d.name)),
    );
    assert.strictEqual(parentIds.size, 1, `Expected 1 unique parent ID, got ${parentIds.size}: ${[...parentIds].join(', ')}`);
  });
});
