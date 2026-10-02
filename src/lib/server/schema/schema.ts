import * as v from 'valibot';
import {
  collectionInput, collectionMetadataInput, fieldInput, fieldLabelInput, updateFieldLabelInput, identifier, parse, revisionInput
} from '../database/validation.ts';
import { updateFieldInput } from '../database/field-edit-validation.ts';

// Native forms keep omitted support flags distinct from an explicit JSON [].
const supportsValue = v.pipe(v.array(v.picklist(['drafts', 'revisions'])), v.maxLength(2));
const supports = v.optional(v.pipe(v.string(), v.maxLength(64), v.check(value => {
  try { return v.safeParse(supportsValue, JSON.parse(value)).success; } catch { return false; }
}), v.transform(value => parse(supportsValue, JSON.parse(value)))));
const metadata = {
  label: v.optional(collectionInput.entries.label),
  labelSingular: collectionInput.entries.labelSingular,
  description: collectionInput.entries.description,
  supports
};
const decimalVersion = v.pipe(v.string(), v.maxLength(16), v.regex(/^[1-9][0-9]*$/),
  v.transform(Number), v.safeInteger(), v.minValue(1));
const optionalLength = v.optional(v.pipe(v.string(), v.maxLength(6),
  v.regex(/^(?:|0|[1-9][0-9]*)$/), v.transform(value => value === '' ? undefined : Number(value)),
  v.check(value => value === undefined || (Number.isSafeInteger(value) && value <= 100_000))));

export const collectionSlug = identifier;
export const fieldLabelFormInput = v.pipe(v.strictObject({
  id: v.optional(v.pipe(v.string(), v.maxLength(127))),
  collection: identifier, field: identifier, label: fieldLabelInput.entries.label
}), v.forward(v.check(input => input.id === undefined || input.id === `${input.collection}/${input.field}`,
  'Form instance must match the collection and field'), ['id']));
export function convertFieldLabel(input: v.InferOutput<typeof fieldLabelFormInput>) {
  const { id: _id, ...value } = input;
  return parse(updateFieldLabelInput, value);
}

// Mode fields are native transport only. All controls can remain available without
// JavaScript; keep omits its domain key, even when the browser sends the displayed value.
const editMode = v.optional(v.picklist(['keep', 'set']), 'keep');
const validationMode = v.optional(v.picklist(['keep', 'set', 'clear']), 'keep');
const editString = v.optional(v.string());
// Empty regex sources are distinct metadata. Native text controls always submit
// strings, so an explicit mode keeps a blank source distinct from omission.
const patternMode = v.optional(v.picklist(['omit', 'set']), 'omit');
const validPattern = (value: string | undefined) => {
  if (value === undefined) return false;
  try { new RegExp(value); return true; } catch { return false; }
};
const textareaValue = (value: string) => value.replace(/\r\n?/g, '\n');
function replacementPattern(input: { pattern?: string; patternOriginal?: string }) {
  if (input.pattern === undefined || input.patternOriginal === undefined) return input.pattern;
  try {
    const original: unknown = JSON.parse(input.patternOriginal);
    if (typeof original !== 'string') return undefined;
    // HTML textarea display and native encoding normalize line endings. A JSON
    // string snapshot preserves an unchanged source byte-for-byte; it grants no
    // authority and the chosen source still passes syntax/domain validation.
    return textareaValue(input.pattern) === textareaValue(original) ? original : input.pattern;
  } catch { return undefined; }
}
const isNonnegativeInteger = (value: string | undefined) => value !== undefined &&
  /^(?:0|[1-9][0-9]*)$/.test(value) && Number.isSafeInteger(Number(value));
const isOptionalInteger = (value: string | undefined) => value === undefined || value === '' || isNonnegativeInteger(value);
export const fieldOptionsFormInput = v.pipe(v.strictObject({
  id: v.optional(v.pipe(v.string(), v.maxLength(127))), collection: identifier, field: identifier,
  labelMode: editMode, label: editString,
  sortOrderMode: editMode, sortOrder: editString,
  defaultValueMode: editMode, defaultValue: editString,
  validationMode, minLength: editString, maxLength: editString, patternMode, pattern: editString,
  patternOriginal: editString
}), v.forward(v.check(input => input.id === undefined || input.id === `${input.collection}/${input.field}`,
  'Form instance must match the collection and field'), ['id']),
v.forward(v.check(input => input.labelMode !== 'set' || (input.label !== undefined && input.label.length > 0),
  'Label must contain at least one character'), ['label']),
v.forward(v.check(input => input.sortOrderMode !== 'set' || isNonnegativeInteger(input.sortOrder),
  'Sort order must be a nonnegative safe integer'), ['sortOrder']),
v.forward(v.check(input => input.defaultValueMode !== 'set' || input.defaultValue !== undefined,
  'Set default metadata requires a string value'), ['defaultValue']),
v.forward(v.check(input => input.validationMode !== 'set' || isOptionalInteger(input.minLength),
  'Minimum length must be a nonnegative safe integer'), ['minLength']),
v.forward(v.check(input => input.validationMode !== 'set' || isOptionalInteger(input.maxLength),
  'Maximum length must be a nonnegative safe integer'), ['maxLength']),
v.forward(v.check(input => input.validationMode !== 'set' || input.patternMode !== 'set' || validPattern(replacementPattern(input)),
  'Invalid validation pattern'), ['pattern']),
v.forward(v.check(input => input.validationMode !== 'set' ||
  !isNonnegativeInteger(input.minLength) || !isNonnegativeInteger(input.maxLength) ||
  Number(input.minLength) <= Number(input.maxLength),
  'Minimum length must not exceed maximum length'), ['minLength']));

