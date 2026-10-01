import test from 'node:test';
import assert from 'node:assert/strict';
import * as v from 'valibot';
import { createInput, updateInput, precondition, withRevision } from '../src/lib/server/content/schema.ts';

test('revision tokens bind collection, entry and locale without using updatedAt as a wire precondition', () => {
  const value = { id: 'id', type: 'notes', locale: 'en', slug: null, status: 'draft' as const, authorId: 'author', version: 3,
    createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z', data: { headline: 'Note' } };
  const wire = withRevision(value);
  assert.equal(Object.hasOwn(wire, 'version'), false);
  const input = { collection: 'notes', id: 'id', locale: 'en', _rev: wire._rev };
  assert.deepEqual(precondition(input), { version: 3, updatedAt: value.updatedAt });
  for (const extra of [{ collection: 'post' }, { id: 'other' }, { locale: 'fr' }, { _rev: 'garbage' }, { _rev: 'x'.repeat(2049) }]) {
    assert.throws(() => precondition({ ...input, ...extra }), { code: 'VALIDATION_ERROR' });
  }
});

test('wire inputs carry schema data and reject caller identity, system columns and raw revisions', () => {
  assert.deepEqual(v.parse(createInput, { collection: 'notes', data: { headline: 'Note' } }), { collection: 'notes', locale: 'en', data: { headline: 'Note' } });
  for (const claim of ['principal', 'permissions', 'authorId', 'createdAt', 'publishedAt', 'status', 'expected']) {
    assert.equal(v.safeParse(createInput, { collection: 'notes', [claim]: 'claim' }).success, false);
  }
  assert.equal(v.safeParse(updateInput, { collection: 'notes', id: 'id', data: {} }).success, false);
});
