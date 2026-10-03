import test from 'node:test';
import assert from 'node:assert/strict';
import * as v from 'valibot';
import { createInput, updateInput, addFieldInput, fieldMetadataFormInput, fieldOrderInput, fieldDeleteInput, collectionDeleteInput, convertCollectionCreate, convertCollectionUpdate, convertFieldAdd, convertFieldMetadata } from '../src/lib/server/schema/schema.ts';

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

test('new native forms reject mismatched registered form instances before handlers', () => {
  for (const [schema, input] of [
    [fieldMetadataFormInput, {collection:'posts',field:'title',id:'posts/other'}],
    [fieldDeleteInput, {...expected,field:'title',id:'posts/other'}],
    [fieldOrderInput, {...expected,fields:'["title"]',id:'other'}],
    [collectionDeleteInput, {...expected,id:'other'}]
  ] as const) {
    const result = v.safeParse(schema,input);
    assert.equal(result.success,false,'mismatched instance creates native issues');
    if (!result.success) assert.equal(result.issues[0].path?.[0]?.key,'id');
  }
});

test('native field settings explicitly retain metadata without JavaScript', () => {
  const field = {collection:'posts',field:'title',type:'text',typeMode:'keep',widget:'editor',widgetMode:'keep',
    defaultValueJson:'"stale"',defaultValueMode:'keep',validationJson:'{"minLength":10}',validationMode:'keep',
    optionsJson:'{"stale":true}',optionsMode:'keep',searchable:'true',searchableMode:'keep',
    indexed:'true',indexedMode:'keep',translatable:'true',translatableMode:'keep'};
  const result = v.safeParse(fieldMetadataFormInput,field);
  assert.equal(result.success,true,'native keep modes are accepted');
  if (!result.success) return;
  const value = convertFieldMetadata(result.output);
  assert.deepEqual(value,{collection:'posts',field:'title'});
});

test('native keep modes ignore abandoned malformed JSON settings', () => {
  const input={collection:'posts',field:'title',defaultValueMode:'keep',defaultValueJson:'abandoned text',validationMode:'keep',validationJson:'{invalid',optionsMode:'keep',optionsJson:'not JSON'};
  const result=v.safeParse(fieldMetadataFormInput,input);
  assert.equal(result.success,true,'unselected JSON settings are not replacements');
  if(result.success) assert.deepEqual(convertFieldMetadata(result.output),{collection:'posts',field:'title'});
  for(const property of ['defaultValue','validation','options']) {
    const selected=v.safeParse(fieldMetadataFormInput,{collection:'posts',field:'title',[property+'Mode']:'set',[property+'Json']:'not JSON'});
    assert.equal(selected.success,false,'selected JSON must be valid');
  }
});

test('native addition preserves explicitly non-translatable fields', () => {
  const result = v.safeParse(addFieldInput,{collection:'posts',expectedSchemaVersion:'1',slug:'code',label:'Code',type:'string',translatable:'false'});
  assert.equal(result.success,true,'native false is accepted');
  if (!result.success) return;
  const value = convertFieldAdd(result.output);
  assert.equal(value.input.translatable,false);
});

test('native collection creation keeps source defaults until advanced settings are selected', () => {
  const input = {slug:'posts',label:'Posts',supports:'["seo"]',settingsMode:'keep',icon:'',group:'',urlPattern:'',routable:'true',hasSeo:'false',hidden:'false',editLocking:'true',commentsEnabled:'false',listColumns:'[]',quickCreate:'true'};
  const parsed=v.safeParse(createInput,input);
  assert.equal(parsed.success,true,'native settings mode is accepted');
  if(!parsed.success) return;
  const value=convertCollectionCreate(parsed.output);
  assert.deepEqual(value,{slug:'posts',label:'Posts',supports:['seo']});
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
