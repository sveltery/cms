import type { CollectionFilter, EntryFilter } from './loader.ts';
import type { Kysely } from 'kysely';
import type { Database } from '../database/lifecycle/upstream/database/types.ts';

export interface LoaderCacheHint {
  tags?: string[];
  lastModified?: Date;
}

export interface LiveEntry<T = Record<string, unknown>> {
  id: string;
  slug?: string;
  status?: string;
  data: T;
  cacheHint?: LoaderCacheHint;
}

export interface LiveCollectionResult<T = Record<string, unknown>> {
  entries?: LiveEntry<T>[];
  error?: Error;
  cacheHint?: LoaderCacheHint;
  nextCursor?: string;
  hasMore?: boolean;
}

// Native server loader surface replaces the Astro framework interface while
// retaining the original complete collection and entry algorithm bodies.
export interface LiveLoader<T, Entry = EntryFilter, Collection = CollectionFilter> {
  name: string;
  loadCollection(input: {filter?: Collection}): Promise<LiveCollectionResult<T>>;
  loadEntry(input: {filter: Entry}): Promise<LiveEntry<T> | {error: Error} | undefined>;
}

export type QueryDatabase = Kysely<Database>;
