import type {Kysely} from 'kysely';

// Fixed trusted read-host metadata. This is not a table-name override, database
// adapter, migration, cache, writer or query/result/log transformer.
const canonicalTables = Object.freeze({
  terms: '_cms_taxonomies', assignments: '_cms_content_taxonomies',
  bylines: '_cms_bylines', credits: '_cms_content_bylines', media: '_cms_media',
  seo: '_cms_seo', fields: '_cms_fields', collections: '_cms_collections',
  revisions: '_cms_revisions', relations: '_cms_relations'
} as const);
const sourceTables = Object.freeze({
  terms: 'taxonomies', assignments: 'content_taxonomies',
  bylines: '_emdash_bylines', credits: '_emdash_content_bylines', media: 'media',
  seo: '_emdash_seo', fields: '_emdash_fields', collections: '_emdash_collections',
  revisions: 'revisions', relations: '_emdash_relations'
} as const);
const sourceReadHosts = new WeakSet<object>();

/** Bind only a genuine, already-created immutable Source physical fixture. */
export function bindSourceQueryReadHost(database: Kysely<unknown>): void {
  sourceReadHosts.add(database);
}

export function isSourceQueryReadHost(database: object): boolean {
  return sourceReadHosts.has(database);
}

export function queryReadStorage(database: object) {
  return isSourceQueryReadHost(database) ? sourceTables : canonicalTables;
}
