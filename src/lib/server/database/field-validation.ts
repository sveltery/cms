import * as v from 'valibot';
import { FIELD_TYPES, REPEATER_SUB_FIELD_TYPES } from '../schema/types.ts';

// Pinned api/schemas/schema.ts fieldValidation; runner schema maps to Valibot.
// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
const integer = v.pipe(v.number(), v.safeInteger(), v.minValue(0));
const slug = v.pipe(v.string(), v.minLength(1), v.maxLength(63), v.regex(/^[a-z][a-z0-9_]*$/));
const object = v.custom<Record<string, unknown>>(value => value !== null && typeof value === 'object' && !Array.isArray(value));
export const fieldType = v.picklist(FIELD_TYPES);
export const fieldValidation = v.pipe(object, v.strictObject({
  required: v.optional(v.boolean()), min: v.optional(v.number()), max: v.optional(v.number()),
  minLength: v.optional(integer), maxLength: v.optional(integer),
  pattern: v.optional(v.pipe(v.string(), v.check(value => { try { new RegExp(value); return true; } catch { return false; } }))),
  options: v.optional(v.array(v.string())),
  subFields: v.optional(v.pipe(v.array(v.strictObject({
    slug, label: v.pipe(v.string(), v.minLength(1)), type: v.picklist(REPEATER_SUB_FIELD_TYPES),
    required: v.optional(v.boolean()), options: v.optional(v.array(v.string()))
  })), v.minLength(1))),
  minItems: v.optional(integer), maxItems: v.optional(v.pipe(integer, v.minValue(1))),
  allowedMimeTypes: v.optional(v.pipe(v.array(v.pipe(v.string(), v.regex(/^[a-z0-9][a-z0-9!#$&^_+\-.]*\/[a-z0-9!#$&^_+\-.]*$/i))), v.minLength(1), v.maxLength(64))),
  targetCollection: v.optional(v.pipe(v.string(), v.minLength(1))), multiple: v.optional(v.boolean()),
  relation: v.optional(slug), relationSide: v.optional(v.picklist(['parent','child'])),
  allowedTypes: v.optional(v.array(slug)), retiredTypes: v.optional(v.array(slug))
}), v.check(value => (value.min === undefined || value.max === undefined || value.min <= value.max)
  && (value.minLength === undefined || value.maxLength === undefined || value.minLength <= value.maxLength)
  && (value.minItems === undefined || value.maxItems === undefined || value.minItems <= value.maxItems)));
export const widgetOptions = v.record(v.string(), v.unknown());
export const fieldMetadataEntries = {
  required: v.optional(v.boolean()), unique: v.optional(v.boolean()),
  defaultValue: v.optional(v.unknown()), validation: v.optional(v.nullable(fieldValidation)),
  widget: v.optional(v.string()), options: v.optional(widgetOptions), sortOrder: v.optional(integer),
  searchable: v.optional(v.boolean()), indexed: v.optional(v.boolean()), translatable: v.optional(v.boolean())
};