export function convertFieldOptions(input: v.InferOutput<typeof fieldOptionsFormInput>) {
  return parse(updateFieldInput, {
    collection: input.collection, field: input.field,
    ...(input.labelMode === 'set' ? { label: input.label } : {}),
    ...(input.sortOrderMode === 'set' ? { sortOrder: Number(input.sortOrder) } : {}),
    ...(input.defaultValueMode === 'set' ? { defaultValue: input.defaultValue } : {}),
    ...(input.validationMode === 'keep' ? {} : { validation: input.validationMode === 'clear' ? null : {
      ...(input.minLength === undefined || input.minLength === '' ? {} : { minLength: Number(input.minLength) }),
      ...(input.maxLength === undefined || input.maxLength === '' ? {} : { maxLength: Number(input.maxLength) }),
      ...(input.patternMode === 'set' ? { pattern: replacementPattern(input) } : {})
    } })
  });
}
export const createInput = v.strictObject({
  slug: identifier, ...metadata, label: collectionInput.entries.label
});
export const updateInput = v.pipe(v.strictObject({
  // Kit form.for(collection) injects this instance key on native and enhanced submissions.
  id: v.optional(identifier), collection: identifier, ...metadata,
  version: decimalVersion, updatedAt: revisionInput.entries.updatedAt
}), v.forward(v.check(input => input.id === undefined || input.id === input.collection,
  'Form instance must match the collection'), ['id']));
export const addFieldInput = v.pipe(v.strictObject({
  id: v.optional(identifier), collection: identifier, expectedSchemaVersion: decimalVersion,
  slug: fieldInput.entries.slug, label: fieldInput.entries.label, type: fieldInput.entries.type,
  required: fieldInput.entries.required, unique: fieldInput.entries.unique,
  defaultValue: fieldInput.entries.defaultValue,
  minLength: optionalLength, maxLength: optionalLength, patternMode, pattern: editString
}), v.forward(v.check(input => input.id === undefined || input.id === input.collection,
  'Form instance must match the collection'), ['id']),
v.forward(v.check(input => input.patternMode !== 'set' || validPattern(input.pattern),
  'Invalid validation pattern'), ['pattern']),
v.forward(v.check(input => (input.minLength ?? 0) <=
  Math.min(input.maxLength ?? (input.type === 'string' ? 200 : 100_000), 100_000),
  'Minimum length must not exceed the effective maximum'), ['minLength']),
v.forward(v.check(input => input.defaultValue === undefined ||
  (input.defaultValue.length >= (input.minLength ?? 0) && input.defaultValue.length <=
    Math.min(input.maxLength ?? (input.type === 'string' ? 200 : 100_000), 100_000)),
  'Default value must satisfy the field length bounds'), ['defaultValue']));

/** Form validation/conversion precedes the service; the service revalidates domain inputs. */
export function convertCollectionCreate(input: v.InferOutput<typeof createInput>) {
  return parse(collectionInput, input);
}
export function convertCollectionUpdate(input: v.InferOutput<typeof updateInput>) {
  const { id: _id, collection, version, updatedAt, ...metadata } = input;
  return { collection, input: parse(collectionMetadataInput, metadata), expected: { version, updatedAt } };
}
export function convertFieldAdd(input: v.InferOutput<typeof addFieldInput>) {
  const { id: _id, collection, expectedSchemaVersion, minLength, maxLength, patternMode, pattern, ...field } = input;
  const validation = minLength === undefined && maxLength === undefined && patternMode !== 'set' ? {} : {
    validation: { ...(minLength === undefined ? {} : { minLength }), ...(maxLength === undefined ? {} : { maxLength }),
      ...(patternMode === 'set' ? { pattern } : {}) }
  };
  return { collection, expectedSchemaVersion, input: parse(fieldInput, { ...field, ...validation }) };
}
