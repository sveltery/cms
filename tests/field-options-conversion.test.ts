import test from 'node:test';
import assert from 'node:assert/strict';
import * as v from 'valibot';
import { convertFieldOptions, fieldOptionsFormInput } from '../src/lib/server/schema/schema.ts';

// Original Kit transport assertions, separate from pinned upstream assertion ports.
const target = { collection: 'notes', field: 'title' };
const convert = (input: Record<string, unknown>) => convertFieldOptions(v.parse(fieldOptionsFormInput, { ...target, ...input }));

test('options keep modes omit every domain metadata key, including submitted displayed values', () => {
  for (const instance of [{}, { id: 'notes/title' }]) {
    assert.deepEqual(convert(instance), target);
    assert.deepEqual(convert({ ...instance, labelMode: 'keep', label: '', sortOrderMode: 'keep', sortOrder: 'not a number',
      defaultValueMode: 'keep', defaultValue: 'Old metadata', validationMode: 'keep', minLength: '99', maxLength: '1' }), target);
  }
});

test('options set keys independently; label/default strings retain whitespace, empty default and unrestricted length', () => {
  for (const label of [' ', `  ${'L'.repeat(10_001)}  `]) {
    assert.deepEqual(convert({ labelMode: 'set', label }), { ...target, label });
  }
  for (const defaultValue of ['', '\u0000', 'x'.repeat(100_001)]) {
    assert.deepEqual(convert({ defaultValueMode: 'set', defaultValue }), { ...target, defaultValue });
  }
  for (const sortOrder of [0, 2, Number.MAX_SAFE_INTEGER]) {
    assert.deepEqual(convert({ sortOrderMode: 'set', sortOrder: String(sortOrder) }), { ...target, sortOrder });
  }
  assert.deepEqual(convert({ labelMode: 'set', label: 'New', sortOrderMode: 'set', sortOrder: '7',
    defaultValueMode: 'set', defaultValue: '', validationMode: 'set', minLength: '5', maxLength: '' }),
  { ...target, label: 'New', sortOrder: 7, defaultValue: '', validation: { minLength: 5 } });
});

test('validation native modes distinguish omission, null and empty replacement; one-sided bounds are independent', () => {
  assert.deepEqual(convert({ validationMode: 'keep' }), target);
  assert.deepEqual(convert({ validationMode: 'clear', minLength: '10', maxLength: '20' }), { ...target, validation: null });
  for (const bounds of [{}, { minLength: '', maxLength: '' }]) {
    assert.deepEqual(convert({ validationMode: 'set', ...bounds }), { ...target, validation: {} });
  }
  assert.deepEqual(convert({ validationMode: 'set', minLength: '201' }), { ...target, validation: { minLength: 201 } });
  assert.deepEqual(convert({ validationMode: 'set', maxLength: '100001' }), { ...target, validation: { maxLength: 100_001 } });
  assert.deepEqual(convert({ defaultValueMode: 'set', defaultValue: 'longer than bound', validationMode: 'set', maxLength: '1' }),
    { ...target, defaultValue: 'longer than bound', validation: { maxLength: 1 } });
});

test('native instance and selected values validate without introducing omitted metadata or unsupported edits', () => {
  for (const input of [{ labelMode: 'set' }, { labelMode: 'set', label: '' }, { defaultValueMode: 'set' },
    { defaultValueMode: 'set', defaultValue: null }, { validationMode: 'remove' }, { labelMode: 'clear' },
    { sortOrderMode: 'set', sortOrder: '-1' }, { sortOrderMode: 'set', sortOrder: '1.5' },
    { sortOrderMode: 'set', sortOrder: '01' }, { sortOrderMode: 'set', sortOrder: '9007199254740992' },
    { validationMode: 'set', minLength: '-1' }, { validationMode: 'set', maxLength: '1.5' },
    { validationMode: 'set', minLength: '2', maxLength: '1' }, { id: 'notes/body' }, { id: 'other/title' },
    { type: 'text' }, { required: true }, { unique: true }, { widget: 'textarea' }, { _rev: 'opaque' },
    { validation: '{}' }, { defaultValueMode: 'clear' }, { expectedSchemaVersion: '1' }]) {
    assert.equal(v.safeParse(fieldOptionsFormInput, { ...target, ...input }).success, false, JSON.stringify(input));
  }
});
