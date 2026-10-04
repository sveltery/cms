// SCIDXREV01 deterministic ordinary LOCAL SQL witness and regression.
// Original whole Source080 executes real Source001 physical storage/Registry
// content-table fixture. Supplemental callbacks, zero copied Source test credit.
// EmDash pin913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
import { expect, it } from 'vitest';
import { sql, type Kysely } from 'kysely';
import { openSqlite } from '../../../src/lib/server/database/sqlite.ts';
import { CMS_MIGRATIONS, migrateCms } from '../../../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../../../src/lib/server/database/registry.ts';
import * as source001 from '../index-trigger-source/packages/core/src/database/migrations/001_initial.ts';
import * as source080 from '../index-trigger-source/packages/core/src/database/migrations/080_content_translation_locale_unique.ts';

async function sourceStorage(database:ReturnType<typeof openSqlite>) {
  await source001.up(database.db as unknown as Kysely<unknown>);
  // Ordinary fixture reproduces the actual Source Registry:1868–1909 empty
  // content-table physical shape; this is SQL setup, not a registry substitute.
  await sql`CREATE TABLE ec_posts (
    id TEXT PRIMARY KEY,slug TEXT,status TEXT DEFAULT 'draft',author_id TEXT,primary_byline_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),updated_at TEXT DEFAULT (datetime('now')),
    published_at TEXT,scheduled_at TEXT,deleted_at TEXT,version INTEGER DEFAULT 1,
    live_revision_id TEXT REFERENCES revisions(id),draft_revision_id TEXT REFERENCES revisions(id),
    locale TEXT NOT NULL DEFAULT 'en',translation_group TEXT,
    CONSTRAINT ec_posts_slug_locale_unique UNIQUE(slug,locale)
  )`.execute(database.db);
  await sql`INSERT INTO taxonomies(id,name,slug,label) VALUES('term','tags','news','News')`.execute(database.db);
}
async function nativeStorage(database:ReturnType<typeof openSqlite>) {
  await sql`CREATE TABLE _cms_migrations (version INTEGER PRIMARY KEY CHECK(version > 0))`.execute(database.db);
  for (const provider of CMS_MIGRATIONS.filter(provider=>provider.version<=15)) {
    await database.atomicBatch([...await provider.statements(database),
      sql`INSERT INTO _cms_migrations(version) VALUES(${sql.lit(provider.version)})`.compile(database.db)]);
  }
  await new SchemaRegistry(database).createCollection({slug:'posts',label:'Posts'});
  await sql`INSERT INTO _cms_taxonomies(id,name,slug,label) VALUES('term','tags','news','News')`.execute(database.db);
}
async function seed(database:ReturnType<typeof openSqlite>,pivot:'content_taxonomies'|'_cms_content_taxonomies') {
  for (const [id,locale] of [['g','en'],['b','EN'],['c','en']]) {
    await sql`INSERT INTO ec_posts(id,slug,status,translation_group,locale,created_at)
      VALUES(${id},${id},'draft','g',${locale},'2000-01-01')`.execute(database.db);
  }
  await sql`INSERT INTO ${sql.ref(pivot)}(collection,entry_id,taxonomy_id) VALUES('posts','g','term')`.execute(database.db);
  await sql`CREATE TRIGGER operator_move_group AFTER UPDATE OF translation_group ON ec_posts WHEN NEW.id='b'
    BEGIN UPDATE ec_posts SET translation_group='b' WHERE id='c'; END`.execute(database.db);
}
async function assertRepaired(database:ReturnType<typeof openSqlite>,pivot:'content_taxonomies'|'_cms_content_taxonomies') {
  expect((await sql`SELECT id,translation_group FROM ec_posts ORDER BY id`.execute(database.db)).rows).toEqual([
    {id:'b',translation_group:'b'},{id:'c',translation_group:'c'},{id:'g',translation_group:'g'}
  ]);
  expect((await sql`SELECT collection,entry_id,taxonomy_id FROM ${sql.ref(pivot)} ORDER BY entry_id`.execute(database.db)).rows).toEqual([
    {collection:'posts',entry_id:'b',taxonomy_id:'term'},
    {collection:'posts',entry_id:'c',taxonomy_id:'term'},
    {collection:'posts',entry_id:'g',taxonomy_id:'term'}
  ]);
  expect((await sql<{name:string}>`SELECT name FROM sqlite_master WHERE type='trigger' AND name='operator_move_group'`.execute(database.db)).rows)
    .toEqual([{name:'operator_move_group'}]);
}

it('whole pinned Source080 rereads actual operator mutations and repairs the group', async()=>{
  const database=openSqlite(':memory:');
  try {
    await sourceStorage(database);await seed(database,'content_taxonomies');
    await expect(source080.up(database.db as unknown as Kysely<unknown>)).resolves.toBeUndefined();
    await assertRepaired(database,'content_taxonomies');
  } finally {await database.close();}
});

it('actual Native forward migration preserves admitted operator-trigger mutation semantics', async()=>{
  const database=openSqlite(':memory:');
  try {
    await nativeStorage(database);await seed(database,'_cms_content_taxonomies');
    await expect(migrateCms(database)).resolves.toBeUndefined();
    await assertRepaired(database,'_cms_content_taxonomies');
  } finally {await database.close();}
});
