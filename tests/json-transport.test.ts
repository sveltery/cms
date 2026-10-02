// Supplemental Kit transport security/shape assertions; no upstream test credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parse, stringify } from 'devalue';
import { jsonOwnKeys } from '../src/lib/json-transport.ts';

test('own JSON keys round-trip with normal prototypes and no global mutation', () => {
  const value = JSON.parse('{"__proto__":{"polluted":true},"constructor":{"prototype":[null,false]},"nested":[{"__proto__":2}]}');
  const result = parse(stringify({ value }, { CmsJsonOwnKeys: jsonOwnKeys.encode }), { CmsJsonOwnKeys: jsonOwnKeys.decode });
  assert.deepEqual(result.value, value);
  assert.ok(Object.hasOwn(result.value, '__proto__'));
  assert.equal(Object.getPrototypeOf(result.value), Object.prototype);
  assert.equal(Object.getPrototypeOf(result.value.nested[0]), Object.prototype);
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
});

test('custom transport cannot disguise lossy JSON, cycles, getters or custom objects', () => {
  const cycle = JSON.parse('{"__proto__":null}'); cycle.self = cycle;
  const accessor = JSON.parse('{"__proto__":null}');
  let reads = 0; Object.defineProperty(accessor, 'value', { enumerable: true, get() { reads++; return true; } });
  const nullPrototype = Object.assign(Object.create(null), JSON.parse('{"__proto__":{"value":true}}'));
  assert.deepEqual(jsonOwnKeys.decode(jsonOwnKeys.encode(nullPrototype) as string), JSON.parse('{"__proto__":{"value":true}}'));
  for (const invalid of [undefined, NaN, Infinity, 1n, new Date(), new Map(), new Set(), new Array(1),
    () => true, Symbol(), cycle, accessor, Object.create({ '__proto__': null })]) {
    const value = JSON.parse('{"__proto__":null}'); value.invalid = invalid;
    assert.equal(jsonOwnKeys.encode(value), false);
  }
  assert.equal(reads, 0);
  const shared = JSON.parse('{"__proto__":null}');
  assert.notEqual(jsonOwnKeys.encode({ ...shared, first: shared, second: shared }), false);
});

test('malformed custom decoder data fails without exposing the supplied value', () => {
  for (const value of ['{', 'null', '[]', '{"ordinary":true}', '{"__proto__":1e400}', 2, null, {}, ['text']]) {
    assert.throws(() => jsonOwnKeys.decode(value as string), { name: 'TypeError', message: 'Invalid JSON transport value' });
  }
});
