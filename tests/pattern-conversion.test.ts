import test from 'node:test';
import assert from 'node:assert/strict';
import * as v from 'valibot';
import { addFieldInput, convertFieldAdd, fieldOptionsFormInput, convertFieldOptions } from '../src/lib/server/schema/schema.ts';

// Supplemental native transport checks; pinned behavior is reproduced separately.
const field = { collection: 'notes', expectedSchemaVersion: '1', slug: 'body', label: 'Body', type: 'text' };
const options = { collection: 'notes', field: 'body' };
const issuePath = (result: ReturnType<typeof v.safeParse>) => result.issues?.[0]?.path?.map(item => item.key);

test('creation distinguishes omitted pattern from selected literal empty and untrimmed regex sources', () => {
  for (const extra of [{}, { pattern: '' }, { patternMode: 'omit', pattern: '[' }]) {
    assert.equal(Object.hasOwn(convertFieldAdd(v.parse(addFieldInput, { ...field, ...extra })).input, 'validation'), false);
  }
  for (const pattern of ['', ' ', 'cat', '^cat$', '/cat/i', '\\d+', '(?<=x)y']) {
    assert.deepEqual(convertFieldAdd(v.parse(addFieldInput, { ...field, patternMode: 'set', pattern })).input.validation, { pattern });
  }
  assert.deepEqual(convertFieldAdd(v.parse(addFieldInput, { ...field, patternMode: 'set', pattern: '', minLength: '2' })).input.validation,
    { minLength: 2, pattern: '' });
  // Metadata defaults are not content writes and the pin does not regex-check them.
  assert.equal(convertFieldAdd(v.parse(addFieldInput, { ...field, patternMode: 'set', pattern: '^cat$', defaultValue: 'dog' })).input.defaultValue, 'dog');
});

test('validation keep/set/clear preserve replacement, explicit empty and absent-pattern semantics', () => {
  for (const validationMode of ['keep', 'clear']) {
    const result = convertFieldOptions(v.parse(fieldOptionsFormInput, { ...options, validationMode, patternMode: 'set', pattern: '[' }));
    assert.deepEqual(result, { ...options, ...(validationMode === 'clear' ? { validation: null } : {}) });
  }
  assert.deepEqual(convertFieldOptions(v.parse(fieldOptionsFormInput, { ...options, validationMode: 'set', pattern: '' })), { ...options, validation: {} });
  assert.deepEqual(convertFieldOptions(v.parse(fieldOptionsFormInput, { ...options, validationMode: 'set', patternMode: 'omit', pattern: '[' })), { ...options, validation: {} });
  for (const pattern of ['', ' ', 'cat']) {
    assert.deepEqual(convertFieldOptions(v.parse(fieldOptionsFormInput, { ...options, validationMode: 'set', patternMode: 'set', pattern, maxLength: '8' })),
      { ...options, validation: { maxLength: 8, pattern } });
  }
});

test('malformed or missing selected pattern reports the native pattern field before the callback', () => {
  for (const [schema, base] of [[addFieldInput, field], [fieldOptionsFormInput, { ...options, validationMode: 'set' }]] as const) {
    for (const extra of [{ pattern: '[' }, { pattern: '(' }, {}]) {
      const input = { ...base, patternMode: 'set', ...extra };
      const result = v.safeParse(schema, input);
      assert.equal(result.success, false);
      assert.deepEqual(issuePath(result), ['pattern']);
      const standard = schema['~standard'].validate(input);
      assert.ok(!(standard instanceof Promise));
      assert.ok(standard.issues, 'structural form validation blocks the handler');
    }
    for (const pattern of [null, 1]) assert.equal(v.safeParse(schema, { ...base, patternMode: 'set', pattern }).success, false);
    assert.equal(v.safeParse(schema, { ...base, patternMode: 'replace', pattern: 'cat' }).success, false);
  }
});

test('replacement preserves unchanged textarea-normalized sources using untrusted JSON snapshots', () => {
  for (const pattern of ['^cat\ndog$', '^cat\r\ndog$', '^cat\rdog$']) {
    for (const submitted of ['^cat\ndog$', '^cat\r\ndog$']) {
      const input = { ...options, validationMode: 'set', patternMode: 'set', pattern: submitted, patternOriginal: JSON.stringify(pattern) };
      assert.equal(v.safeParse(fieldOptionsFormInput, input).success, true);
      assert.deepEqual(convertFieldOptions(v.parse(fieldOptionsFormInput, input)), { ...options, validation: { pattern } });
    }
  }
  const edited = { ...options, validationMode: 'set', patternMode: 'set', pattern: '^new\r\nsource$', patternOriginal: JSON.stringify('^old\nsource$') };
  assert.deepEqual(convertFieldOptions(v.parse(fieldOptionsFormInput, edited)), { ...options, validation: { pattern: '^new\r\nsource$' } });
  for (const patternOriginal of ['{', 'null', '42', '{}', '[]']) {
    const result = v.safeParse(fieldOptionsFormInput, { ...options, validationMode: 'set', patternMode: 'set', pattern: 'cat', patternOriginal });
    assert.equal(result.success, false); assert.deepEqual(issuePath(result), ['pattern']);
    for (const validationMode of ['keep', 'clear']) assert.equal(v.safeParse(fieldOptionsFormInput,
      { ...options, validationMode, patternMode: 'set', pattern: '[', patternOriginal }).success, true);
  }
  const invalidOriginal = v.safeParse(fieldOptionsFormInput, { ...options, validationMode: 'set', patternMode: 'set', pattern: '[', patternOriginal: '"["' });
  assert.equal(invalidOriginal.success, false); assert.deepEqual(issuePath(invalidOriginal), ['pattern']);
});
