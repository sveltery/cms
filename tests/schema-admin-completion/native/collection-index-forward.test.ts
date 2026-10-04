// Supplementary real forward-storage contracts from whole Source055/074/080.
// EmDash1.1.0 pin913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// No original Source callback, D1, HTTP/auth or concurrency credit.
import { afterEach, beforeEach, expect, it } from 'vitest';
import { sql } from 'kysely';
import { openSqlite } from '../../../src/lib/server/database/sqlite.ts';
import { CMS_MIGRATIONS, migrateCms } from '../../../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../../../src/lib/server/database/registry.ts';

let database: ReturnType<typeof openSqlite>;
beforeEach(async () => {
  database = openSqlite(':memory:');
  await sql`CREATE TABLE _cms_migrations (version INTEGER PRIMARY KEY CHECK(version > 0))`.execute(database.db);
  // Actual unchanged published providers create a genuine historical store.
  for (const provider of CMS_MIGRATIONS.filter(provider => provider.version <= 15)) {
    await database.atomicBatch([...await provider.statements(database),
      sql`INSERT INTO _cms_migrations(version) VALUES (${sql.lit(provider.version)})`.compile(database.db)]);
  }
  await new SchemaRegistry(database).createCollection({ slug: 'posts', label: 'Posts' });
});
afterEach(async () => { await database?.close(); });

async function contentRows() {
  return (await sql`SELECT * FROM ec_posts ORDER BY id`.execute(database.db)).rows;
}
async function assignments() {
  return (await sql`SELECT collection,entry_id,taxonomy_id FROM _cms_content_taxonomies
    ORDER BY collection,entry_id,taxonomy_id`.execute(database.db)).rows;
}

it('splits duplicates with Source anchor/order rules and preserves canonical term links across retry', async () => {
  for (const [id,group,locale,created,deleted] of [
    ['group-a','group-a','en','2099-01-01',null], ['older','group-a','EN','2000-01-01',null],
    ['earlier','group-b','en','2000-01-01',null], ['later','group-b','EN','2099-01-01',null],
    ['collision','collision','en','2000-01-01',null], ['chain','collision','EN','2099-01-01',null],
    ['chain-other','chain','en','2000-01-01',null],
    ['null-one',null,'en','2000-01-01',null], ['null-two',null,'en','2000-01-01',null],
    ['trash','group-a','EN','2000-01-01','2025-01-01']
  ]) await sql`INSERT INTO ec_posts(id,slug,status,translation_group,locale,created_at,deleted_at)
    VALUES(${id},${id},'draft',${group},${locale},${created},${deleted})`.execute(database.db);
  for (const [group,term] of [['group-a','term-a'],['group-b','term-b'],['collision','term-c'],['chain','term-d']]) {
    await sql`INSERT INTO _cms_content_taxonomies(collection,entry_id,taxonomy_id)
      VALUES('posts',${group},${term})`.execute(database.db);
  }
  const before = await contentRows();
  await migrateCms(database);
  const after = await contentRows();
  expect(after.map(row => [row.id,row.translation_group])).toEqual([
    ['chain','chain'],['chain-other','chain-other'],['collision','collision'],['earlier','group-b'],
    ['group-a','group-a'],['later','later'],['null-one',null],['null-two',null],['older','older'],['trash','group-a']
  ]);
  expect(after.map(({translation_group,...row}) => row)).toEqual(before.map(({translation_group,...row}) => row));
  expect(await assignments()).toEqual([
    {collection:'posts',entry_id:'chain',taxonomy_id:'term-c'},
    {collection:'posts',entry_id:'chain',taxonomy_id:'term-d'},
    {collection:'posts',entry_id:'chain-other',taxonomy_id:'term-c'},
    {collection:'posts',entry_id:'chain-other',taxonomy_id:'term-d'},
    {collection:'posts',entry_id:'collision',taxonomy_id:'term-c'},
    {collection:'posts',entry_id:'group-a',taxonomy_id:'term-a'},
    {collection:'posts',entry_id:'group-b',taxonomy_id:'term-b'},
    {collection:'posts',entry_id:'later',taxonomy_id:'term-b'},
    {collection:'posts',entry_id:'older',taxonomy_id:'term-a'}
  ]);
  const terms = await assignments();
  await migrateCms(database);
  expect(await contentRows()).toEqual(after);
  expect(await assignments()).toEqual(terms);
  await expect(sql`INSERT INTO ec_posts(id,slug,status,translation_group,locale)
    VALUES('duplicate','duplicate','draft','group-a','EN')`.execute(database.db)).rejects.toThrow();
});

it('replaces legacy translation/scheduling indexes while retaining real scheduled content', async () => {
  await sql`CREATE INDEX idx_ec_posts_translation_group ON ec_posts(translation_group)`.execute(database.db);
  await sql`CREATE INDEX idx_ec_posts_scheduled ON ec_posts(scheduled_at) WHERE scheduled_at IS NOT NULL`.execute(database.db);
  await sql`INSERT INTO ec_posts(id,slug,status,scheduled_at) VALUES('scheduled','scheduled','draft','2099-01-01')`.execute(database.db);
  const before = await contentRows();
  await migrateCms(database);
  const names = (await sql<{name:string}>`SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='ec_posts'`.execute(database.db)).rows.map(row => row.name);
  expect(['idx_ec_posts_tg_locale','idx_ec_posts_del_tg_locale','idx_ec_posts_del_sched','uidx_ec_posts_active_tg_locale'].map(name => names.includes(name))).toEqual([true,true,true,true]);
  expect(names.filter(name => ['idx_ec_posts_translation_group','idx_ec_posts_scheduled'].includes(name))).toEqual([]);
  expect(await contentRows()).toEqual(before);
});

it('refuses an incompatible future-owned index without changing stored content or markers', async () => {
  await sql`CREATE INDEX idx_ec_posts_del_tg_locale ON ec_posts(locale)`.execute(database.db);
  await sql`INSERT INTO ec_posts(id,slug,status,translation_group,locale) VALUES('stored','stored','draft','group','en')`.execute(database.db);
  const before = { content:await contentRows(), markers:(await sql`SELECT version FROM _cms_migrations ORDER BY version`.execute(database.db)).rows,
    catalogue:(await sql`SELECT name,type,sql FROM sqlite_master ORDER BY name,type`.execute(database.db)).rows };
  await expect(migrateCms(database)).rejects.toMatchObject({code:'MIGRATION_REQUIRED'});
  expect({ content:await contentRows(), markers:(await sql`SELECT version FROM _cms_migrations ORDER BY version`.execute(database.db)).rows,
    catalogue:(await sql`SELECT name,type,sql FROM sqlite_master ORDER BY name,type`.execute(database.db)).rows }).toEqual(before);
});
