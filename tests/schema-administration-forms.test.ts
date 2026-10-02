import test from 'node:test';
import assert from 'node:assert/strict';
import * as v from 'valibot';
import { createInput, updateInput, addFieldInput, convertCollectionCreate, convertCollectionUpdate, convertFieldAdd } from '../src/lib/server/schema/schema.ts';

// Original native transport requirements. No upstream declaration credit.
const expected = { collection: 'posts', version: '1', updatedAt: '2026-10-02T00:00:00.000Z' };
test('native collection forms preserve every supported feature and administration setting', () => {
  const supports = ['drafts', 'revisions', 'preview', 'scheduling', 'search', 'seo'];
  const value = convertCollectionCreate(v.parse(createInput, { slug: 'posts', label: 'Posts', supports: JSON.stringify(supports), icon: 'book', group: 'Editorial', routable: 'false', hidden: 'true', editLocking: 'false', listColumns: '["title","priority"]', quickCreate: 'false' }));
  assert.deepEqual(value.supports, supports);
  assert.deepEqual(value.admin, { listColumns: ['title', 'priority'], quickCreate: false });
  assert.equal(value.routable, false); assert.equal(value.hidden, true); assert.equal(value.editLocking, false);
  assert.equal(value.icon, 'book'); assert.equal(value.group, 'Editorial');
});
test('native collection updates distinguish omitted display fields from clearing them', () => {
  const kept = convertCollectionUpdate(v.parse(updateInput, expected));
  assert.equal(Object.hasOwn(kept.input, 'titleField'), false);
  const cleared = convertCollectionUpdate(v.parse(updateInput, { ...expected, titleField: '', dateField: '', urlPattern: '', group: '' }));
  assert.equal(cleared.input.titleField, null); assert.equal(cleared.input.dateField, null);
  assert.equal(cleared.input.urlPattern, null); assert.equal(cleared.input.group, null);
});
test('native add-field form supports the complete persisted type set and typed metadata', () => {
  const types = ['string', 'text', 'url', 'number', 'integer', 'boolean', 'datetime', 'select', 'multiSelect', 'portableText', 'image', 'file', 'reference', 'json', 'slug', 'repeater', 'blocks'];
  for (const type of types) {
    const result = v.safeParse(addFieldInput, { collection: 'posts', expectedSchemaVersion: '1', slug: 'value', label: 'Value', type });
    assert.equal(result.success, true, `${type} is supported by the native schema form`);
  }
  const value = convertFieldAdd(v.parse(addFieldInput, { collection: 'posts', expectedSchemaVersion: '1', slug: 'priority', label: 'Priority', type: 'number', defaultValueJson: '2.5', validationJson: '{"min":0,"max":10}', optionsJson: '{"helpText":"Rank"}', widget: 'number', indexed: true, searchable: false, translatable: false }));
  assert.equal(value.input.defaultValue, 2.5); assert.deepEqual(value.input.validation, { min: 0, max: 10 });
  assert.deepEqual(value.input.options, { helpText: 'Rank' }); assert.equal(value.input.widget, 'number');
  assert.equal(value.input.indexed, true); assert.equal(value.input.translatable, false);
});
