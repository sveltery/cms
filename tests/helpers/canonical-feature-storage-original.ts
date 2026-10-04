// Original native fixture. Real persisted Node/D1 storage; no invented providers.
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sql } from 'kysely';
import { Miniflare } from 'miniflare';
import type { D1Database } from '@cloudflare/workers-types';
import { openSqlite } from '../../src/lib/server/database/sqlite.ts';
import { openD1 } from '../../src/lib/server/database/d1.ts';
import { CMS_MIGRATIONS } from '../../src/lib/server/database/migrations.ts';
import { createRequestScopedDb } from '../../src/lib/server/runtime/cloudflare-d1.ts';
import { installVersion4 } from './lifecycle-startup.ts';

export type StorageMode = 'Node' | 'raw D1' | 'scoped D1';
export async function historicalFeatureStorage(mode: StorageMode, version: 0 | 4 | 5 = 5) {
  const directory = await mkdtemp(join(tmpdir(), 'canonical-feature-storage-'));
  const path = join(directory, 'cms.sqlite');
  const worker = mode === 'Node' ? null : new Miniflare({ modules: true,
    script: 'export default { fetch() { return new Response("ordinary persisted storage"); } }',
    compatibilityDate: '2026-05-07', d1Databases: { CMS_DB: 'canonical-feature-reopen' }, host: '127.0.0.1', port: 0, cf: false });
  const binding = worker ? await worker.getD1Database('CMS_DB') : null;
  let raw = binding ? openD1(binding) : openSqlite(path);
  const scopeForBinding = () => mode === 'scoped D1' ? createRequestScopedDb({
    config: { binding: 'CMS_DB', session: 'auto', coalesce: true }, binding: binding as unknown as D1Database,
    isAuthenticated: false, isWrite: true, cookies: { get() { return undefined; }, set() {} },
    url: new URL('https://ordinary-persisted-storage.invalid/') }) : null;
  let scope = scopeForBinding();
  if (mode === 'scoped D1') assert.ok(scope);
  async function closeConnections() { if (scope) await scope.database.close(); await raw.close(); }
  try {
    const database = scope?.database ?? raw;
    if (version > 0) await installVersion4(database);
    if (version === 5) {
      const lifecycle = CMS_MIGRATIONS.find(provider => provider.version === 5);
      assert.ok(lifecycle);
      await database.atomicBatch([...await lifecycle.statements(database),
        sql`INSERT INTO _cms_migrations(version) VALUES (5)`.compile(database.db)]);
    }
    return {
      get database() { return scope?.database ?? raw; },
      async reopen() {
        await closeConnections(); raw = binding ? openD1(binding) : openSqlite(path); scope = scopeForBinding();
        if (mode === 'scoped D1') assert.ok(scope);
      },
      async close() { try { await closeConnections(); } finally { await worker?.dispose(); await rm(directory, { recursive: true, force: true }); } }
    };
  } catch (error) {
    try { await closeConnections(); } finally { await worker?.dispose(); await rm(directory, { recursive: true, force: true }); }
    throw error;
  }
}
