import * as v from 'valibot';
import {
  collectionInput, collectionMetadataInput, fieldInput, fieldLabelInput, updateFieldLabelInput, identifier, parse, revisionInput
} from '../database/validation.ts';

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
  minLength: optionalLength, maxLength: optionalLength
}), v.forward(v.check(input => input.id === undefined || input.id === input.collection,
  'Form instance must match the collection'), ['id']),
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
  const { id: _id, collection, expectedSchemaVersion, minLength, maxLength, ...field } = input;
  const validation = minLength === undefined && maxLength === undefined ? {} : {
    validation: { ...(minLength === undefined ? {} : { minLength }), ...(maxLength === undefined ? {} : { maxLength }) }
  };
  return { collection, expectedSchemaVersion, input: parse(fieldInput, { ...field, ...validation }) };
}
