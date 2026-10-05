import { Kysely, SqliteDialect, type QueryResult } from 'kysely';
import type { CmsDatabase, CmsTables } from './contract.ts';
import { openNodeSqliteDatabase } from './node-sqlite-compat.ts';
import { assertExecutableAtomicQueries, executeAtomicQueryLoop } from './atomic-query-loop.ts';

export function openSqlite(path: string): CmsDatabase {
  const native = openNodeSqliteDatabase(path, { journalMode: 'wal' });
  const db = new Kysely<CmsTables>({ dialect: new SqliteDialect({ database: native }) });
  return {
    db, atomicQueryLoops:true,
    async atomicBatch(statements) {
      assertExecutableAtomicQueries(statements);
      // Acquire Kysely's connection mutex, then keep the whole native transaction synchronous.
      // Awaiting between statements would let a second connection block Node while this one holds its lock.
      return db.connection().execute(async () => {
        native.exec('BEGIN IMMEDIATE');
        try {
          const results: QueryResult<unknown>[] = [];
          const execute = (query: typeof statements[number]): QueryResult<unknown> => {
            const statement = native.prepare(query.sql);
            if (statement.reader) return { rows: statement.all(query.parameters) };
            else {
              const result = statement.run(query.parameters);
              return { rows: [], numAffectedRows: BigInt(result.changes), insertId: BigInt(result.lastInsertRowid) };
            }
          };
          for (const query of statements) results.push(executeAtomicQueryLoop(query,execute));
          native.exec('COMMIT');
          return results;
        } catch (cause) {
          try { native.exec('ROLLBACK'); }
          catch { /* SQLite may already have rolled back on an I/O failure. */ }
          throw cause;
        }
      });
    },
    async close() { await db.destroy(); }
  };
}
