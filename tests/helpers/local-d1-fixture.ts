// Original test-only fixture extracted unchanged for direct native transport tests.
import { Miniflare } from 'miniflare';
import { openD1 } from '../../src/lib/server/database/d1.ts';

export async function localD1(path?: string, script = 'export default { fetch() { return new Response("fixture"); } }') {
  const runtime = new Miniflare({ modules: true, script, compatibilityDate: '2026-05-07', host: '127.0.0.1', port: 0,
    d1Databases: { DB: 'cms-test-d1' }, d1Persist: path ?? false, cf: false });
  const binding = await runtime.getD1Database('DB');
  return { runtime, binding, database: openD1(binding) };
}
