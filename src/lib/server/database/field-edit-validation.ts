import * as v from 'valibot';
import { identifier } from './validation.ts';

// Bounded string/text subset of EmDash 1.1.0 api/schemas/schema.ts:232.
// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// No defaults: omitted keys preserve metadata. A validation object replaces it,
// null clears it, and an empty object remains a distinct persisted object.
const length = v.pipe(v.number(), v.safeInteger(), v.minValue(0));
// Valibot strictObject alone accepts [] when every property is optional;
// pinned Zod object rejects arrays before parsing properties.
const objectInput = v.custom<Record<string, unknown>>(value => value !== null
  && typeof value === 'object' && !Array.isArray(value));
export const fieldEditValidation = v.pipe(objectInput, v.strictObject({
  minLength: v.optional(length), maxLength: v.optional(length)
}), v.forward(v.check(value => value.minLength === undefined || value.maxLength === undefined
  || value.minLength <= value.maxLength, 'maxLength must be greater than or equal to minLength'), ['maxLength']));
const entries = {
  label: v.optional(v.pipe(v.string(), v.minLength(1))),
  sortOrder: v.optional(length),
  // Editing this value changes registry metadata only, never the SQL default.
  defaultValue: v.optional(v.string()),
  validation: v.optional(v.nullable(fieldEditValidation))
};
export const fieldEditInput = v.pipe(objectInput, v.strictObject(entries));
export const updateFieldInput = v.strictObject({
  collection: identifier, field: identifier, ...entries
});
