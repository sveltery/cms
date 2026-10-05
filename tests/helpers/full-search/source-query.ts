// Explicit same-owner transport for unchanged whole pinned Source query tests.
import type { Kysely } from 'kysely';
import type { Database } from '../../../src/lib/server/database/lifecycle/upstream/database/types.ts';
import type { SearchOptions } from '../../../src/lib/server/content-picker/types.ts';
import * as native from '../../../src/lib/server/search/query.ts';
import { FTSManager } from './source-fts.ts';
export function searchWithDb(db: Kysely<Database>, query: string, options: SearchOptions = {}) {
  return native.searchWithDb(db, query, options, new FTSManager(db));
}
export function searchCollection(db: Kysely<Database>, collection: string, query: string, options: Parameters<typeof native.searchCollection>[3] = {}) {
  return native.searchCollection(db, collection, query, options, new FTSManager(db));
}
export function getSuggestions(db: Kysely<Database>, query: string, options: Parameters<typeof native.getSuggestions>[2] = {}) {
  return native.getSuggestions(db, query, options, new FTSManager(db));
}
export function getSearchStats(db: Kysely<Database>) { return native.getSearchStats(db, new FTSManager(db)); }
