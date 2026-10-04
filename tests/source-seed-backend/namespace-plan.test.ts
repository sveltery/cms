import { expect, it } from 'vitest';
import { sql, type Kysely } from 'kysely';
import { seedSourceDatabase, seedAtomicBatch } from 'seed-namespace-subject';
import { schemaAdminStorage } from '../helpers/schema-admin-storage.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';

// Whole original Native cases for Source-shaped identifier/catalog inputs and batch limits.
for (const target of ['Node', 'D1'] as const) {
  it(`${target}: maps RawBuilder table identifiers without altering dotted alias references`, async () => {
    const storage = await schemaAdminStorage(target);
    try {
      await migrateCms(storage.database);
      await storage.database.db.insertInto('_cms_options').values({ name: 'site:title', value: 'Stored' }).execute();
      const db = seedSourceDatabase(storage.database) as Kysely<any>;
      const alias = sql<{ value: string }>`SELECT ${sql.ref('options.value')} AS value FROM ${sql.ref('options')} AS options WHERE options.name = ${'site:title'}`;
      expect(alias.compile(db).sql).toBe('SELECT "options"."value" AS value FROM "_cms_options" AS options WHERE options.name = ?');
      expect((await alias.execute(db)).rows).toEqual([{ value: 'Stored' }]);
      const fields = sql<{ label: string }>`SELECT label FROM ${sql.ref('_emdash_fields')} WHERE id = ${'not-a-field'}`;
      expect(fields.compile(db).sql).toBe('SELECT label FROM "_cms_fields" WHERE id = ?');
      expect((await fields.execute(db)).rows).toEqual([]);
    } finally { await storage.close(); }
  }, 30000);

  it(`${target}: retains logical foreign-key catalog table names`, async () => {
    const storage = await schemaAdminStorage(target);
    try {
      await migrateCms(storage.database);
      const db = seedSourceDatabase(storage.database) as Kysely<any>;
      const result = await sql<{ table: string }>`PRAGMA foreign_key_list(${sql.ref('_emdash_fields')})`.execute(db).then(value => ({ value, error: null }), error => ({ value: null, error }));
      expect(result.error).toBeNull();
      expect(result.value?.rows.map(row => row.table)).toContain('_emdash_collections');
    } finally { await storage.close(); }
  }, 30000);

  it(`${target}: rejects a 102-binding atomic statement before any row is written`, async () => {
    const storage = await schemaAdminStorage(target);
    try {
      await migrateCms(storage.database);
      const db = seedSourceDatabase(storage.database) as Kysely<any>;
      const values = Array.from({ length: 51 }, (_, index) => ({ name: `namespace-limit-${index}`, value: 'Value' }));
      const failure = await seedAtomicBatch(storage.database, db, view => [view.insertInto('options').values(values)]).then(() => null, error => error);
      expect(failure).not.toBeNull();
      expect(await storage.database.db.selectFrom('_cms_options').selectAll().where('name', 'like', 'namespace-limit-%').execute()).toEqual([]);
    } finally { await storage.close(); }
  }, 30000);
}
