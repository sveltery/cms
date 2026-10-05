import assert from 'node:assert/strict';
import { test } from 'node:test';

// Native product requirements; these are not copied Source assertions.
const boundaries = [
  ['../src/lib/server/seo/repository.ts', 'SeoRepository'],
  ['../src/lib/server/seo/sitemap.ts', 'handleSitemapData'],
  ['../src/lib/server/seo/hreflang.ts', 'getHreflangAlternatesWithDb']
] as const;

for (const [path, name] of boundaries) {
  test('persisted SEO API is available: ' + name, async () => {
    let product: Record<string, unknown> = {};
    try {
      product = await import(path);
    } catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
    }
    assert.equal(typeof product[name], 'function', name);
  });
}
