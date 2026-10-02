import { Miniflare } from 'miniflare';
import { join } from 'node:path';
import { openSqlite } from '../../src/lib/server/database/sqlite.ts';
import { openD1 } from '../../src/lib/server/database/d1.ts';

/** Independent adapter handles for metadata races; isolated local fixtures only. */
export async function fieldEditIndependentStorage(target: 'Node' | 'D1', directory: string) {
  if (target === 'Node') {
    const path = join(directory, 'field-edit.sqlite');
    const database = openSqlite(path); const independent = openSqlite(path);
    return { database, independent, async close() { await independent.close(); await database.close(); } };
  }
  const runtime = new Miniflare({ modules: true,
    script: 'export default { fetch() { return new Response("field-edit fixture"); } }',
    compatibilityDate: '2026-05-07', host: '127.0.0.1', port: 0, cf: false,
    d1Databases: { DB: 'cms-field-edit-independent' }, d1Persist: directory });
  const binding = await runtime.getD1Database('DB');
  const database = openD1(binding); const independent = openD1(binding);
  return { database, independent, async close() {
    await independent.close(); await database.close(); await runtime.dispose();
  } };
}
