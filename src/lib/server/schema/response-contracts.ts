// EmDash 1.1.0 API response contracts, pin 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Ported from packages/core/src/api/schemas/schema.ts:23-58,274-316,359-476.
// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
import * as v from 'valibot';
import { FIELD_TYPES, REPEATER_SUB_FIELD_TYPES } from './types.ts';
import { BLOCK_FIELD_TYPES } from './block-types.ts';

// Gate the original input before Valibot copies object/record entries. Source
// Zod objects admit non-array class instances; records use its separate
// constructor/prototype-based plain-object predicate (Zod4.5.4 core/util).
const isSourceObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
function isSourceRecord(value: unknown): boolean {
  if (!isSourceObject(value)) return false;
  const constructor = value.constructor;
  if (constructor === undefined || typeof constructor !== 'function') return true;
  return isSourceObject(constructor.prototype)
    && Object.prototype.hasOwnProperty.call(constructor.prototype, 'isPrototypeOf');
}
function sourceObject<const TEntries extends v.ObjectEntries>(entries: TEntries) {
  return v.pipe(v.custom<v.InferInput<v.ObjectSchema<TEntries, undefined>>>(isSourceObject), v.object(entries));
}
function sourceStrictObject<const TEntries extends v.ObjectEntries>(entries: TEntries) {
  return v.pipe(v.custom<v.InferInput<v.StrictObjectSchema<TEntries, undefined>>>(isSourceObject), v.strictObject(entries));
}

const slug = v.pipe(v.string(), v.minLength(1), v.maxLength(63), v.regex(/^[a-z][a-z0-9_]*$/));
const integer = v.pipe(v.number(), v.safeInteger());
const nonnegative = v.pipe(integer, v.minValue(0));
const positive = v.pipe(integer, v.minValue(1));
const nullableString = v.nullable(v.string());
const record = v.pipe(v.custom<Record<string, unknown>>(isSourceRecord), v.record(v.string(), v.unknown()));
const finiteNumber = v.pipe(v.number(), v.finite());
const repeaterSubField = sourceObject({
  slug, type: v.picklist(REPEATER_SUB_FIELD_TYPES),
  label: v.pipe(v.string(), v.minLength(1)),
  required: v.optional(v.boolean()), options: v.optional(v.array(v.string()))
});

// Source block validation is intentionally distinct from collection-field
// validation: it does not add MIME syntax, regex syntax, or paired bounds checks.
const blockFieldValidation = sourceStrictObject({
  min: v.optional(finiteNumber), max: v.optional(finiteNumber),
  minLength: v.optional(nonnegative), maxLength: v.optional(nonnegative),
  pattern: v.optional(v.string()), options: v.optional(v.array(v.string())),
  subFields: v.optional(v.pipe(v.array(repeaterSubField), v.minLength(1))),
  minItems: v.optional(nonnegative), maxItems: v.optional(positive),
  allowedMimeTypes: v.optional(v.pipe(v.array(v.string()), v.minLength(1), v.maxLength(64)))
});
export const blockFieldDefinitionSchema = sourceStrictObject({
  slug, label: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
  type: v.picklist(BLOCK_FIELD_TYPES), required: v.optional(v.boolean()),
  defaultValue: v.optional(v.unknown()), validation: v.optional(blockFieldValidation),
  options: v.optional(sourceStrictObject({ darkVariant: v.optional(v.boolean()) }))
});
export const blockTypeVersionSchema = sourceObject({
  id: v.string(), blockTypeId: v.string(), version: positive,
  fields: v.array(blockFieldDefinitionSchema), fingerprint: v.string(), active: v.boolean(),
  unsupportedTypes: v.optional(v.array(sourceStrictObject({ type: v.string(), path: v.string() }))),
  createdAt: v.string(), updatedAt: v.string()
});
export const blockTypeSchema = sourceObject({
  id: v.string(), slug: v.string(), label: v.string(),
  description: v.optional(v.string()), icon: v.optional(v.string()), category: v.optional(v.string()),
  currentVersion: positive, source: v.picklist(['user', 'seed']),
  versions: v.array(blockTypeVersionSchema), createdAt: v.string(), updatedAt: v.string()
});

// Writes retain their existing four-column bound. Responses deliberately accept
// every stored legacy list column, as the pinned response schema does.
const collectionAdminResponseConfig = sourceObject({
  listColumns: v.optional(v.array(slug)), quickCreate: v.optional(v.boolean())
});
const collectionEntries = {
  id: v.string(), slug: v.string(), label: v.string(),
  labelSingular: nullableString, description: nullableString, icon: nullableString,
  admin: v.optional(collectionAdminResponseConfig), supports: v.array(v.string()), source: nullableString,
  urlPattern: nullableString, routable: v.boolean(), hasSeo: v.boolean(), hidden: v.boolean(),
  sortOrder: v.nullable(integer), editLocking: v.boolean(), group: v.nullish(v.string()),
  createdAt: v.string(), updatedAt: v.string(),
  titleField: v.nullish(v.string()), dateField: v.nullish(v.string())
};
export const collectionSchema = sourceObject(collectionEntries);
export const fieldSchema = sourceObject({
  id: v.string(), collectionId: v.string(), slug: v.string(), label: v.string(), type: v.picklist(FIELD_TYPES),
  required: v.boolean(), unique: v.boolean(), defaultValue: v.nullable(v.unknown()),
  validation: v.nullable(record), widget: nullableString, options: v.nullable(record),
  blockTypes: v.optional(v.array(v.lazy(() => blockTypeSchema))), blockTypeFingerprint: v.optional(v.string()),
  sortOrder: integer, searchable: v.boolean(), indexed: v.boolean(), translatable: v.boolean(),
  createdAt: v.string(), updatedAt: v.string()
});
export const collectionResponseSchema = sourceObject({ item: collectionSchema });
export const collectionWithFieldsResponseSchema = sourceObject({
  item: sourceObject({ ...collectionEntries, fields: v.array(fieldSchema) })
});
export const collectionListResponseSchema = sourceObject({ items: v.array(collectionSchema) });
export const fieldResponseSchema = sourceObject({ item: fieldSchema });
export const fieldListResponseSchema = sourceObject({ items: v.array(fieldSchema) });
export const blockTypeResponseSchema = sourceObject({ item: blockTypeSchema });
export const blockTypeListResponseSchema = sourceObject({ items: v.array(blockTypeSchema) });
export const orphanedTableSchema = sourceObject({ slug: v.string(), tableName: v.string(), rowCount: integer });
export const orphanedTableListResponseSchema = sourceObject({ items: v.array(orphanedTableSchema) });

export type CollectionResponse = v.InferOutput<typeof collectionResponseSchema>;
export type CollectionWithFieldsResponse = v.InferOutput<typeof collectionWithFieldsResponseSchema>;
export type CollectionListResponse = v.InferOutput<typeof collectionListResponseSchema>;
export type FieldResponse = v.InferOutput<typeof fieldResponseSchema>;
export type FieldListResponse = v.InferOutput<typeof fieldListResponseSchema>;
export type BlockTypeListResponse = v.InferOutput<typeof blockTypeListResponseSchema>;
export type OrphanedTableListResponse = v.InferOutput<typeof orphanedTableListResponseSchema>;
