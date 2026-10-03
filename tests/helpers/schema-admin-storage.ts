import { join } from 'node:path';
import { openSqlite } from '../../src/lib/server/database/sqlite.ts';
import { openD1 } from '../../src/lib/server/database/d1.ts';
import { asyncD1Storage } from './async-d1-storage.ts';

/** Dedicated isolated schema-admin storage; never imported by application source. */
export async function schemaAdminStorage(target: 'Node' | 'D1', directory?: string) {
  if (target === 'Node') {
    const database = openSqlite(directory ? join(directory, 'schema.sqlite') : ':memory:');
    return { database, close: () => database.close() };
  }
  const { runtime, binding } = await asyncD1Storage(directory);
  const database = openD1(binding);
  let closing: Promise<void> | undefined;
  return { database, close() {
    return closing ??= (async () => { try { await database.close(); } finally { await runtime.dispose(); } })();
  } };
}
