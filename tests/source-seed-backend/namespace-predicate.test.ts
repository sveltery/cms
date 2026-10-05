import { expect, it } from 'vitest';
import { sql } from 'kysely';
import { seedSourceDatabase } from 'seed-namespace-subject';
import { schemaAdminStorage } from '../helpers/schema-admin-storage.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';

// Whole original Native Boolean-catalog cases; no Source/auth credit.
async function fixture(target: 'Node' | 'D1') {
  const storage = await schemaAdminStorage(target);
  try {
    await migrateCms(storage.database);
    await sql`CREATE INDEX _cms_media ON _cms_options(name)`.execute(storage.database.db);
    return storage;
  } catch (error) { await storage.close(); throw error; }
}

for (const target of ['Node', 'D1'] as const) {
  it(`${target}: preserves an index selected by a negated table predicate`, async () => {
    const storage = await fixture(target);
    try {
      const db = seedSourceDatabase(storage.database);
      const query = sql<{ name: string; tbl_name: string }>`SELECT name, tbl_name FROM sqlite_master WHERE NOT(type = 'table') AND tbl_name = ${'options'} AND name = ${'_cms_media'}`;
      const result = await query.execute(db);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toEqual({ name: '_cms_media', tbl_name: 'options' });
      expect(query.compile(db).parameters).toEqual(['_cms_options', '_cms_media']);
    } finally { await storage.close(); }
  }, 30000);

  it(`${target}: preserves an index selected by a negated conjunction`, async () => {
    const storage = await fixture(target);
    try {
      const db = seedSourceDatabase(storage.database);
      const query = sql<{ name: string; tbl_name: string }>`SELECT name, tbl_name FROM sqlite_master WHERE NOT(type = 'table' AND name = ${'_cms_options'}) AND tbl_name = ${'options'} AND name = ${'_cms_media'}`;
      const result = await query.execute(db);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toEqual({ name: '_cms_media', tbl_name: 'options' });
      expect(query.compile(db).parameters).toEqual(['_cms_options', '_cms_options', '_cms_media']);
    } finally { await storage.close(); }
  }, 30000);

  it(`${target}: preserves a positive table constraint with a NOT LIKE name guard`, async () => {
    const storage = await fixture(target);
    try {
      const db = seedSourceDatabase(storage.database);
      const query = sql<{ name: string; tbl_name: string }>`SELECT name, tbl_name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name = ${'options'}`;
      const result = await query.execute(db);
      expect(result.rows).toEqual([{ name: 'options', tbl_name: 'options' }]);
      expect(query.compile(db).parameters).toEqual(['_cms_options']);
    } finally { await storage.close(); }
  }, 30000);

  it(`${target}: preserves a positive table constraint under double negation`, async () => {
    const storage = await fixture(target);
    try {
      const db = seedSourceDatabase(storage.database);
      const query = sql<{ name: string; tbl_name: string }>`SELECT name, tbl_name FROM sqlite_master WHERE NOT(NOT(type = 'table')) AND name = ${'options'}`;
      const result = await query.execute(db);
      expect(result.rows).toEqual([{ name: 'options', tbl_name: 'options' }]);
      expect(query.compile(db).parameters).toEqual(['_cms_options']);
    } finally { await storage.close(); }
  }, 30000);
}
