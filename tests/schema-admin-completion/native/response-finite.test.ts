// Supplementary Source-faithfulness regression over the EXACT proposed R1
// production validator. It is not an original EmDash callback or product run.
import { expect, it } from 'vitest';
import * as v from 'valibot';
import { blockFieldDefinitionSchema, collectionSchema, fieldSchema }
  from '../candidate-authorities/response-contracts-r1.ts';

it('response schemas preserve finite non-array controls and reject infinities and array containers', () => {
  const block = { slug: 'amount', label: 'Amount', type: 'number' };
  // Source object/strict-object accepts ordinary non-array class instances.
  // Source block validation has no paired-bound rule: reversed finite values
  // remain allowed. Do not use the record plain-object policy at every object.
  class Bounds { min = 12.5; max = -4.25; }
  const control = v.safeParse(blockFieldDefinitionSchema, { ...block, validation: new Bounds() });
  expect(control.success).toBe(true);
  if (!control.success) throw new Error('Finite non-array Source block control was rejected');
  expect(control.output.validation).toEqual({ min: 12.5, max: -4.25 });
  // Supplied pure contract values, never a stored-row/timestamp serializer.
  const collection = {
    id: 'collection-1', slug: 'posts', label: 'Posts', labelSingular: null,
    description: null, icon: null, supports: [], source: 'manual', urlPattern: null,
    routable: true, hasSeo: false, hidden: false, sortOrder: null, editLocking: true,
    createdAt: '2026-08-20T00:00:00Z', updatedAt: '2026-08-20T00:00:00Z'
  };
  const field = {
    id: 'field-1', collectionId: 'collection-1', slug: 'amount', label: 'Amount', type: 'number',
    required: false, unique: false, defaultValue: null, validation: null, widget: null, options: null,
    sortOrder: 0, searchable: false, indexed: false, translatable: true,
    createdAt: '2026-08-20T00:00:00Z', updatedAt: '2026-08-20T00:00:00Z'
  };
  expect([
    v.safeParse(collectionSchema, { ...collection, admin: {} }).success,
    v.safeParse(fieldSchema, { ...field, validation: {}, options: {} }).success
  ]).toEqual([true, true]);
  const results = [
    ...[{ min: Infinity }, { min: -Infinity }, { max: Infinity }, { max: -Infinity }]
      .map(validation => v.safeParse(blockFieldDefinitionSchema, { ...block, validation }).success),
    v.safeParse(collectionSchema, { ...collection, admin: [] }).success,
    v.safeParse(blockFieldDefinitionSchema, { ...block, validation: [] }).success,
    v.safeParse(blockFieldDefinitionSchema, { ...block, options: [] }).success,
    v.safeParse(fieldSchema, { ...field, validation: [] }).success,
    v.safeParse(fieldSchema, { ...field, options: [] }).success
  ];
  expect(results).toEqual([false, false, false, false, false, false, false, false, false]);
});
