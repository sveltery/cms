// EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
import { getRequestEvent } from '$app/server';
import { searchWithDb } from './query.ts';
import type { SearchOptions, SearchResponse } from '../content-picker/types.ts';
export { FTSManager } from '../content-picker/fts-manager.ts';
export { searchWithDb, searchCollection, getSuggestions, getSearchStats } from './query.ts';
export { SEARCH_TOKENIZERS } from '../content-picker/types.ts';
export type * from '../content-picker/types.ts';
/** Source convenience API bound to the current SvelteKit server request. */
export async function search(query: string, options: SearchOptions = {}): Promise<SearchResponse> {
  const configured = getRequestEvent().locals.cms;
  if (!configured) throw new Error('Search not configured');
  return searchWithDb(configured.database.db as any, query, options);
}
