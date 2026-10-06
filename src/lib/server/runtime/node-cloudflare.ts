/** Cloudflare builds use D1. No unsupported Node SQLite module enters the Worker graph. */
import type { LocalStorageConfig } from '../general-media/upstream/storage/types.ts';

export function createRuntimeLocalStorage(_config: LocalStorageConfig): never {
  throw new Error('SVELTERY_MEDIA_DIRECTORY requires the Node SQLite runtime');
}

export async function openRuntimeSqlite(_path: string): Promise<never> {
  throw new Error('SVELTERY_DATABASE_PATH is unavailable on Cloudflare; configure a D1 binding in d1_databases');
}
