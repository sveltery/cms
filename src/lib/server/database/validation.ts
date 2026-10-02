import * as v from 'valibot';
import { CmsError } from './contract.ts';

// Slug rules and reserved names follow EmDash 1.1.0 schema/types.ts.
// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
export const reservedCollections = ['content', 'media', 'users', 'revisions', 'taxonomies', 'options', 'audit_logs', 'reorder', 'relations'];
export const reservedFields = ['id', 'slug', 'status', 'author_id', 'primary_byline_id', 'created_at', 'updated_at', 'published_at', 'scheduled_at', 'deleted_at', 'version', 'live_revision_id', 'draft_revision_id', 'terms', 'bylines', 'byline', 'locale', 'translation_group'];
export const identifier = v.pipe(v.string(), v.minLength(1), v.maxLength(63), v.regex(/^[a-z][a-z0-9_]*$/));
const label = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(200));
const shortText = v.pipe(v.string(), v.maxLength(2000));
export const collectionInput = v.strictObject({
  slug: identifier, label, labelSingular: v.optional(label), description: v.optional(shortText),
  supports: v.optional(v.pipe(v.array(v.picklist(['drafts', 'revisions'])), v.maxLength(2)))
});
// Optional keys have no defaults: omission/undefined leaves persisted metadata intact.
export const collectionMetadataInput = v.pipe(v.custom<Record<string, unknown>>(value =>
  value !== null && typeof value === 'object' && !Array.isArray(value) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value))), v.strictObject({
  label: v.optional(label), labelSingular: v.optional(label), description: v.optional(shortText),
  supports: v.optional(v.pipe(v.array(v.picklist(['drafts', 'revisions'])), v.maxLength(2)))
}));
const length = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(100_000));
export const fieldInput = v.strictObject({
  slug: identifier, label, type: v.picklist(['string', 'text']),
  required: v.optional(v.boolean(), false), unique: v.optional(v.boolean(), false),
  defaultValue: v.optional(v.pipe(v.string(), v.maxLength(100_000), v.check(value => !value.includes('\0')))),
  validation: v.optional(v.strictObject({ minLength: v.optional(length), maxLength: v.optional(length) }))
});
// EmDash's update-field label is nonempty, with no trimming or creation-label bound.
export const fieldLabelInput = v.strictObject({ label: v.pipe(v.string(), v.minLength(1)) });
export const updateFieldLabelInput = v.strictObject({
  collection: identifier, field: identifier, label: fieldLabelInput.entries.label
});
export const entryId = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
export const localeInput = v.pipe(v.string(), v.minLength(1), v.maxLength(35), v.regex(/^[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*$/));
export const revisionInput = v.strictObject({
  version: v.pipe(v.number(), v.safeInteger(), v.minValue(1)),
  updatedAt: v.pipe(v.string(), v.isoTimestamp(), v.maxLength(40))
});
export const updateCollectionInput = v.strictObject({
  collection: identifier, input: collectionMetadataInput, expected: revisionInput
});
// Keep valid schema keys such as constructor/prototype: record() silently drops them.
export const schemaData = v.custom<Record<string, string | null>>(value => {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return false;
  const entries = Object.entries(value);
  return entries.length <= 32 && entries.every(([key, item]) => v.safeParse(identifier, key).success &&
    (item === null || (typeof item === 'string' && item.length <= 100_000))) && JSON.stringify(value).length <= 200_000;
});
const data = schemaData;
export const createDraftInput = v.strictObject({
  type: identifier, slug: v.optional(v.nullable(v.pipe(v.string(), v.maxLength(200)))),
  locale: v.optional(localeInput, 'en'), data
});
export const updateDraftInput = v.strictObject({
  type: identifier, id: entryId, expected: revisionInput,
  data, slug: v.optional(v.nullable(v.pipe(v.string(), v.maxLength(200)))),
  locale: v.optional(localeInput, 'en')
});
export const deleteDraftInput = v.strictObject({ type: identifier, id: entryId, expected: revisionInput, locale: v.optional(localeInput, 'en') });
export const getDraftInput = v.strictObject({ type: identifier, id: entryId, locale: v.optional(localeInput, 'en') });
// Trash reads deliberately leave locale absent: omission includes every locale.
export const getTrashedDraftInput = v.strictObject({ type: identifier, id: entryId, locale: v.optional(localeInput) });
export const listTrashedDraftInput = v.strictObject({
  type: identifier, locale: v.optional(localeInput),
  limit: v.optional(v.pipe(v.number(), v.safeInteger(), v.minValue(1)))
});
export const restoreDraftInput = v.strictObject({ type: identifier, id: entryId, expected: revisionInput, locale: v.optional(localeInput, 'en') });
export function parse<T extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(schema: T, input: unknown): v.InferOutput<T> {
  const result = v.safeParse(schema, input);
  if (!result.success) throw new CmsError('VALIDATION_ERROR');
  return result.output;
}
export function tableName(slug: unknown): string { return 'ec_' + parse(identifier, slug); }
