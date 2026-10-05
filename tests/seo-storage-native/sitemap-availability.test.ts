import assert from 'node:assert/strict';
import { test } from 'vitest';

test('public collection sitemap XML producer is available', async () => {
  let product: Record<string, unknown> = {};
  const path = '../../src/lib/server/seo/sitemap-response.ts';
  try { product = await import(path); }
  catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
  }
  assert.equal(typeof product.collectionSitemapResponse, 'function');
});
