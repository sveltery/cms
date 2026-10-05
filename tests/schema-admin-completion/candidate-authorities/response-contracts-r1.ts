// EmDash 1.1.0 API response contracts, pin 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Ported from packages/core/src/api/schemas/schema.ts:23-58,274-316,359-476.
// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
import * as v from 'valibot';
import { FIELD_TYPES, REPEATER_SUB_FIELD_TYPES } from './types.ts';
import { BLOCK_FIELD_TYPES } from './block-types.ts';

const slug = v.pipe(v.string(), v.minLength(1), v.maxLength(63), v.regex(/^[a-z][a-z0-9_]*$/));
const integer = v.pipe(v.number(), v.safeInteger());
const nonnegative = v.pipe(integer, v.minValue(0));
const positive = v.pipe(integer, v.minValue(1));
const nullableString = v.nullable(v.string());
const record = v.record(v.string(), v.unknown());
const repeaterSubField = v.object({
  slug, type: v.picklist(REPEATER_SUB_FIELD_TYPES),
  label: v.pipe(v.string(), v.minLength(1)),
  required: v.optional(v.boolean()), options: v.optional(v.array(v.string()))
});

// Source block validation is intentionally distinct from collection-field
// validation: it does not add MIME syntax, regex syntax, or paired bounds checks.
const blockFieldValidation = v.strictObject({
  min: v.optional(v.number()), max: v.optional(v.number()),
  minLength: v.optional(nonnegative), maxLength: v.optional(nonnegative),
  pattern: v.optional(v.string()), options: v.optional(v.array(v.string())),
  subFields: v.optional(v.pipe(v.array(repeaterSubField), v.minLength(1))),
  minItems: v.optional(nonnegative), maxItems: v.optional(positive),
  allowedMimeTypes: v.optional(v.pipe(v.array(v.string()), v.minLength(1), v.maxLength(64)))
});
export const blockFieldDefinitionSchema = v.strictObject({
  slug, label: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
  type: v.picklist(BLOCK_FIELD_TYPES), required: v.optional(v.boolean()),
  defaultValue: v.optional(v.unknown()), validation: v.optional(blockFieldValidation),
  options: v.optional(v.strictObject({ darkVariant: v.optional(v.boolean()) }))
});
export const blockTypeVersionSchema = v.object({
  id: v.string(), blockTypeId: v.string(), version: positive,
  fields: v.array(blockFieldDefinitionSchema), fingerprint: v.string(), active: v.boolean(),
  unsupportedTypes: v.optional(v.array(v.strictObject({ type: v.string(), path: v.string() }))),
  createdAt: v.string(), updatedAt: v.string()
});
export const blockTypeSchema = v.object({
  id: v.string(), slug: v.string(), label: v.string(),
  description: v.optional(v.string()), icon: v.optional(v.string()), category: v.optional(v.string()),
  currentVersion: positive, source: v.picklist(['user', 'seed']),
  versions: v.array(blockTypeVersionSchema), createdAt: v.string(), updatedAt: v.string()
});

// Writes retain their existing four-column bound. Responses deliberately accept
// every stored legacy list column, as the pinned response schema does.
const collectionAdminResponseConfig = v.object({
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
export const collectionSchema = v.object(collectionEntries);
export const fieldSchema = v.object({
  id: v.string(), collectionId: v.string(), slug: v.string(), label: v.string(), type: v.picklist(FIELD_TYPES),
  required: v.boolean(), unique: v.boolean(), defaultValue: v.nullable(v.unknown()),
  validation: v.nullable(record), widget: nullableString, options: v.nullable(record),
  blockTypes: v.optional(v.array(v.lazy(() => blockTypeSchema))), blockTypeFingerprint: v.optional(v.string()),
  sortOrder: integer, searchable: v.boolean(), indexed: v.boolean(), translatable: v.boolean(),
  createdAt: v.string(), updatedAt: v.string()
});
export const collectionResponseSchema = v.object({ item: collectionSchema });
export const collectionWithFieldsResponseSchema = v.object({
  item: v.object({ ...collectionEntries, fields: v.array(fieldSchema) })
});
export const collectionListResponseSchema = v.object({ items: v.array(collectionSchema) });
export const fieldResponseSchema = v.object({ item: fieldSchema });
export const fieldListResponseSchema = v.object({ items: v.array(fieldSchema) });
export const blockTypeResponseSchema = v.object({ item: blockTypeSchema });
export const blockTypeListResponseSchema = v.object({ items: v.array(blockTypeSchema) });
export const orphanedTableSchema = v.object({ slug: v.string(), tableName: v.string(), rowCount: integer });
export const orphanedTableListResponseSchema = v.object({ items: v.array(orphanedTableSchema) });

export type CollectionResponse = v.InferOutput<typeof collectionResponseSchema>;
export type CollectionWithFieldsResponse = v.InferOutput<typeof collectionWithFieldsResponseSchema>;
export type CollectionListResponse = v.InferOutput<typeof collectionListResponseSchema>;
export type FieldResponse = v.InferOutput<typeof fieldResponseSchema>;
export type FieldListResponse = v.InferOutput<typeof fieldListResponseSchema>;
export type BlockTypeListResponse = v.InferOutput<typeof blockTypeListResponseSchema>;
export type OrphanedTableListResponse = v.InferOutput<typeof orphanedTableListResponseSchema>;
