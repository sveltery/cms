import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { openSqlite } from '../database/sqlite.ts';
import type { LocalStorageConfig } from '../general-media/upstream/storage/types.ts';

export async function createRuntimeLocalStorage(config: LocalStorageConfig) {
  const { LocalStorage } = await import('../general-media/upstream/storage/local.ts');
  return new LocalStorage(config);
}

export async function openRuntimeSqlite(path: string) {
  const filename = resolve(path.startsWith('file:') ? path.slice(5) : path);
  await mkdir(dirname(filename), { recursive: true });
  return openSqlite(filename);
}
