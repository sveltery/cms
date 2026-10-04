import * as v from 'valibot';
import { fieldType, fieldMetadataEntries } from './field-validation.ts';
import { compileUrlPattern } from '../schema/url-pattern.ts';
import { CmsError } from './contract.ts';

// Slug rules and reserved names follow EmDash 1.1.0 schema/types.ts.
// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
export const reservedCollections = ['content', 'media', 'users', 'revisions', 'taxonomies', 'options', 'audit_logs', 'reorder', 'relations'];
export const reservedFields = ['id', 'slug', 'status', 'author_id', 'primary_byline_id', 'created_at', 'updated_at', 'published_at', 'scheduled_at', 'deleted_at', 'version', 'live_revision_id', 'draft_revision_id', 'terms', 'bylines', 'byline', 'locale', 'translation_group'];
export const identifier = v.pipe(v.string(), v.minLength(1), v.maxLength(63), v.regex(/^[a-z][a-z0-9_]*$/));
const label = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(200));
const shortText = v.pipe(v.string(), v.maxLength(2000));
const collectionSupports = v.array(v.picklist(['drafts','revisions','preview','scheduling','search','seo']));
const admin = v.strictObject({ listColumns: v.optional(v.pipe(v.array(identifier),v.maxLength(4))), quickCreate: v.optional(v.boolean()) });
const metadata = {
  icon: v.optional(v.pipe(v.string(),v.trim(),v.maxLength(64))), admin: v.optional(admin),
  supports: v.optional(collectionSupports),
  urlPattern: v.optional(v.nullable(v.pipe(v.string(),v.check(value => { try { if(value) compileUrlPattern(value); return true; } catch { return false; } })))),
  routable: v.optional(v.boolean()), hasSeo: v.optional(v.boolean()), hidden: v.optional(v.boolean()),
  sortOrder: v.optional(v.nullable(v.pipe(v.number(),v.safeInteger()))),
  group: v.optional(v.nullable(v.pipe(v.string(),v.trim(),v.maxLength(100)))),
  editLocking: v.optional(v.boolean()), commentsEnabled: v.optional(v.boolean())
};
export const collectionInput = v.strictObject({
  slug: identifier, label, labelSingular: v.optional(label), description: v.optional(shortText), ...metadata,
  source: v.optional(v.pipe(v.string(),v.regex(/^(?:manual|discovered|seed|(?:template|import):.+)$/)))
});
// Optional keys have no defaults: omission/undefined preserves metadata.
export const collectionMetadataInput = v.pipe(v.custom<Record<string, unknown>>(value =>
  value !== null && typeof value === 'object' && !Array.isArray(value) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value))), v.strictObject({
  label: v.optional(label), labelSingular: v.optional(label), description: v.optional(shortText), ...metadata,
  commentsModeration: v.optional(v.picklist(['all','first_time','none'])),
  commentsClosedAfterDays: v.optional(v.pipe(v.number(),v.safeInteger(),v.minValue(0))),
  commentsAutoApproveUsers: v.optional(v.boolean()), titleField: v.optional(v.nullable(identifier)), dateField: v.optional(v.nullable(identifier))
}));
export const fieldInput = v.strictObject({
  slug: identifier, label, type: fieldType, ...fieldMetadataEntries,
  required: v.optional(v.boolean(), false), unique: v.optional(v.boolean(), false)
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
// Local JSON input contract: never silently omit/coerce unsupported JS values.
// The copied upstream Zod validator and storage codec retain source behavior.
function isJsonValue(value: unknown, ancestors = new Set<object>()): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || ancestors.has(value)) return false;
  const array = Array.isArray(value);
  if (array ? Object.getPrototypeOf(value) !== Array.prototype
    : ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return false;
  const keys = Reflect.ownKeys(value);
  if (keys.some(key => typeof key !== 'string')) return false;
  if (array && (keys.length !== value.length + 1 ||
    keys.some(key => key !== 'length' && (!/^(0|[1-9]\d*)$/.test(String(key)) || Number(key) >= value.length)))) return false;
  ancestors.add(value);
  try {
    for (const key of keys) {
      if (array && key === 'length') continue;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor?.enumerable || !('value' in descriptor) || !isJsonValue(descriptor.value, ancestors)) return false;
    }
    return true;
  } finally { ancestors.delete(value); }
}
// Keep valid schema keys such as constructor/prototype: record() silently drops them.
export const schemaData = v.custom<Record<string, unknown>>(value => {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value) || !isJsonValue(value)) return false;
    const keys = Object.keys(value);
    return keys.every(key => v.safeParse(identifier, key).success)
      && JSON.stringify(value).length <= 200_000;
  } catch { return false; }
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
export const countTrashedDraftInput = v.strictObject({ type: identifier, locale: v.optional(localeInput) });
export const listTrashedDraftInput = v.strictObject({
  type: identifier, locale: v.optional(localeInput),
  cursor: v.optional(v.string()),
  limit: v.optional(v.pipe(v.number(), v.safeInteger(), v.minValue(1)))
});
export const restoreDraftInput = v.strictObject({ type: identifier, id: entryId, expected: revisionInput, locale: v.optional(localeInput, 'en') });
export function parse<T extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(schema: T, input: unknown): v.InferOutput<T> {
  const result = v.safeParse(schema, input);
  if (!result.success) throw new CmsError('VALIDATION_ERROR');
  return result.output;
}
export function tableName(slug: unknown): string { return 'ec_' + parse(identifier, slug); }
