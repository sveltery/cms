// Supplemental Kit form instance compatibility: no copied-source credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as v from 'valibot';
import { createEditorInput } from '../src/lib/server/content/editor-schema.ts';

test('creation strips only the matching private Kit form instance key', () => {
  const result = v.safeParse(createEditorInput, { id: JSON.stringify(['post', 'fr']), collection: 'post', locale: 'fr', data: { title: 'Title' } });
  assert.equal(result.success, true);
  if (result.success) assert.equal(Object.hasOwn(result.output, 'id'), false);
});
test('creation validates an omitted locale against the native en instance', () => {
  const result = v.safeParse(createEditorInput, { id: JSON.stringify(['post', 'en']), collection: 'post', data: {} });
  assert.equal(result.success, true);
});
test('creation rejects a mismatched private form instance', () => {
  const result = v.safeParse(createEditorInput, { id: JSON.stringify(['page', 'fr']), collection: 'post', locale: 'fr', data: {} });
  assert.equal(result.success, false);
});
