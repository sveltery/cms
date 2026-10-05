import { emdashLoader } from './loader.ts';
import type { CollectionFilter, EntryFilter } from './loader.ts';
import type { LiveEntry, LoaderCacheHint } from './types.ts';

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

export async function getLiveEntry(_collection: string, filter: EntryFilter): Promise<{
  entry?: LiveEntry;
  error?: Error;
  cacheHint?: LoaderCacheHint;
}> {
  const result = await emdashLoader().loadEntry({filter});
  if (!result) return {};
  if ('error' in result) return {error: result.error};
  return {entry: result, cacheHint: result.cacheHint};
}
