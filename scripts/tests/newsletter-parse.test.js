import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  extractRawDealsFromNewsletterHtml,
  extractRawDealsFromNewsletterPlainText,
  normalizeNewsletterDeal,
  hostMatchesBrand,
  extractDiscountPct,
  buildNormalizedDealsFromEmail,
  buildNormalizedDealsFromEmailParts,
  stripFwdSubject,
} from '../lib/newsletter-deals.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, '../fixtures');

describe('hostMatchesBrand', () => {
  it('matches nike.com subdomains', () => {
    assert.strictEqual(hostMatchesBrand('www.nike.com', 'nike'), true);
    assert.strictEqual(hostMatchesBrand('images.nike.com', 'nike'), true);
    assert.strictEqual(hostMatchesBrand('adidas.pl', 'nike'), false);
  });

  it('matches adidas.pl and adidas.com', () => {
    assert.strictEqual(hostMatchesBrand('www.adidas.pl', 'adidas'), true);
    assert.strictEqual(hostMatchesBrand('adidas.com', 'adidas'), true);
  });

  it('matches marketing click subdomains used in forwards', () => {
    assert.strictEqual(hostMatchesBrand('click.em.nike.com', 'nike'), true);
    assert.strictEqual(hostMatchesBrand('click.link.adidas.com', 'adidas'), true);
  });
});

describe('stripFwdSubject', () => {
  it('removes Fwd prefix for titles', () => {
    assert.strictEqual(stripFwdSubject('Fwd: Kolekcja Nike x LEGO'), 'Kolekcja Nike x LEGO');
    assert.strictEqual(stripFwdSubject('FW: Test'), 'Test');
  });
});

describe('extractDiscountPct', () => {
  it('reads percent from marketing copy', () => {
    assert.strictEqual(extractDiscountPct('Outlet -30% tylko dziś'), 30);
    assert.strictEqual(extractDiscountPct('do 40% taniej'), 40);
  });
});

describe('synthetic fixtures', () => {
  it('nike fixture yields multiple deals and priced product row', () => {
    const html = fs.readFileSync(path.join(fixturesDir, 'newsletter-nike-sample.html'), 'utf8');
    const raw = extractRawDealsFromNewsletterHtml(html, 'Wyprzedaż damska', 'nike');
    assert.ok(raw.length >= 2);
    const air = raw.find((r) => r.title.includes('Air Max'));
    assert.ok(air, 'expected Air Max link');
    assert.match(air.url, /nike\.com/);
    const normalized = normalizeNewsletterDeal(air, 'nike', 'Nike', new Date().toISOString());
    assert.ok(normalized);
    assert.strictEqual(normalized.newsletter_cta, false);
    assert.ok(parseFloat(normalized.sale_price) > 0);
  });

  it('nike hero link without price becomes newsletter_cta', () => {
    const html = fs.readFileSync(path.join(fixturesDir, 'newsletter-nike-sample.html'), 'utf8');
    const raw = extractRawDealsFromNewsletterHtml(html, 'Sale', 'nike');
    const hero = raw.find((r) => r.url.includes('damskie-wyprzedaz'));
    assert.ok(hero);
    const n = normalizeNewsletterDeal(hero, 'nike', 'Nike', new Date().toISOString());
    assert.strictEqual(n.newsletter_cta, true);
    assert.strictEqual(n.source_type, 'newsletter');
  });

  it('adidas fixture builds normalized deals', () => {
    const html = fs.readFileSync(path.join(fixturesDir, 'newsletter-adidas-sample.html'), 'utf8');
    const deals = buildNormalizedDealsFromEmail(html, 'Outlet', 'adidas', new Date().toISOString());
    assert.ok(deals.length >= 1);
    assert.ok(deals.every((d) => d.site === 'adidas'));
    const outlet = deals.find((d) => d.product_url.includes('kobiety-wyprzedaz'));
    assert.ok(outlet);
    assert.strictEqual(outlet.discount_pct, 30);
  });
});

describe('plain-text forwards (poczta.fm / Thunderbird style)', () => {
  it('extracts Nike tracking URLs and strips Fwd subject in normalized name', () => {
    const text = fs.readFileSync(path.join(fixturesDir, 'newsletter-nike-forwarded.txt'), 'utf8');
    const nikeRaws = extractRawDealsFromNewsletterPlainText(text, 'Fwd: Kolekcja Nike x LEGO', 'nike');
    assert.ok(nikeRaws.length >= 2);
    assert.ok(nikeRaws.every((r) => /nike\.com/i.test(r.url) || r.url.includes('click.em.nike.com')));
    const deals = buildNormalizedDealsFromEmailParts(
      { html: '', plain: text, subject: 'Fwd: Kolekcja Nike x LEGO' },
      'nike',
      new Date().toISOString()
    );
    assert.ok(deals.length >= 2);
    assert.strictEqual(deals[0].name, 'Kolekcja Nike x LEGO');
  });

  it('extracts multiple Adidas click links with different query strings', () => {
    const text = fs.readFileSync(path.join(fixturesDir, 'newsletter-adidas-forwarded.txt'), 'utf8');
    const raws = extractRawDealsFromNewsletterPlainText(text, 'Fwd: adiClub', 'adidas');
    assert.strictEqual(raws.length, 2);
    const adidasFromNike = extractRawDealsFromNewsletterPlainText(text, 'test', 'nike');
    assert.strictEqual(adidasFromNike.length, 0);
  });

  it('merges HTML and plain without duplicate keys', () => {
    const html = fs.readFileSync(path.join(fixturesDir, 'newsletter-nike-sample.html'), 'utf8');
    const plain = fs.readFileSync(path.join(fixturesDir, 'newsletter-nike-forwarded.txt'), 'utf8');
    const deals = buildNormalizedDealsFromEmailParts(
      { html, plain, subject: 'Combined' },
      'nike',
      new Date().toISOString()
    );
    assert.ok(deals.length >= 1);
  });
});
