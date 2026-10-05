import { emdashLoader } from './loader.ts';
import type { CollectionFilter, EntryFilter } from './loader.ts';
import type { LiveEntry, LoaderCacheHint } from './types.ts';
import { LiveEntryNotFoundError } from '../../../../parity/astro-7.3.2/content-errors-authority/dist/content/loaders/errors.js';

// This is the actual Native framework provider used by the production SDK.
// The original supplied astro:content mocks resolve to this same module in the
// whole-test import host; no other loader or fake framework implementation runs.
export async function getLiveCollection(_collection: string, filter: CollectionFilter) {
  const result = await emdashLoader().loadCollection({filter});
  return {
    ...result,
    entries: result.entries ?? []
  };
}

export async function getLiveEntry(collection: string, filter: EntryFilter): Promise<{
  entry?: LiveEntry;
  error?: Error;
  cacheHint?: LoaderCacheHint;
}> {
  const result = await emdashLoader().loadEntry({filter});
  if (!result) return {error: new LiveEntryNotFoundError(collection, filter as unknown as Record<string, unknown>)};
  if ('error' in result) return {error: result.error};
  return {entry: result, cacheHint: result.cacheHint};
}
