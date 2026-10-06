import { expect, it } from 'vitest';
import { sql, type AbortableOperationOptions, type CompiledQuery, type QueryResult } from 'kysely';
import { seedSourceDatabase } from 'seed-namespace-subject';
import { schemaAdminStorage } from '../helpers/schema-admin-storage.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import { prepareOpaqueMediaIndexFixture } from '../helpers/source-seed-backend/opaque-media-index-fixture.ts';

// Whole original Native compound-catalog cases; no Source/auth credit.
for (const target of ['Node', 'D1'] as const) {
  for (const compound of ['UNION', 'UNION ALL', 'INTERSECT', 'EXCEPT'] as const) {
    it(`${target}: refuses ${compound} catalog SQL before driver execution`, async () => {
      const storage = await schemaAdminStorage(target);
      try {
        await migrateCms(storage.database);
        await prepareOpaqueMediaIndexFixture(storage.database);
        await sql`CREATE INDEX _cms_media ON _cms_options(name)`.execute(storage.database.db);
        const oracle = await sql<{ name: string; tbl_name: string; type: string }>`SELECT name, tbl_name, type FROM sqlite_master WHERE name = ${'_cms_options'} OR name = ${'_cms_media'} ORDER BY type`.execute(storage.database.db);
        expect(oracle.rows).toEqual([
          { name: '_cms_media', tbl_name: '_cms_options', type: 'index' },
          { name: '_cms_options', tbl_name: '_cms_options', type: 'table' }
        ]);

        await storage.database.db.connection().execute(async physical => {
          let executions = 0;
          let restore = () => {};
          // Observe the pinned real connection; every delegated call still reaches SQLite/workerd.
          await physical.getExecutor().provideConnection(async connection => {
            const original = connection.executeQuery;
            connection.executeQuery = function<Row>(query: CompiledQuery, options?: AbortableOperationOptions): Promise<QueryResult<Row>> {
              executions++;
              return original.call(this, query, options) as Promise<QueryResult<Row>>;
            };
            restore = () => { connection.executeQuery = original; };
          });
          try {
              const db = seedSourceDatabase({ ...storage.database, db: physical });
              const query = compound === 'UNION'
                ? sql`SELECT name, tbl_name FROM sqlite_master WHERE type = 'table' AND name = ${'options'} UNION SELECT name, tbl_name FROM sqlite_master WHERE type = 'index' AND tbl_name = ${'options'} AND name = ${'_cms_media'}`
                : compound === 'UNION ALL'
                  ? sql`SELECT name, tbl_name FROM sqlite_master WHERE type = 'table' AND name = ${'options'} UNION ALL SELECT name, tbl_name FROM sqlite_master WHERE type = 'index' AND tbl_name = ${'options'} AND name = ${'_cms_media'}`
                  : compound === 'INTERSECT'
                    ? sql`SELECT name, tbl_name FROM sqlite_master WHERE type = 'table' AND name = ${'options'} INTERSECT SELECT name, tbl_name FROM sqlite_master WHERE type = 'index' AND tbl_name = ${'options'} AND name = ${'_cms_media'}`
                    : sql`SELECT name, tbl_name FROM sqlite_master WHERE type = 'table' AND name = ${'options'} EXCEPT SELECT name, tbl_name FROM sqlite_master WHERE type = 'index' AND tbl_name = ${'options'} AND name = ${'_cms_media'}`;
              let rejection: unknown = null;
              try { await query.execute(db); } catch (error) { rejection = error; }
              expect(rejection).toBeInstanceOf(Error);
              expect((rejection as Error).message).toBe('Seed compound catalog queries are not qualified');
              expect(executions).toBe(0);
              expect(() => query.compile(db)).toThrow('Seed compound catalog queries are not qualified');
          } finally { restore(); }
        });
      } finally { await storage.close(); }
    }, 30000);
  }

  it(`${target}: preserves compound words in catalog literals, quoted aliases and comments`, async () => {
    const storage = await schemaAdminStorage(target);
    try {
      await migrateCms(storage.database);
      const db = seedSourceDatabase(storage.database);
      const result = await sql`SELECT name, tbl_name, 'UNION ALL INTERSECT EXCEPT' AS "UNION" FROM sqlite_master WHERE type = 'table' AND name = ${'options'} /* UNION ALL SELECT name FROM sqlite_master */ -- EXCEPT
      `.execute(db);
      expect(result.rows).toEqual([{ name: 'options', tbl_name: 'options', UNION: 'UNION ALL INTERSECT EXCEPT' }]);
    } finally { await storage.close(); }
  }, 30000);
}
