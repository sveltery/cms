import { expect, it } from 'vitest';
import { sql, type Kysely } from 'kysely';
import { seedSourceDatabase } from 'seed-namespace-subject';
import { schemaAdminStorage } from '../helpers/schema-admin-storage.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import { listTablesLike } from '../../src/lib/server/seed/upstream/database/dialect-helpers.ts';

// Whole original Native catalog cases; no new Source/auth-family credit.
for (const target of ['Node', 'D1'] as const) {
  it(`${target}: preserves logical sqlite_master names and DDL table identifiers`, async () => {
    const storage = await schemaAdminStorage(target);
    try {
      await migrateCms(storage.database);
      const db = seedSourceDatabase(storage.database) as Kysely<any>;
      const result = await sql<{ name: string; sql: string }>`SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name = ${'_emdash_fields'}`.execute(db);
      expect(result.rows.map(row => row.name)).toEqual(['_emdash_fields']);
      expect(result.rows[0].sql).toMatch(/CREATE TABLE ["`\[]?_emdash_fields/i);
      expect(result.rows[0].sql).toContain('_emdash_collections');
    } finally { await storage.close(); }
  }, 30000);

  it(`${target}: maps bound index tbl_name values and preserves logical catalog results`, async () => {
    const storage = await schemaAdminStorage(target);
    try {
      await migrateCms(storage.database);
      const db = seedSourceDatabase(storage.database) as Kysely<any>;
      const result = await sql<{ tbl_name: string }>`SELECT tbl_name FROM sqlite_master WHERE type = 'index' AND tbl_name = ${'_emdash_fields'}`.execute(db);
      expect(result.rows.length).toBeGreaterThan(0);
      expect(new Set(result.rows.map(row => row.tbl_name))).toEqual(new Set(['_emdash_fields']));
    } finally { await storage.close(); }
  }, 30000);

  it(`${target}: executes a readonly PRAGMA table_info with a sql.ref table identifier`, async () => {
    const storage = await schemaAdminStorage(target);
    try {
      await migrateCms(storage.database);
      const db = seedSourceDatabase(storage.database) as Kysely<any>;
      let rows: Array<{ name: string }> = [];
      const failure = await sql<{ name: string }>`PRAGMA table_info(${sql.ref('_emdash_fields')})`.execute(db).then(result => { rows = result.rows; return null; }, error => error);
      expect(failure).toBeNull();
      expect(rows.map(row => row.name)).toContain('collection_id');
      expect(rows.length).toBeGreaterThan(10);
    } finally { await storage.close(); }
  }, 30000);

  it(`${target}: maps Source table-list patterns and leaves unrelated schemas intact`, async () => {
    const storage = await schemaAdminStorage(target);
    try {
      await migrateCms(storage.database);
      const db = seedSourceDatabase(storage.database) as Kysely<any>;
      const tables = await listTablesLike(db, '_emdash_%');
      expect(tables).toContain('_emdash_fields');
      expect(tables).toContain('_emdash_collections');
      expect(tables.every(table => table.startsWith('_emdash_'))).toBe(true);
      const external = db.selectFrom('external.options as external_options').select('external_options.value').compile();
      expect(external.sql).toBe('select "external_options"."value" from "external"."options" as "external_options"');
      const questions = sql<{ literal: string; question: string }>`SELECT ${'options?'} AS literal, '?' AS question /* options? remain comment bytes */`;
      expect(questions.compile(db).sql).toBe("SELECT ? AS literal, '?' AS question /* options? remain comment bytes */");
      expect((await questions.execute(db)).rows).toEqual([{ literal: 'options?', question: '?' }]);
    } finally { await storage.close(); }
  }, 30000);
}
