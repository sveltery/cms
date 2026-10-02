import { Miniflare } from 'miniflare';
import { openD1 } from '../../src/lib/server/database/d1.ts';
import { openSqlite } from '../../src/lib/server/database/sqlite.ts';
import { join } from 'node:path';

export async function collectionUpdateStorage(target: 'Node' | 'D1', directory?: string) {
  if (target === 'Node') {
    const database = openSqlite(directory ? join(directory, 'cms.sqlite') : ':memory:');
    return { database, close: () => database.close() };
  }
  const runtime = new Miniflare({ modules: true,
    script: 'export default { fetch() { return new Response("collection update fixture"); } }',
    compatibilityDate: '2026-05-07', host: '127.0.0.1', port: 0, cf: false,
    d1Databases: { DB: 'cms-collection-update' }, d1Persist: directory ?? false });
  const database = openD1(await runtime.getD1Database('DB'));
  return { database, async close() { await database.close(); await runtime.dispose(); } };
}
