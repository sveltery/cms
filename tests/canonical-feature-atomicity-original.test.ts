// Whole Original ordinary database installation requirements; zero Source credit.
// Real adapters, fixed content author, no authentication or concurrency probes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sql, type CompiledQuery } from 'kysely';
import type { CmsDatabase } from '../src/lib/server/database/contract.ts';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../src/lib/server/database/registry.ts';
import { DraftRepository } from '../src/lib/server/database/entries.ts';
import { historicalFeatureStorage } from './helpers/canonical-feature-storage-original.ts';
import { databaseSnapshot } from './helpers/lifecycle-startup.ts';

const markers15 = Array.from({ length: 15 }, (_, index) => index + 1);
async function markers(database: CmsDatabase) {
  return (await sql<{ version: number }>`SELECT version FROM _cms_migrations ORDER BY version`
    .execute(database.db)).rows.map(row => row.version);
}
async function operatorObjects(database: CmsDatabase) {
  return (await sql`SELECT name,type,tbl_name,sql FROM sqlite_master WHERE name LIKE 'operator_%' ORDER BY name,type`
    .execute(database.db)).rows;
}

for (const mode of ['Node', 'raw D1', 'scoped D1'] as const) {
  test(`${mode}: genuine v5 upgrade and persisted v15 reopen preserve content and operator objects`, { timeout: 90_000 }, async () => {
    const fixture = await historicalFeatureStorage(mode);
    try {
      const registry = new SchemaRegistry(fixture.database);
      await registry.createCollection({ slug: 'posts', label: 'Posts' });
      await registry.createField('posts', { slug: 'title', label: 'Title', type: 'string' });
      const post = await new DraftRepository(fixture.database).create({ type: 'posts', data: { title: 'Retained content' } },
        'ordinary-storage-author');
      await sql`CREATE TABLE operator_notes (note TEXT NOT NULL)`.execute(fixture.database.db);
      await sql`CREATE INDEX operator_note_index ON operator_notes(note)`.execute(fixture.database.db);
      await sql`CREATE TRIGGER operator_note_insert AFTER INSERT ON operator_notes
        BEGIN UPDATE operator_notes SET note='operator-'||NEW.note WHERE rowid=NEW.rowid; END`.execute(fixture.database.db);
      await sql`INSERT INTO operator_notes VALUES ('retained')`.execute(fixture.database.db);
      const beforeObjects = await operatorObjects(fixture.database);
      const beforeContent = (await sql`SELECT * FROM ec_posts WHERE id=${post.id}`.execute(fixture.database.db)).rows;
      await migrateCms(fixture.database);
      assert.deepEqual(await markers(fixture.database), markers15);
      assert.deepEqual(await operatorObjects(fixture.database), beforeObjects);
      assert.deepEqual((await sql`SELECT * FROM ec_posts WHERE id=${post.id}`.execute(fixture.database.db)).rows, beforeContent);
      assert.deepEqual((await sql<{ note: string }>`SELECT note FROM operator_notes`.execute(fixture.database.db)).rows.map(row=>({...row})), [{ note: 'operator-retained' }]);
      await fixture.reopen(); await migrateCms(fixture.database);
      assert.deepEqual(await markers(fixture.database), markers15);
      assert.deepEqual(await operatorObjects(fixture.database), beforeObjects);
      assert.deepEqual((await sql`SELECT * FROM ec_posts WHERE id=${post.id}`.execute(fixture.database.db)).rows, beforeContent);
      await sql`INSERT INTO operator_notes VALUES ('reopened')`.execute(fixture.database.db);
      assert.deepEqual((await sql<{ note: string }>`SELECT note FROM operator_notes ORDER BY rowid`.execute(fixture.database.db)).rows.map(row=>({...row})),
        [{ note: 'operator-retained' }, { note: 'operator-reopened' }]);
    } finally { await fixture.close(); }
  });

  test(`${mode}: a future Source-named trigger collision is refused before any startup write`, { timeout: 90_000 }, async () => {
    const fixture = await historicalFeatureStorage(mode);
    try {
      await sql`CREATE TABLE operator_notes (note TEXT NOT NULL)`.execute(fixture.database.db);
      await sql`CREATE TRIGGER emdash_media_usage_fence_source_generation_insert AFTER INSERT ON operator_notes
        BEGIN UPDATE operator_notes SET note='retained-'||NEW.note WHERE rowid=NEW.rowid; END`.execute(fixture.database.db);
      await sql`INSERT INTO operator_notes VALUES ('operator-data')`.execute(fixture.database.db);
      const before = await databaseSnapshot(fixture.database);
      let batches = 0;
      const subject: CmsDatabase = { ...fixture.database, async atomicBatch(statements) {
        batches++; return fixture.database.atomicBatch(statements);
      } };
      await assert.rejects(() => migrateCms(subject), { code: 'MIGRATION_REQUIRED' });
      assert.equal(batches, 0);
      assert.deepEqual(await databaseSnapshot(fixture.database), before);
      await fixture.reopen();
      await assert.rejects(() => migrateCms(fixture.database), { code: 'MIGRATION_REQUIRED' });
      assert.deepEqual(await databaseSnapshot(fixture.database), before);
    } finally { await fixture.close(); }
  });

  for (const historicalVersion of [0, 4] as const) {
    test(`${mode}: a real late-batch SQLite failure rolls back the complete v${historicalVersion}→15 installation`, { timeout: 90_000 }, async () => {
      const fixture = await historicalFeatureStorage(mode, historicalVersion);
      try {
        await sql`CREATE TABLE operator_notes (note TEXT NOT NULL)`.execute(fixture.database.db);
        await sql`INSERT INTO operator_notes VALUES ('outside-CMS')`.execute(fixture.database.db);
        const before = await databaseSnapshot(fixture.database);
        let planned: readonly CompiledQuery[] = [];
        const subject: CmsDatabase = { ...fixture.database, async atomicBatch(statements) {
          planned = statements;
          // All actual planned providers execute on the real adapter first.
          // The final invalid JSON path then forces SQLite to roll them back.
          return fixture.database.atomicBatch([...statements,
            sql`SELECT json_extract('[]', 'canonical-feature-late-batch-failure')`.compile(fixture.database.db)]);
        } };
        await assert.rejects(() => migrateCms(subject), /(?:JSON path|json path)/i);
        assert.deepEqual(await databaseSnapshot(fixture.database), before);
        assert.ok(planned.some(statement => /^INSERT INTO _cms_migrations \(version\) VALUES \(14\)$/.test(statement.sql)),
          'the rolled-back real batch must contain genuine provider14, not only historical providers');
        assert.ok(planned.some(statement => /^INSERT INTO _cms_migrations \(version\) VALUES \(15\)$/.test(statement.sql)),
          'the same rolled-back batch must also contain the genuine appended provider15');
        await fixture.reopen();
        assert.deepEqual(await databaseSnapshot(fixture.database), before);
        await migrateCms(fixture.database);
        assert.deepEqual(await markers(fixture.database), markers15);
        assert.deepEqual((await sql<{ note: string }>`SELECT note FROM operator_notes`.execute(fixture.database.db)).rows.map(row=>({...row})), [{ note: 'outside-CMS' }]);
      } finally { await fixture.close(); }
    });
  }
}
