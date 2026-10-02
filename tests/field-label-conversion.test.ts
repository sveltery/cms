import test from 'node:test';
import assert from 'node:assert/strict';
import * as v from 'valibot';
import { convertFieldLabel, fieldLabelFormInput } from '../src/lib/server/schema/schema.ts';

// Supplemental native-form validation/conversion; not upstream assertion adaptations.
test('field label conversion accepts absent/matching Kit instance ids and removes them before the service', () => {
  for (const label of ['Label', '   ', `  ${'L'.repeat(250)}  `]) {
    for (const instance of [{}, { id: 'notes/title' }]) {
      const parsed = v.parse(fieldLabelFormInput, { collection: 'notes', field: 'title', label, ...instance });
      assert.deepEqual(convertFieldLabel(parsed), { collection: 'notes', field: 'title', label });
      assert.equal(Object.hasOwn(convertFieldLabel(parsed), 'id'), false);
    }
  }
  const collection = 'c'.repeat(63); const field = 'f'.repeat(63);
  assert.deepEqual(convertFieldLabel(v.parse(fieldLabelFormInput, { collection, field, id: `${collection}/${field}`, label: 'Longest pair' })),
    { collection, field, label: 'Longest pair' });
});

test('field label form requires exact pair identity, a nonempty string and rejects broader field properties', () => {
  const valid = { collection: 'notes', field: 'title', label: 'Title' };
  for (const extra of [{ label: '' }, { label: null }, { label: 123 }, { id: 'notes/body' }, { id: 'other/title' },
    { id: 'notes' }, { id: 'notes/title/extra' }, { id: 'notes%2Ftitle' }, { id: ['notes/title'] },
    { collection: 'bad-slug' }, { field: 'bad-slug' }, { slug: 'other' }, { type: 'text' },
    { required: false }, { unique: false }, { defaultValue: 'New' }, { validation: { maxLength: 2 } },
    { sortOrder: 2 }, { widget: 'textarea' }, { version: '1' }, { updatedAt: '2026-01-01T00:00:00.000Z' }]) {
    assert.equal(v.safeParse(fieldLabelFormInput, { ...valid, ...extra }).success, false, JSON.stringify(extra));
  }
});
