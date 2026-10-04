import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Kysely } from 'kysely';
import { Miniflare } from 'miniflare';
import { openSqlite } from '../../../src/lib/server/database/sqlite.ts';
import { openD1 } from '../../../src/lib/server/database/d1.ts';
import { CoalescingD1Dialect } from '../../../src/lib/server/database/coalescing-d1.ts';
import type { CmsDatabase, CmsTables } from '../../../src/lib/server/database/contract.ts';

export const storageTargets = ['Node SQLite', 'raw D1', 'scoped D1'] as const;
export type StorageTarget = typeof storageTargets[number];

/** Ordinary storage fixtures only; no authentication or concurrent callers. */
export async function canonicalStorage(target: StorageTarget) {
  let directory: string | undefined;
  let worker: Miniflare | undefined;
  let factory: () => CmsDatabase;
  if (target === 'Node SQLite') {
    directory = await mkdtemp(join(tmpdir(), 'cms-canonical-installation-'));
    const path = join(directory, 'cms.sqlite');
    factory = () => openSqlite(path);
  } else {
    worker = new Miniflare({ modules: true,
      script: 'export default {fetch() {return new Response("fixture")}}',
      compatibilityDate: '2026-05-07', host: '127.0.0.1', port: 0,
      d1Databases: { DB: 'cms-canonical-installation' }, cf: false });
    const binding = await worker.getD1Database('DB');
    factory = target === 'raw D1' ? () => openD1(binding) : () => {
      const dialect = new CoalescingD1Dialect({ database: binding });
      const adapter = dialect.createAdapter();
      const db = new Kysely<CmsTables>({ dialect });
      return { db, atomicBatch: statements =>
        db.connection().execute(() => adapter.executeAtomicBatch(statements)),
        close: () => db.destroy() };
    };
  }
  return {
    database: factory(),
    async reopen() {
      await this.database.close();
      this.database = factory();
      return this.database;
    },
    async close() {
      try { await this.database.close(); }
      finally {
        if (worker) await worker.dispose();
        if (directory) await rm(directory, { recursive: true, force: true });
      }
    }
  };
}
