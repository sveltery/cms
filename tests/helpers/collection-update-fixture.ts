import { asyncD1StorageFor } from './async-d1-storage.ts';
import { openD1 } from '../../src/lib/server/database/d1.ts';
import { openSqlite } from '../../src/lib/server/database/sqlite.ts';
import { join } from 'node:path';

export async function collectionUpdateStorage(target: 'Node' | 'D1', directory?: string) {
  if (target === 'Node') {
    const database = openSqlite(directory ? join(directory, 'cms.sqlite') : ':memory:');
    return { database, close: () => database.close() };
  }
  const { runtime, binding } = await asyncD1StorageFor('cms-collection-update', directory);
  const database = openD1(binding);
  return { database, async close() { await database.close(); await runtime.dispose(); } };
}
