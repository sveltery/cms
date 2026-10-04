import { afterEach, expect, it } from 'vitest';
import { Kysely, sql, SqliteDialect } from 'kysely';
import { fixtureStorage } from '../helpers/taxonomies/storage.ts';
import { runMigrations, getExactMigrationStatus } from '../helpers/taxonomies/migrations.ts';
import { openNodeSqliteDatabase } from '../../src/lib/server/database/node-sqlite-compat.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';

let db: Kysely<any> | undefined;
afterEach(async () => {await db?.destroy();db=undefined;});
function actualDatabase() {
  return new Kysely<any>({dialect:new SqliteDialect({database:openNodeSqliteDatabase(':memory:')})});
}
it('installs whole pinned Source90 migrations with real original taxonomy indexes and metadata',async () => {
  db=actualDatabase();
  await runMigrations(db);
  const source=await getExactMigrationStatus(db);
  expect(source.knownApplied).toHaveLength(90);
  expect(source.pending).toEqual([]);
  expect(source.unknownApplied).toEqual([]);
  const catalogue=(await sql<{name:string}>`SELECT name FROM sqlite_master WHERE type='index' AND name IN ('idx_taxonomies_name_locale','idx_content_taxonomies_term','idx_content_taxonomies_group_lookup') ORDER BY name`.execute(db)).rows;
  expect(catalogue.map(row=>row.name)).toEqual(['idx_content_taxonomies_group_lookup','idx_content_taxonomies_term','idx_taxonomies_name_locale']);
  const names=(await db.introspection.getTables()).map(table=>table.name);
  expect(names).toContain('_emdash_collections');
  expect(names).not.toContain('_cms_collections');
});
it('keeps genuine Native ownership refusal for colliding Source indexes without changing Source catalogue or adding Native markers',async () => {
  db=actualDatabase();
  await runMigrations(db);
  const before=(await sql`SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY type,name`.execute(db)).rows;
  await expect(migrateCms(fixtureStorage(db))).rejects.toMatchObject({code:'MIGRATION_REQUIRED'});
  const after=(await sql`SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY type,name`.execute(db)).rows;
  expect(after).toEqual(before);
  expect(after.map(row=>row.name)).not.toContain('_cms_migrations');
});
it('returns real mutation results and rolls back all Source-table changes on a later failure',async () => {
  db=actualDatabase();
  await runMigrations(db);
  const owner=fixtureStorage(db);
  const first=await owner.atomicBatch([sql`INSERT INTO taxonomies(id,name,slug,label,locale,translation_group,sort_order) VALUES('term','tag','one','Original','en','term',0)`.compile(db)]);
  expect(first[0].numAffectedRows).toBe(1n);
  await expect(owner.atomicBatch([
    sql`UPDATE taxonomies SET label='Changed' WHERE id='term'`.compile(db),
    sql`INSERT INTO taxonomies(id,name,slug,label,locale,translation_group,sort_order) VALUES('term','tag','duplicate','Duplicate','en','term',0)`.compile(db)
  ])).rejects.toThrow();
  const actual=(await sql<{id:string;label:string}>`SELECT id,label FROM taxonomies`.execute(db)).rows;
  expect(actual).toEqual([{id:'term',label:'Original'}]);
});
