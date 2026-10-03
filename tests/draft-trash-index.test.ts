// Supplemental query-plan/index maintenance evidence; zero upstream assertion credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import { collectionUpdateStorage } from './helpers/collection-update-fixture.ts';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../src/lib/server/database/registry.ts';
import { DraftRepository } from '../src/lib/server/database/entries.ts';
import type { CmsDatabase } from '../src/lib/server/database/contract.ts';
const objects = async (database: CmsDatabase) => (await sql`SELECT name, sql FROM sqlite_master WHERE name != '_cf_METADATA' ORDER BY name`.execute(database.db)).rows;
const explain = async (database: CmsDatabase) => (await sql<{ detail: string }>`EXPLAIN QUERY PLAN SELECT id, locale, substr(title, 1, 200) AS title
  FROM ec_posts WHERE deleted_at IS NOT NULL AND status = 'draft' ORDER BY deleted_at DESC, id DESC LIMIT 50`.execute(database.db)).rows.map(row => row.detail).join('\n');
async function fixture(target: 'Node' | 'D1') {
  const storage = await collectionUpdateStorage(target); await migrateCms(storage.database);
  const registry = new SchemaRegistry(storage.database);
  await registry.createCollection({ slug: 'posts', label: 'Posts' });
  await registry.createField('posts', { slug: 'title', label: 'Title', type: 'string', unique: true, defaultValue: 'Default' });
  const entries = new DraftRepository(storage.database);
  const row = await entries.create({ type: 'posts', locale: 'fr', data: { title: 'Retained' } }, 'owner');
  await entries.delete({ type: 'posts', id: row.id, locale: 'fr', expected: { version: row.version, updatedAt: row.updatedAt } });
  return { ...storage, registry, entries, row };
}
for (const target of ['Node', 'D1'] as const) {
  test(`${target}: all-locale trash order uses the pinned deleted-leading index while retaining upstream tie sorting`, { timeout: 30000 }, async () => {
    const f = await fixture(target);
    try {
      const plan = await explain(f.database);
      assert.match(plan, /USING INDEX idx_ec_posts_deleted_status/); assert.match(plan, /TEMP B-TREE FOR (?:LAST|RIGHT) (?:TERM|PART) OF ORDER BY/);
    } finally { await f.close(); }
  });
  test(`${target}: explicit migration adds missing trash indexes idempotently without changing retained data or schema metadata`, { timeout: 30000 }, async () => {
    const f = await fixture(target);
    try {
      await sql`DROP INDEX IF EXISTS idx_ec_posts_deleted_status`.execute(f.database.db);
      const rows = (await sql`SELECT * FROM ec_posts`.execute(f.database.db)).rows;
      const schema = await f.registry.getCollectionWithFields('posts');
      const markers = await f.database.db.selectFrom('_cms_migrations').selectAll().execute();
      assert.match(await explain(f.database), /TEMP B-TREE/);
      await migrateCms(f.database);
      const plan = await explain(f.database); assert.match(plan, /idx_ec_posts_deleted_status/); assert.match(plan, /TEMP B-TREE FOR (?:LAST|RIGHT) (?:TERM|PART) OF ORDER BY/);
      assert.deepEqual((await sql`SELECT * FROM ec_posts`.execute(f.database.db)).rows, rows);
      assert.deepEqual(await f.registry.getCollectionWithFields('posts'), schema);
      assert.deepEqual(await f.database.db.selectFrom('_cms_migrations').selectAll().execute(), markers);
      const indexed = await objects(f.database); await migrateCms(f.database); assert.deepEqual(await objects(f.database), indexed);
    } finally { await f.close(); }
  });
  test(`${target}: index batch failure rolls back every newly added index and leaves marker/data unchanged`, { timeout: 30000 }, async () => {
    const f = await fixture(target);
    try {
      await f.registry.createCollection({ slug: 'other', label: 'Other' });
      await sql`DROP INDEX IF EXISTS idx_ec_posts_deleted_status`.execute(f.database.db);
      await sql`DROP INDEX IF EXISTS idx_ec_other_deleted_status`.execute(f.database.db);
      const before = await objects(f.database);
      const rows = (await sql`SELECT * FROM ec_posts`.execute(f.database.db)).rows;
      const failing: CmsDatabase = { ...f.database, async atomicBatch(statements) {
        assert.ok(statements.some(statement => statement.sql.includes('idx_ec_other_deleted_status')));
        return f.database.atomicBatch([...statements, sql`SELECT * FROM nonexistent_trash_index_table`.compile(f.database.db)]);
      } };
      await assert.rejects(() => migrateCms(failing), /nonexistent_trash_index_table/);
      assert.deepEqual(await objects(f.database), before);
      assert.deepEqual((await sql`SELECT * FROM ec_posts`.execute(f.database.db)).rows, rows);
      await migrateCms(f.database); assert.match(await explain(f.database), /idx_ec_posts_deleted_status/);
    } finally { await f.close(); }
  });
}
