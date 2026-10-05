// Supplementary actual SQLite contracts from EmDash1.1.0 SchemaRegistry:1914-2006,
// Source055/080 and taxonomy-term-counts-plan; pin913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// These three callbacks are Native requirements, not copied Source-family credit.
import { afterEach, beforeEach, expect, it } from 'vitest';
import { sql } from 'kysely';
import { openSqlite } from '../../../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../../../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../../../src/lib/server/database/registry.ts';
let database: ReturnType<typeof openSqlite>;
beforeEach(async () => {
  database = openSqlite(':memory:');
  await migrateCms(database);
  await new SchemaRegistry(database).createCollection({ slug: 'posts', label: 'Posts' });
});
afterEach(async () => { await database?.close(); });

it('creates all sixteen Source standard collection indexes in the real catalogue', async () => {
  const expected = ['idx_ec_posts_slug', 'idx_ec_posts_del_sched', 'idx_ec_posts_live_revision',
    'idx_ec_posts_draft_revision', 'idx_ec_posts_author', 'idx_ec_posts_primary_byline',
    'idx_ec_posts_locale', 'idx_ec_posts_tg_locale', 'idx_ec_posts_del_tg_locale',
    'uidx_ec_posts_active_tg_locale', 'idx_ec_posts_deleted_updated_id', 'idx_ec_posts_deleted_status',
    'idx_ec_posts_deleted_created_id', 'idx_ec_posts_deleted_published_id',
    'idx_ec_posts_loc_upd', 'idx_ec_posts_loc_crt'];
  const actual = (await sql<{ name: string }>`SELECT name FROM sqlite_master
    WHERE type = 'index' AND tbl_name = 'ec_posts'`.execute(database.db)).rows.map(row => row.name);
  expect(expected.map(name => actual.includes(name))).toEqual(expected.map(() => true));
});

it('enforces one active translation group per case-folded locale while retaining null and trash rows', async () => {
  for (const [id, group, locale, deleted] of [
    ['anchor', 'group-a', 'en', null], ['ungrouped-one', null, 'en', null],
    ['ungrouped-two', null, 'en', null], ['trashed', 'group-a', 'EN', '2025-01-01']
  ]) await sql`INSERT INTO ec_posts(id,slug,status,translation_group,locale,deleted_at)
    VALUES(${id},${id},'draft',${group},${locale},${deleted})`.execute(database.db);
  await expect(sql`INSERT INTO ec_posts(id,slug,status,translation_group,locale)
    VALUES('duplicate','duplicate','draft','group-a','EN')`.execute(database.db)).rejects.toThrow();
  expect((await sql<{ count: number }>`SELECT count(*) AS count FROM ec_posts`.execute(database.db)).rows[0].count)
    .toBe(4);
});

it('seeks active group and locale through the Source covering lookup without ANALYZE', async () => {
  await sql`INSERT INTO ec_posts(id,slug,status,translation_group,locale)
    VALUES('one','one','draft','group-a','en')`.execute(database.db);
  const plan = (await sql<{ detail: string }>`EXPLAIN QUERY PLAN SELECT e.id FROM ec_posts e
    WHERE e.deleted_at IS NULL AND e.translation_group = 'group-a' AND e.locale = 'en'`
    .execute(database.db)).rows.map(row => row.detail).join('\n');
  expect(plan).toMatch(/SEARCH e USING (?:COVERING )?INDEX idx_ec_posts_del_tg_locale \(deleted_at=\? AND translation_group=\? AND locale=\?\)/);
  expect(plan).not.toMatch(/\bSCAN e\b/);
});
