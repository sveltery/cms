// Supplemental native creation boundaries, not ported source declarations.
// Expected values reproduced against packages/admin/src/slugify.ts at EmDash
// 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e. MIT Copyright 2026 Cloudflare Inc.
// See notices/emdash-MIT.txt and docs/native-content-editor.md.
import { it } from 'node:test';
import assert from 'node:assert/strict';

const { slugify } = await import(new URL('../src/lib/ui/content-slug.ts', import.meta.url).href).catch(cause => {
  if (cause.code !== 'ERR_MODULE_NOT_FOUND') throw cause;
  // Assertion-level red before the pinned implementation is added.
  return { slugify: (_text: string, _limit?: number) => undefined };
});

it('generates the source editor slug for an ordinary title', () => {
  assert.equal(slugify('My Amazing Blog Post'), 'my-amazing-blog-post');
});

it('keeps usable Unicode letters instead of silently using an ASCII slug', () => {
  assert.equal(slugify('Zażółć Gęślą Jaźń'), 'zażółć-gęślą-jaźń');
  assert.equal(slugify('東京のお知らせ'), '東京のお知らせ');
  assert.equal(slugify('مرحبا بالعالم'), 'مرحبا-بالعالم');
});

it('normalizes compatibility characters and collapses separators and unsafe punctuation', () => {
  assert.equal(slugify('ＡＢＣ １２３___Test'), 'abc-123-test');
  assert.equal(slugify('___Hello,,,   World--- '), 'hello-world');
});

it('uses the stable pinned fallback when the title has no usable character', () => {
  assert.equal(slugify('😀💫'), 'untitled-0kgd53w');
  assert.equal(slugify('😀💫', 7), 'untitle');
});

it('limits graphemes without splitting combining marks or leaving a trailing hyphen', () => {
  assert.equal(slugify('क़क़क़', 2), 'क़क़');
  assert.equal(slugify('a\u0301 b\u0301 c\u0301', 2), 'á');
  assert.equal(slugify('hello world', 6), 'hello');
});

it('retains the pinned zero, fractional and unbounded length behavior', () => {
  assert.equal(slugify('hello', 0), '');
  assert.equal(slugify('hello', 2.9), 'he');
  assert.equal(slugify('hello', Infinity), 'hello');
});
