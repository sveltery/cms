import * as v from 'valibot';
import {
  collectionInput, collectionMetadataInput, fieldInput, fieldLabelInput, updateFieldLabelInput, identifier, parse, revisionInput
} from '../database/validation.ts';
import { updateFieldInput } from '../database/field-edit-validation.ts';

// Native forms keep omitted support flags distinct from an explicit JSON [].
const supportsValue = collectionInput.entries.supports.wrapped;
const supports = v.optional(v.pipe(v.string(), v.maxLength(512), v.check(value => {
  try { return v.safeParse(supportsValue, JSON.parse(value)).success; } catch { return false; }
}), v.transform(value => parse(supportsValue, JSON.parse(value)))));
const formBoolean = v.pipe(v.union([v.boolean(), v.picklist(['true', 'false'])]), v.transform(value => value === true || value === 'true'));
const optionalBoolean = v.optional(formBoolean);
const optionalJson = v.optional(v.pipe(v.string(), v.maxLength(200_000), v.check(value => { try { JSON.parse(value); return true; } catch { return false; } }), v.transform(value => JSON.parse(value))));
const clearableIdentifier = v.optional(v.pipe(v.string(), v.transform(value => value === '' ? null : value), v.nullable(identifier)));
const metadata = {
  label: v.optional(collectionInput.entries.label),
  labelSingular: collectionInput.entries.labelSingular,
  description: collectionInput.entries.description,
  supports, icon: v.optional(v.string()), group: v.optional(v.pipe(v.string(), v.transform(value => value === '' ? null : value))),
  routable: optionalBoolean, hidden: optionalBoolean, hasSeo: optionalBoolean, editLocking: optionalBoolean,
  commentsEnabled: optionalBoolean, listColumns: optionalJson, quickCreate: optionalBoolean,
  urlPattern: v.optional(v.pipe(v.string(), v.transform(value => value === '' ? null : value)))
};
const optionalEditMode = v.optional(v.picklist(['keep', 'set']));
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
  slug: identifier, ...metadata, label: collectionInput.entries.label, settingsMode: optionalEditMode
});
export const updateInput = v.pipe(v.strictObject({
  // Kit form.for(collection) injects this instance key on native and enhanced submissions.
  id: v.optional(identifier), collection: identifier, ...metadata,
  version: decimalVersion, updatedAt: revisionInput.entries.updatedAt,
  titleField: clearableIdentifier, dateField: clearableIdentifier,
  sortOrder: v.optional(v.pipe(v.string(), v.transform(value => value === '' ? null : Number(value)), v.nullable(v.pipe(v.number(), v.safeInteger())))),
  commentsModeration: collectionMetadataInput.pipe[1].entries.commentsModeration,
  commentsClosedAfterDays: v.optional(v.pipe(v.string(), v.transform(Number), v.number(), v.safeInteger(), v.minValue(0))),
  commentsAutoApproveUsers: optionalBoolean,
  settingsMode: optionalEditMode, displayMode: optionalEditMode, adminMode: optionalEditMode
}), v.forward(v.check(input => input.id === undefined || input.id === input.collection,
  'Form instance must match the collection'), ['id']));
