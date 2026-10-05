import { expect, it } from 'vitest';
import { sql } from 'kysely';
import { seedSourceDatabase } from 'seed-namespace-subject';
import { schemaAdminStorage } from '../helpers/schema-admin-storage.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';

// Whole original Native cases. Real index/column names stay opaque even when
// they collide with a mapped physical table contract. No Source/auth credit.
// SQLite shares table/index object names, so the operator index uses the mapped
// _cms_media name whose physical provider table is absent from this Main8 fixture.
async function fixture(target: 'Node' | 'D1') {
  const storage = await schemaAdminStorage(target);
  try {
    await migrateCms(storage.database);
    await sql`CREATE INDEX _cms_media ON _cms_options(name)`.execute(storage.database.db);
    return storage;
  } catch (error) { await storage.close(); throw error; }
}

for (const target of ['Node', 'D1'] as const) {
  it(`${target}: preserves a physical-name-collision index and its object SQL`, async () => {
    const storage = await fixture(target);
    try {
      const db = seedSourceDatabase(storage.database);
      const query = sql<{ type: string; name: string; tbl_name: string; sql: string }>`SELECT type, name, tbl_name, sql FROM sqlite_master WHERE type = 'index' AND tbl_name = ${'options'} AND name = ${'_cms_media'}`;
      const result = await query.execute(db);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].name).toBe('_cms_media');
      expect(result.rows[0].type).toBe('index');
      expect(result.rows[0].tbl_name).toBe('options');
      expect(result.rows[0].sql).toMatch(/CREATE INDEX _cms_media ON options\(name\)/i);
      expect(query.compile(db).parameters).toEqual(['_cms_options', '_cms_media']);
    } finally { await storage.close(); }
  }, 30000);

  it(`${target}: preserves a physical-name-collision PRAGMA column`, async () => {
    const storage = await fixture(target);
    try {
      await sql`ALTER TABLE _cms_options ADD COLUMN _cms_options TEXT`.execute(storage.database.db);
      const db = seedSourceDatabase(storage.database);
      const query = sql<{ name: string; type: string }>`PRAGMA table_info(${sql.ref('options')})`;
      let rows: Array<{ name: string; type: string }> = [];
      const failure = await query.execute(db).then(result => { rows = result.rows; return null; }, error => error);
      expect(failure).toBeNull();
      expect(rows.map(row => row.name)).toContain('_cms_options');
      expect(rows.map(row => row.name)).not.toContain('options');
      expect(rows.find(row => row.name === '_cms_options')?.type).toBe('TEXT');
      expect(query.compile(db).sql).toBe('PRAGMA table_info("_cms_options")');
    } finally { await storage.close(); }
  }, 30000);

  it(`${target}: preserves a physical-name-collision PRAGMA index`, async () => {
    const storage = await fixture(target);
    try {
      const db = seedSourceDatabase(storage.database);
      const query = sql<{ name: string }>`PRAGMA index_list(${sql.ref('options')})`;
      let rows: Array<{ name: string }> = [];
      const failure = await query.execute(db).then(result => { rows = result.rows; return null; }, error => error);
      expect(failure).toBeNull();
      expect(rows.map(row => row.name)).toContain('_cms_media');
      expect(rows.map(row => row.name)).not.toContain('media');
      expect(query.compile(db).sql).toBe('PRAGMA index_list("_cms_options")');
    } finally { await storage.close(); }
  }, 30000);

  it(`${target}: distinguishes table and index names in mixed object results`, async () => {
    const storage = await fixture(target);
    try {
      const db = seedSourceDatabase(storage.database);
      const query = sql<{ type: string; name: string; tbl_name: string; sql: string | null }>`SELECT type, name, tbl_name, sql FROM sqlite_master WHERE tbl_name = ${'options'} AND type IN ('table', 'index')`;
      const result = await query.execute(db);
      const index = result.rows.find(row => row.type === 'index' && row.sql !== null);
      expect(index?.name).toBe('_cms_media');
      expect(index?.tbl_name).toBe('options');
      const table = result.rows.find(row => row.type === 'table');
      expect(table?.name).toBe('options');
      expect(table?.tbl_name).toBe('options');
      expect(table?.sql).toMatch(/CREATE TABLE ["`\[]?options/i);
      expect(query.compile(db).parameters).toEqual(['_cms_options']);
    } finally { await storage.close(); }
  }, 30000);

  it(`${target}: preserves opaque object names without selecting type`, async () => {
    const storage = await fixture(target);
    try {
      const db = seedSourceDatabase(storage.database);
      const query = sql<{ name: string; tbl_name: string; hint: string }>`SELECT name, tbl_name, 'type=''table''' AS hint FROM sqlite_master WHERE type = 'index' AND tbl_name = ${'options'} AND name = ${'_cms_media'} /* type = 'table' is only a comment */`;
      const result = await query.execute(db);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].name).toBe('_cms_media');
      expect(result.rows[0].tbl_name).toBe('options');
      expect(result.rows[0].hint).toBe("type='table'");
      expect(query.compile(db).sql).toContain("/* type = 'table' is only a comment */");
    } finally { await storage.close(); }
  }, 30000);

  it(`${target}: ignores a SELECT comparison when identifying table-only rows`, async () => {
    const storage = await fixture(target);
    try {
      const db = seedSourceDatabase(storage.database);
      const query = sql<{ name: string; tbl_name: string; table_hint: number }>`SELECT name, tbl_name, type = 'table' AS table_hint FROM sqlite_master WHERE type = 'index' AND tbl_name = ${'options'} AND name = ${'_cms_media'}`;
      const result = await query.execute(db);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].name).toBe('_cms_media');
      expect(result.rows[0].tbl_name).toBe('options');
      expect(result.rows[0].table_hint).toBe(0);
      expect(query.compile(db).parameters).toEqual(['_cms_options', '_cms_media']);
    } finally { await storage.close(); }
  }, 30000);
}
