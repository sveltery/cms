import test from 'node:test';
import assert from 'node:assert/strict';
import * as v from 'valibot';
import {
  createInput, updateInput, addFieldInput,
  convertCollectionCreate, convertCollectionUpdate, convertFieldAdd
} from '../src/lib/server/schema/schema.ts';

// Supplemental Kit transport/conversion assertions, not upstream parity credit.
const metadata = { collection: 'notes', version: '1', updatedAt: '2026-10-02T00:00:00.000Z' };
const field = { collection: 'notes', expectedSchemaVersion: '1', slug: 'body', label: 'Body', type: 'text' };

test('native form instance keys match the collection and never enter service inputs', () => {
  for (const instance of [{}, { id: 'notes' }]) {
    assert.deepEqual(convertCollectionUpdate(v.parse(updateInput, { ...metadata, ...instance })), {
      collection: 'notes', input: {}, expected: { version: 1, updatedAt: metadata.updatedAt }
    });
    assert.deepEqual(convertFieldAdd(v.parse(addFieldInput, { ...field, ...instance })), {
      collection: 'notes', expectedSchemaVersion: 1,
      input: { slug: 'body', label: 'Body', type: 'text', required: false, unique: false }
    });
  }
  for (const schema of [updateInput, addFieldInput]) {
    const input = schema === updateInput ? metadata : field;
    for (const id of ['other', '', 'bad-key', 'x'.repeat(64)]) {
      const result = schema['~standard'].validate({ ...input, id });
      assert.ok(!(result instanceof Promise));
      assert.ok(result.issues, `invalid instance ${id} blocks Kit's handler branch`);
      assert.equal(v.safeParse(schema, { ...input, id }).success, false);
      assert.equal(result.issues[0].path?.[0] instanceof Object
        ? (result.issues[0].path[0] as { key: unknown }).key : result.issues[0].path?.[0], 'id');
    }
  }
});

test('native supports preserve omission, explicit empty arrays and supported flags', () => {
  const base = { slug: 'notes', label: ' Notes ' };
  const omitted = convertCollectionCreate(v.parse(createInput, base));
  assert.equal(omitted.label, 'Notes');
  assert.equal(Object.hasOwn(omitted, 'supports'), false);
  assert.deepEqual(convertCollectionCreate(v.parse(createInput, { ...base, supports: '[]' })).supports, []);
  assert.deepEqual(convertCollectionCreate(v.parse(createInput, { ...base, supports: '["drafts","revisions"]' })).supports,
    ['drafts', 'revisions']);
  assert.equal(Object.hasOwn(convertCollectionUpdate(v.parse(updateInput, metadata)).input, 'supports'), false);
  assert.deepEqual(convertCollectionUpdate(v.parse(updateInput, { ...metadata, supports: '[]' })).input.supports, []);
  for (const supports of ['', 'null', '{}', '["preview"]', '["drafts","revisions","drafts"]', ' '.repeat(65)]) {
    assert.equal(v.safeParse(createInput, { ...base, supports }).success, false, supports);
  }
});

test('decimal strings convert safely while blank optional bounds stay omitted', () => {
  const converted = convertFieldAdd(v.parse(addFieldInput, {
    ...field, expectedSchemaVersion: '9007199254740991', minLength: '', maxLength: '100000', defaultValue: ''
  }));
  assert.equal(converted.expectedSchemaVersion, Number.MAX_SAFE_INTEGER);
  assert.deepEqual(converted.input.validation, { maxLength: 100_000 });
  assert.equal(converted.input.defaultValue, '');
  assert.equal(Object.hasOwn(convertFieldAdd(v.parse(addFieldInput, { ...field, minLength: '', maxLength: '' })).input,
    'validation'), false);
  for (const version of ['', '0', '01', '+1', '-1', '1e1', ' 1', '1 ', '1.0', '9007199254740992']) {
    assert.equal(v.safeParse(updateInput, { ...metadata, version }).success, false, version);
    assert.equal(v.safeParse(addFieldInput, { ...field, expectedSchemaVersion: version }).success, false, version);
  }
  for (const bound of ['00', '+1', '-1', '1e1', ' 1', '1.0', '100001']) {
    assert.equal(v.safeParse(addFieldInput, { ...field, maxLength: bound }).success, false, bound);
  }
  assert.equal(v.safeParse(updateInput, { ...metadata, version: 1 }).success, false, 'wire fields are decimal strings');
});

test('native field validation gives bound/default issue paths that block the handler', () => {
  for (const [input, path] of [
    [{ ...field, minLength: '2', maxLength: '1' }, 'minLength'],
    [{ ...field, type: 'string', minLength: '201' }, 'minLength'],
    [{ ...field, minLength: '1', defaultValue: '' }, 'defaultValue'],
    [{ ...field, maxLength: '1', defaultValue: 'ab' }, 'defaultValue'],
    [{ ...field, type: 'string', defaultValue: 'x'.repeat(201) }, 'defaultValue']
  ] as const) {
    const result = addFieldInput['~standard'].validate(input);
    assert.ok(!(result instanceof Promise));
    assert.ok(result.issues, `invalid ${path} blocks Kit's handler branch`);
    assert.equal(v.safeParse(addFieldInput, input).success, false);
    assert.equal(result.issues[0].path?.[0] instanceof Object
      ? (result.issues[0].path[0] as { key: unknown }).key : result.issues[0].path?.[0], path);
  }
  const equalBounds = convertFieldAdd(v.parse(addFieldInput, { ...field, minLength: '1', maxLength: '1', defaultValue: 'a' }));
  assert.deepEqual(equalBounds.input.validation, { minLength: 1, maxLength: 1 });
  assert.equal(equalBounds.input.defaultValue, 'a');
});

test('client claims and content revision tokens remain invalid schema form inputs', () => {
  for (const [schema, input] of [[createInput, { slug: 'notes', label: 'Notes' }], [updateInput, metadata], [addFieldInput, field]] as const) {
    for (const claim of [{ principal: 'admin' }, { permissions: ['schema:manage'] }, { _rev: 'opaque' }]) {
      assert.equal(v.safeParse(schema, { ...input, ...claim }).success, false);
    }
  }
});