export const addFieldInput = v.pipe(v.strictObject({
  id: v.optional(identifier), collection: identifier, expectedSchemaVersion: decimalVersion,
  slug: fieldInput.entries.slug, label: fieldInput.entries.label, type: fieldInput.entries.type,
  required: fieldInput.entries.required, unique: fieldInput.entries.unique,
  defaultValue: v.optional(v.pipe(v.string(),v.maxLength(100_000),v.check(value => !value.includes('\0')))),
  minLength: optionalLength, maxLength: optionalLength, patternMode, pattern: editString,
  defaultValueJson: optionalJson, validationJson: optionalJson, optionsJson: optionalJson,
  widget: v.optional(v.string()), indexed: v.optional(v.boolean()), searchable: v.optional(v.boolean()), translatable: optionalBoolean
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
  const { settingsMode, ...settings } = input;
  const metadata = {...settings};
  if (settingsMode === 'keep') for (const key of ['icon','group','routable','hidden','hasSeo','urlPattern','editLocking','commentsEnabled','listColumns','quickCreate'] as const) delete metadata[key];
  const { listColumns, quickCreate, ...value } = metadata;
  return parse(collectionInput, { ...value, ...(listColumns === undefined && quickCreate === undefined ? {} : {admin: { ...(listColumns === undefined ? {} : {listColumns}), ...(quickCreate === undefined ? {} : {quickCreate}) }}) });
}
export function convertCollectionUpdate(input: v.InferOutput<typeof updateInput>) {
  const { id: _id, collection, version, updatedAt, settingsMode, displayMode, adminMode, ...value } = input;
  const metadata = {...value};
  if (settingsMode === 'keep') for (const key of ['icon','group','routable','hidden','hasSeo','urlPattern','editLocking','commentsEnabled','commentsModeration','commentsClosedAfterDays','commentsAutoApproveUsers','sortOrder'] as const) delete metadata[key];
  if (displayMode === 'keep') {delete metadata.titleField; delete metadata.dateField;}
  if (adminMode === 'keep') {delete metadata.listColumns; delete metadata.quickCreate;}
  const {listColumns,quickCreate,...rest} = metadata;
  return { collection, input: parse(collectionMetadataInput, { ...rest, ...(listColumns === undefined && quickCreate === undefined ? {} : {admin: { ...(listColumns === undefined ? {} : {listColumns}), ...(quickCreate === undefined ? {} : {quickCreate}) }}) }), expected: { version, updatedAt } };
}
export function convertFieldAdd(input: v.InferOutput<typeof addFieldInput>) {
  const { id: _id, collection, expectedSchemaVersion, minLength, maxLength, patternMode, pattern, defaultValueJson, validationJson, optionsJson, ...field } = input;
  const validation = minLength === undefined && maxLength === undefined && patternMode !== 'set' ? {} : {
    validation: { ...(minLength === undefined ? {} : { minLength }), ...(maxLength === undefined ? {} : { maxLength }),
      ...(patternMode === 'set' ? { pattern } : {}) }
  };
  return { collection, expectedSchemaVersion, input: parse(fieldInput, { ...field, ...validation,
    ...(defaultValueJson === undefined ? {} : {defaultValue:defaultValueJson}),
    ...(validationJson === undefined ? {} : {validation:validationJson}), ...(optionsJson === undefined ? {} : {options:optionsJson}) }) };
}

const fieldIdentity = { id: v.optional(v.string()), collection: identifier, field: identifier };
export const fieldMetadataFormInput = v.pipe(v.strictObject({ ...fieldIdentity,
  type: v.optional(fieldInput.entries.type), widget: v.optional(v.string()),
  defaultValueJson: optionalJson, validationJson: optionalJson, optionsJson: optionalJson,
  required: optionalBoolean, unique: optionalBoolean, searchable: optionalBoolean, indexed: optionalBoolean, translatable: optionalBoolean,
  typeMode: optionalEditMode, widgetMode: optionalEditMode, defaultValueMode: optionalEditMode,
  validationMode: optionalEditMode, optionsMode: optionalEditMode, searchableMode: optionalEditMode,
  indexedMode: optionalEditMode, translatableMode: optionalEditMode
}),v.forward(v.check(input => input.id === undefined || input.id === `${input.collection}/${input.field}`,
  'Form instance must match the collection and field'), ['id']));
export function convertFieldMetadata(input: v.InferOutput<typeof fieldMetadataFormInput>) {
  const {id:_id, defaultValueJson, validationJson, optionsJson, typeMode, widgetMode,
    defaultValueMode,validationMode,optionsMode,searchableMode,indexedMode,translatableMode,...value} = input;
  const metadata={...value};
  if(typeMode === 'keep') delete metadata.type;
  if(widgetMode === 'keep') delete metadata.widget;
  if(searchableMode === 'keep') delete metadata.searchable;
  if(indexedMode === 'keep') delete metadata.indexed;
  if(translatableMode === 'keep') delete metadata.translatable;
  return parse(updateFieldInput, { ...metadata, ...(defaultValueMode === 'keep' || defaultValueJson === undefined ? {} : {defaultValue:defaultValueJson}),
    ...(validationMode === 'keep' || validationJson === undefined ? {} : {validation:validationJson}), ...(optionsMode === 'keep' || optionsJson === undefined ? {} : {options:optionsJson}) });
}
const precondition = { version: decimalVersion, updatedAt: revisionInput.entries.updatedAt };
export const fieldOrderInput = v.pipe(v.strictObject({ id:v.optional(identifier), collection:identifier, fields:optionalJson, ...precondition }),
  v.forward(v.check(input => input.id === undefined || input.id === input.collection,'Form instance must match the collection'),['id']));
export const fieldDeleteInput = v.pipe(v.strictObject({ ...fieldIdentity, ...precondition }),
  v.forward(v.check(input => input.id === undefined || input.id === `${input.collection}/${input.field}`,'Form instance must match the collection and field'),['id']));
export const collectionDeleteInput = v.pipe(v.strictObject({ id:v.optional(identifier), collection:identifier, force:v.optional(v.boolean(),false), ...precondition }),
  v.forward(v.check(input => input.id === undefined || input.id === input.collection,'Form instance must match the collection'),['id']));
export const collectionOrderInput = v.strictObject({ slugs:optionalJson, expected:optionalJson });
export function convertAdminOperation(input: {id?:string;collection:string;version:number;updatedAt:string;[key:string]:unknown}) {
  const {id:_id,version,updatedAt,...value}=input;
  return {...value,expected:{version,updatedAt}};
}
