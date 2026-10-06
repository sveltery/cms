// Test-only baseline bridge: existing public namespace, without a production seed adapter.
export { canonicalSourceDatabase as seedSourceDatabase } from '../../../src/lib/server/canonical-storage/namespace.ts';
import { canonicalSourceDatabase } from '../../../src/lib/server/canonical-storage/namespace.ts';
import type { CmsDatabase } from '../../../src/lib/server/database/contract.ts';
import type { Compilable, Kysely, RawBuilder } from 'kysely';
// Test-only baseline compiles through the existing public namespace into the real atomic host.
export async function seedAtomicBatch(database: CmsDatabase, _view: Kysely<any>, build: (db: Kysely<any>) => readonly (Compilable | RawBuilder<unknown>)[]) {
  const db = canonicalSourceDatabase(database);
  const statements = build(db).map(query => 'isRawBuilder' in query ? query.compile(db) : query.compile());
  return database.atomicBatch(statements);
}
