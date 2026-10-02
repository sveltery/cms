import test from 'node:test';
import assert from 'node:assert/strict';
import { previewFields } from '../src/lib/ui/preview-fields.ts';
import type { EditorField } from '../src/lib/server/content/manifest.ts';

test('preview fields preserve descriptor metadata and own entry order while mapping scalar kinds', () => {
  const validation = { minLength: 2, maxLength: 80 };
  const string = { id: 'headline-id', kind: 'string', label: 'Headline', required: true, validation } satisfies EditorField;
  const text = { id: 'detail-id', kind: 'richText', label: 'Detail', required: false } satisfies EditorField;
  const fields = Object.assign(Object.create({ inherited: string }), {
    detail: text, headline: string, constructor: string, prototype: text
  });
  const converted = previewFields(fields);
  assert.deepEqual(converted, [
    { ...text, slug: 'detail', type: 'text', validation: null },
    { ...string, slug: 'headline', type: 'string' },
    { ...string, slug: 'constructor', type: 'string' },
    { ...text, slug: 'prototype', type: 'text', validation: null }
  ]);
  assert.equal(converted[1].validation, validation);
  assert.notEqual(converted[1], string);
  assert.equal(Object.hasOwn(string, 'slug'), false);
  assert.equal(Object.hasOwn(text, 'validation'), false);
});

test('preview fields preserve supplied defaults, null validation and future metadata without mutating inputs', () => {
  const field = { id: 'id', kind: 'string' as const, label: 'Value', required: false, defaultValue: 'Default', validation: null, help: 'Preserved metadata' };
  const input = { value: field };
  const before = structuredClone(input);
  assert.deepEqual(previewFields(input as unknown as Record<string, EditorField>), [
    { ...field, slug: 'value', type: 'string' }
  ]);
  assert.deepEqual(input, before);
  assert.deepEqual(previewFields({}), []);
});
