// Adapted from EmDash 1.1.0 cursor.test.ts at
// 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e. Copyright 2026 Cloudflare Inc.
// MIT; see notices/emdash-MIT.txt. Vitest assertions become node:assert.
import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeCursor, encodeCursor, InvalidCursorError } from '../src/lib/server/database/trash-cursor.ts';

const source = '913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:packages/core/tests/unit/database/repositories/cursor.test.ts';

test(`${source}:10 — round-trips a valid cursor`, () => {
  const cursor = encodeCursor('2024-01-01', '01ABC');
  const decoded = decodeCursor(cursor);
  assert.deepEqual(decoded, { orderValue: '2024-01-01', id: '01ABC' });
});

test(`${source}:16 — throws InvalidCursorError on empty string`, () => {
  assert.throws(() => decodeCursor(''), InvalidCursorError);
});

test(`${source}:20 — throws InvalidCursorError on non-base64 input`, () => {
  assert.throws(() => decodeCursor('not-base64-!!!'), InvalidCursorError);
});

test(`${source}:24 — throws InvalidCursorError on base64 of malformed JSON`, () => {
  const bad = Buffer.from('{not valid json').toString('base64');
  assert.throws(() => decodeCursor(bad), InvalidCursorError);
});

test(`${source}:29 — throws InvalidCursorError on base64 JSON missing required fields`, () => {
  const bad = Buffer.from(JSON.stringify({ wrong: 'shape' })).toString('base64');
  assert.throws(() => decodeCursor(bad), InvalidCursorError);
});

test(`${source}:34 — throws InvalidCursorError when id is not a string`, () => {
  const bad = Buffer.from(JSON.stringify({ orderValue: 'x', id: 42 })).toString('base64');
  assert.throws(() => decodeCursor(bad), InvalidCursorError);
});

test(`${source}:39 — rejects oversized cursors before attempting to decode (DoS guard)`, () => {
  const huge = 'A'.repeat(5000);
  assert.throws(() => decodeCursor(huge), InvalidCursorError);
});

test(`${source}:49 — error message truncates very long cursors`, () => {
  const longish = 'A'.repeat(200);
  try {
    decodeCursor(longish);
    assert.fail('expected throw');
  } catch (error) {
    assert.ok(error instanceof InvalidCursorError);
    assert.ok((error as Error).message.length < 120);
  }
});

test('supplemental: UTF-8 standard-base64 round trip retains Unicode values', () => {
  const orderValue = '2026-10-02 — 删除 🗑️';
  const id = '記事/entrée';
  const cursor = encodeCursor(orderValue, id);
  assert.equal(cursor, Buffer.from(JSON.stringify({ orderValue, id }), 'utf8').toString('base64'));
  assert.deepEqual(decodeCursor(cursor), { orderValue, id });
});

test('supplemental: empty fields, arbitrary timestamp/ID and extra context remain accepted', () => {
  for (const value of [
    { orderValue: '', id: '' },
    { orderValue: 'arbitrary', id: 'arbitrary', collection: 'other', locale: 'fr', version: 999 }
  ]) {
    assert.deepEqual(decodeCursor(Buffer.from(JSON.stringify(value)).toString('base64')),
      { orderValue: value.orderValue, id: value.id });
  }
});

test('supplemental: decoder bound accepts 4096 characters and rejects 4100', () => {
  // 3072 bytes produce exactly 4096 standard-base64 characters. The native
  // query schema has its separate 2048-character input cap.
  const orderValue = 'x'.repeat(3047);
  const cursor = encodeCursor(orderValue, '');
  assert.equal(cursor.length, 4096);
  assert.deepEqual(decodeCursor(cursor), { orderValue, id: '' });
  assert.throws(() => decodeCursor(encodeCursor(orderValue + 'xxx', '')), InvalidCursorError);
});

test('supplemental: non-object JSON and non-string orderValue remain invalid', () => {
  for (const value of [null, 42, 'value', [], { orderValue: 42, id: 'x' }]) {
    assert.throws(() => decodeCursor(Buffer.from(JSON.stringify(value)).toString('base64')), InvalidCursorError);
  }
});

test('supplemental: message truncation retains the exact first 47 characters', () => {
  assert.equal(new InvalidCursorError('x'.repeat(50)).message, `Invalid pagination cursor: ${'x'.repeat(50)}`);
  assert.equal(new InvalidCursorError('x'.repeat(51)).message, `Invalid pagination cursor: ${'x'.repeat(47)}...`);
  assert.equal(new InvalidCursorError('bad').name, 'InvalidCursorError');
});
