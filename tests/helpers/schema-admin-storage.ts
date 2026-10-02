import { Miniflare } from 'miniflare';
import { join } from 'node:path';
import { openSqlite } from '../../src/lib/server/database/sqlite.ts';
import { openD1 } from '../../src/lib/server/database/d1.ts';

/** Dedicated isolated schema-admin storage; never imported by application source. */
export async function schemaAdminStorage(target: 'Node' | 'D1', directory?: string) {
  if (target === 'Node') {
    const database = openSqlite(directory ? join(directory, 'schema.sqlite') : ':memory:');
    return { database, close: () => database.close() };
  }
  const runtime = new Miniflare({ modules: true,
    script: 'export default { fetch() { return new Response("schema-admin fixture"); } }',
    compatibilityDate: '2026-05-07', host: '127.0.0.1', port: 0, cf: false,
    d1Databases: { DB: 'cms-schema-admin' }, d1Persist: directory ?? false });
  const database = openD1(await runtime.getD1Database('DB'));
  return { database, async close() { await database.close(); await runtime.dispose(); } };
}
