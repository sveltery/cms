import type {Kysely} from 'kysely';

// Fixed trusted read-host metadata. This is not a table-name override, database
// adapter, migration, cache, writer or query/result/log transformer.
const canonicalTables = Object.freeze({
  terms: '_cms_taxonomies', assignments: '_cms_content_taxonomies',
  bylines: '_cms_bylines', credits: '_cms_content_bylines', media: '_cms_media',
  seo: '_cms_seo', fields: '_cms_fields', collections: '_cms_collections',
  revisions: '_cms_revisions', relations: '_cms_relations'
} as const);
const sourceReadHosts = new WeakSet<object>();

/** Bind only a genuine, already-created immutable Source physical fixture. */
export function bindSourceQueryReadHost(database: Kysely<unknown>): void {
  sourceReadHosts.add(database);
}

export function isSourceQueryReadHost(database: object): boolean {
  return sourceReadHosts.has(database);
}

// Exact former canonical behavior, extracted before Source-host namespace repair.
export function queryReadStorage(_database: object) {
  return canonicalTables;
}
