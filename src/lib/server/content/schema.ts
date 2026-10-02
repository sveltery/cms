import * as v from 'valibot';
import { CmsError, type DraftEntry, type DraftSummary } from '../database/contract.ts';
import { identifier, entryId, localeInput, revisionInput, schemaData, parse } from '../database/validation.ts';

const qualified = { collection: identifier, locale: v.optional(localeInput, 'en') };
export const contentKey = v.strictObject({ ...qualified, id: entryId });
export const contentList = v.strictObject({
  ...qualified,
  limit: v.optional(v.pipe(v.number(), v.safeInteger(), v.minValue(1))),
  cursor: v.optional(v.pipe(v.string(), v.maxLength(2048)))
});
// Unlike active reads and mutations, omitted locale means every trash locale.
const trashQualified = { collection: identifier, locale: v.optional(localeInput) };
export const trashedContentCount = v.strictObject(trashQualified);
export const trashedContentKey = v.strictObject({ ...trashQualified, id: entryId });
export const trashedContentList = v.strictObject({
  ...trashQualified,
  cursor: v.optional(v.pipe(v.string(), v.maxLength(2048))),
  limit: v.optional(v.pipe(v.number(), v.safeInteger(), v.minValue(1)))
});
export const collectionSlug = identifier;
// Enhanced forms carry real JSON values. Whole-record JSON also supports field
// names reserved by Kit's nested form parser. Both use the domain JSON bounds.
// Kit's static form-field typing cannot express dynamic JSON/nulls and treats
// booleans inside arrays as required checkboxes. Only this input adapter uses
// `any`; the actual shared JSON guard and domain output stay bounded/unknown.
const data = v.optional(v.pipe(v.custom<string | Record<string, any>>(value => {
  if (typeof value !== 'string') return v.safeParse(schemaData, value).success;
  if (value.length > 200_000) return false;
  try { return v.safeParse(schemaData, JSON.parse(value)).success; } catch { return false; }
}),
  v.rawCheck(({ dataset, addIssue }) => {
    if (!dataset.typed || typeof dataset.value === 'string') return;
    for (const [key, value] of Object.entries(dataset.value)) if (typeof value === 'string' && value.length > 100_000) {
      addIssue({ message: 'Content text is too long', path: [{ type: 'object', origin: 'value', input: dataset.value, key, value }] });
    }
  }),
  v.transform(value => typeof value === 'string' ? parse(schemaData, JSON.parse(value)) : value as Record<string, unknown>)), {});
const jsonValue = v.pipe(v.string(), v.maxLength(200_000), v.check(value => {
  try { JSON.parse(value); return true; } catch { return false; }
}, 'Enter valid JSON'), v.transform(value => JSON.parse(value) as unknown));
// Native HTML controls can carry a complex value without a JavaScript widget.
// This transport-only map never reaches storage or the domain service.
const jsonData = v.optional(v.record(identifier, jsonValue), {});
const slug = v.optional(v.pipe(v.string(), v.maxLength(200)));
const contentEntries = { data, jsonData, slug };
export const createInput = v.pipe(v.strictObject({ ...qualified, ...contentEntries }),
  v.forward(v.check(input => Object.keys(input.jsonData).every(key => !Object.hasOwn(input.data, key)),
    'Supply each field once'), ['jsonData']),
  v.transform(({ jsonData, ...input }) => ({ ...input, data: { ...input.data, ...jsonData } })),
  v.forward(v.check(input => v.safeParse(schemaData, input.data).success, 'Invalid content data'), ['data']));
export const revisionToken = v.pipe(v.string(), v.minLength(1), v.maxLength(2048), v.regex(/^[A-Za-z0-9_-]+$/));
export const updateInput = v.pipe(v.strictObject({ ...contentKey.entries, _rev: revisionToken, ...contentEntries }),
  v.forward(v.check(input => Object.keys(input.jsonData).every(key => !Object.hasOwn(input.data, key)),
    'Supply each field once'), ['jsonData']),
  v.transform(({ jsonData, ...input }) => ({ ...input, data: { ...input.data, ...jsonData } })),
  v.forward(v.check(input => v.safeParse(schemaData, input.data).success, 'Invalid content data'), ['data']));
export const trashInput = v.strictObject({ ...contentKey.entries, _rev: revisionToken });
export const restoreInput = v.strictObject({ ...contentKey.entries, _rev: revisionToken });
const token = v.strictObject({ ...contentKey.entries, expected: revisionInput });

export function withRevision<T extends DraftEntry | DraftSummary>(entry: T) {
  const encoded = new TextEncoder().encode(JSON.stringify({ collection: entry.type, id: entry.id, locale: entry.locale,
    expected: { version: entry.version, updatedAt: entry.updatedAt } }));
  const _rev = btoa(Array.from(encoded, byte => String.fromCharCode(byte)).join(''))
    .replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  const { version, ...value } = entry;
  return { ...value, _rev };
}

/** A concurrency token, not an authorization credential. Storage performs the atomic comparison. */
export function precondition(input: { collection: string; id: string; locale: string; _rev: string }) {
  try {
    parse(revisionToken, input._rev);
    const binary = atob(input._rev.replaceAll('-', '+').replaceAll('_', '/'));
    const decoded = parse(token, JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, c => c.charCodeAt(0)))));
    if (decoded.collection !== input.collection || decoded.id !== input.id || decoded.locale !== input.locale) throw new CmsError('VALIDATION_ERROR');
    return decoded.expected;
  } catch { throw new CmsError('VALIDATION_ERROR'); }
}
