import * as v from 'valibot';
import { fieldType, fieldMetadataEntries } from './field-validation.ts';
import { identifier } from './validation.ts';

// Bounded string/text subset of EmDash 1.1.0 api/schemas/schema.ts:232.
// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// No defaults: omitted keys preserve metadata. A validation object replaces it,
// null clears it, and an empty object remains a distinct persisted object.
const length = v.pipe(v.number(), v.safeInteger(), v.minValue(0));
const objectInput = v.custom<Record<string, unknown>>(value => value !== null && typeof value === 'object' && !Array.isArray(value));
export { fieldValidation as fieldEditValidation } from './field-validation.ts';
const entries = { ...fieldMetadataEntries,
  label: v.optional(v.pipe(v.string(), v.minLength(1))), type: v.optional(fieldType), sortOrder: v.optional(length)
};
export const fieldEditInput = v.pipe(objectInput, v.strictObject(entries));
export const updateFieldInput = v.strictObject({
  collection: identifier, field: identifier, ...entries
});
