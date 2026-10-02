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
const nestedData = v.pipe(
  v.record(identifier, v.pipe(v.string(), v.maxLength(100_000))),
  v.check(value => Object.keys(value).length <= 32),
  v.check(value => JSON.stringify(value).length <= 200_000)
);
const jsonData = v.pipe(v.string(), v.maxLength(200_000), v.check(value => {
  try { return v.safeParse(schemaData, JSON.parse(value)).success; } catch { return false; }
}), v.transform(value => parse(schemaData, JSON.parse(value))));
// JSON supports nullable values and schema keys reserved by the framework's nested form parser.
const data = v.optional(v.union([jsonData, nestedData]), {});
const slug = v.optional(v.pipe(v.string(), v.maxLength(200)));
export const createInput = v.strictObject({ ...qualified, data, slug });
export const revisionToken = v.pipe(v.string(), v.minLength(1), v.maxLength(2048), v.regex(/^[A-Za-z0-9_-]+$/));
export const updateInput = v.strictObject({ ...contentKey.entries, _rev: revisionToken, data, slug });
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
