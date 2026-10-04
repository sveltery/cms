// Original supplemental migration requirements; zero EmDash declaration credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sql } from 'kysely';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../src/lib/server/database/registry.ts';
import { DraftRepository } from '../src/lib/server/database/entries.ts';
import { schemaAdminStorage } from './helpers/schema-admin-storage.ts';
import { installVersion4, installHistoricalVersion, legacyPost, legacyContentSql, databaseSnapshot } from './helpers/lifecycle-startup.ts';

for (const target of ['Node','D1'] as const) {
  test(`${target}: fresh canonical startup creates all lifecycle system columns and atomically stores revision pointers`, async () => {
    const storage=await schemaAdminStorage(target);
    try {
      const database=storage.database; await migrateCms(database);
      await new SchemaRegistry(database).createCollection({slug:'post',label:'Posts'});
      const columns=(await sql<{name:string;type:string;notnull:number;dflt_value:string|null}>`SELECT * FROM pragma_table_info('ec_post')`.execute(database.db)).rows;
      assert.deepEqual(columns.map(row=>row.name),['id','slug','status','author_id','primary_byline_id','created_at','updated_at','published_at','scheduled_at','deleted_at','version','live_revision_id','draft_revision_id','locale','translation_group']);
      const byline=columns.find(row=>row.name==='primary_byline_id')!;
      assert.deepEqual({type:byline.type,notnull:byline.notnull,dflt_value:byline.dflt_value},{type:'TEXT',notnull:0,dflt_value:null});
      const row=await new DraftRepository(database).create({type:'post',slug:'fresh',data:{}},'owner');
      const before=await new DraftRepository(database).findById('post',row.id);
      await database.atomicBatch([
        sql`INSERT INTO _cms_revisions (id,collection,entry_id,data) VALUES ('live','post',${row.id},'{}'),('draft','post',${row.id},'{}')`.compile(database.db),
        sql`UPDATE ec_post SET status='published',published_at='2026-10-02T12:00:00.000Z',live_revision_id='live',draft_revision_id='draft' WHERE id=${row.id}`.compile(database.db)
      ]);
      const stored=(await sql<{live_revision_id:string;draft_revision_id:string;version:number;updated_at:string}>`SELECT live_revision_id,draft_revision_id,version,updated_at FROM ec_post WHERE id=${row.id}`.execute(database.db)).rows[0];
      assert.deepEqual({...stored},{live_revision_id:'live',draft_revision_id:'draft',version:before!.version,updated_at:before!.updatedAt});
      await migrateCms(database);
      assert.equal((await sql`SELECT * FROM _cms_revisions ORDER BY id`.execute(database.db)).rows.length,2);
    } finally {await storage.close();}
  });

  test(`${target}: immutable v1/v2 layouts reach canonical v8 after frozen v5 with legacy data, metadata and foreign keys intact`, async () => {
    for (const version of [1,2] as const) {
      const storage=await schemaAdminStorage(target);
      try {
        const database=storage.database; await installHistoricalVersion(database,version); const registry=await legacyPost(database);
        const entry=await new DraftRepository(database).create({type:'post',data:{title:'Legacy'}},'owner');
        if (version===2) await sql`INSERT INTO _cms_auth_users VALUES ('owner',30,0)`.execute(database.db);
        const definition=await registry.getCollectionWithFields('post');
        await migrateCms(database); await migrateCms(database);
        assert.deepEqual(await registry.getCollectionWithFields('post'),definition);
        assert.deepEqual(await new DraftRepository(database).findById('post',entry.id),entry);
        const markers=(await sql<{version:number}>`SELECT version FROM _cms_migrations ORDER BY version`.execute(database.db)).rows.map(row=>row.version);
        assert.deepEqual(markers.slice(0,5),[1,2,3,4,5]);
        assert.deepEqual(markers,[1,2,3,4,5,6,7,8]);
        assert.equal((await sql`SELECT * FROM _cms_auth_profiles`.execute(database.db)).rows.length,0);
        assert.equal((await sql`SELECT * FROM pragma_foreign_key_check`.execute(database.db)).rows.length,0);
        await sql`UPDATE ec_post SET status='published', primary_byline_id='byline_1' WHERE id=${entry.id}`.execute(database.db);
      } finally {await storage.close();}
    }
  });

  test(`${target}: v4 upgrade preserves rows, tokens, physical defaults, indexes, triggers and auth metadata on reopen`, async () => {
    const directory = await mkdtemp(join(tmpdir(),'cms-lifecycle-upgrade-'));
    let storage = await schemaAdminStorage(target,directory);
    try {
      const database = storage.database;
      await installVersion4(database); const registry = await legacyPost(database);
      await registry.createField('post',{slug:'legacy',label:'Legacy',type:'string',defaultValue:'Physical original'});
      // Historical optional physical defaults/unique indexes are preserved rather
      // than reconciled with current metadata (SF-02 / inherited issue #20).
      await sql`ALTER TABLE ec_post DROP COLUMN legacy`.execute(database.db);
      await sql`ALTER TABLE ec_post ADD COLUMN legacy TEXT DEFAULT 'Physical original'`.execute(database.db);
      await sql`UPDATE _cms_fields SET default_value=${JSON.stringify('Metadata changed')} WHERE slug='legacy'`.execute(database.db);
      await sql`CREATE UNIQUE INDEX old_optional_unique ON ec_post (legacy)`.execute(database.db);
      await sql`CREATE TABLE operator_events (entry_id TEXT)`.execute(database.db);
      await sql`CREATE TRIGGER old_content_trigger AFTER INSERT ON ec_post BEGIN INSERT INTO operator_events VALUES (new.id); END`.execute(database.db);
      await sql`INSERT INTO _cms_auth_users VALUES ('owner',30,0)`.execute(database.db);
      const entry = await new DraftRepository(database).create({type:'post',slug:'retained',data:{title:'Retained'}},'owner');
      await sql`UPDATE ec_post SET version=7, updated_at='2026-10-01T09:00:00.000Z', live_revision_id='retained-live', draft_revision_id='retained-draft' WHERE id=${entry.id}`.execute(database.db);
      const before = await databaseSnapshot(database);
      const definition = await registry.getCollectionWithFields('post');
      await migrateCms(database); await migrateCms(database);
      const after = await databaseSnapshot(database);
      const retained = before.tables.filter(row=>row.name !== '_cms_migrations');
      for (const table of retained) {
        const actual = after.tables.find(row=>row.name===table.name)!;
        if (table.name === '_cms_collections') for (const row of actual.rows as Record<string,unknown>[]) {
          assert.equal(row.search_config,null); delete row.search_config;
        }
        if (table.name === 'ec_post') for (const row of actual.rows as Record<string,unknown>[]) {
          assert.equal(row.primary_byline_id,null); delete row.primary_byline_id;
        }
        assert.deepEqual(actual,table,table.name);
      }
      for (const object of before.objects.filter(row=>row.type==='index'||row.type==='trigger')) assert.deepEqual(after.objects.find(row=>row.name===object.name),object);
      assert.deepEqual(await registry.getCollectionWithFields('post'),definition);
      const markers=(await sql<{version:number}>`SELECT version FROM _cms_migrations ORDER BY version`.execute(database.db)).rows.map(row=>row.version);
      assert.deepEqual(markers.slice(0,5),[1,2,3,4,5]);
      assert.deepEqual(markers,[1,2,3,4,5,6,7,8]);
      assert.equal((await sql<{version:number}>`SELECT MAX(version) AS version FROM _cms_migrations`.execute(database.db)).rows[0].version,8);
      await storage.close(); storage = await schemaAdminStorage(target,directory);
      await migrateCms(storage.database);
      assert.equal((await sql<{status:string}>`SELECT status FROM ec_post WHERE id=${entry.id}`.execute(storage.database.db)).rows[0].status,'draft');
      await sql`UPDATE ec_post SET status='published' WHERE id=${entry.id}`.execute(storage.database.db);
      await sql`INSERT INTO _cms_revisions (id,collection,entry_id,data) VALUES ('history-1','post',${entry.id},'{"title":"Retained"}')`.execute(storage.database.db);
      assert.equal((await sql`SELECT * FROM _cms_revisions`.execute(storage.database.db)).rows.length,1);
      assert.equal((await sql`SELECT * FROM pragma_foreign_key_check`.execute(storage.database.db)).rows.length,0);
    } finally { await storage.close(); await rm(directory,{recursive:true,force:true}); }
  });

  test(`${target}: unsupported legacy and partially installed layouts reject with no writes`, async () => {
    for (const mode of ['missing','view','extra-column','wrong-default','wrong-check','wrong-type','missing-pointer','orphan','external-fk','partial-lifecycle','temporary','future']) {
      const storage = await schemaAdminStorage(target);
      try {
        const database = storage.database; await installVersion4(database); await legacyPost(database);
        if (mode === 'missing' || mode === 'view') await sql`DROP TABLE ec_post`.execute(database.db);
        if (mode === 'view') await sql`CREATE VIEW ec_post AS SELECT 'draft' AS status`.execute(database.db);
        if (mode === 'extra-column') await sql`ALTER TABLE ec_post ADD COLUMN rogue TEXT`.execute(database.db);
        if (['wrong-default','wrong-check','wrong-type'].includes(mode)) {
          const replacement = mode === 'wrong-default' ? legacyContentSql.replace("DEFAULT 'draft'","DEFAULT 'published'") :
            mode === 'wrong-check' ? legacyContentSql.replace("CHECK(status = 'draft')","CHECK(status IN ('draft','published'))") : legacyContentSql.replace('author_id TEXT','author_id REAL');
          await database.atomicBatch([sql`DROP TABLE ec_post`.compile(database.db),sql.raw(replacement).compile(database.db),sql`ALTER TABLE ec_post ADD COLUMN title TEXT`.compile(database.db)]);
        }
        if (mode === 'missing-pointer') await sql`ALTER TABLE ec_post DROP COLUMN draft_revision_id`.execute(database.db);
        if (mode === 'orphan') await sql`CREATE TABLE ec_orphan (retained TEXT)`.execute(database.db);
        if (mode === 'external-fk') await sql`CREATE TABLE operator_links (entry_id TEXT REFERENCES ec_post(id) ON DELETE CASCADE)`.execute(database.db);
        if (mode === 'partial-lifecycle') await sql`CREATE TABLE _cms_revisions (retained TEXT)`.execute(database.db);
        if (mode === 'temporary') await sql`CREATE TABLE _cms_lifecycle_ec_post_v5 (retained TEXT)`.execute(database.db);
        if (mode === 'future') await sql`INSERT INTO _cms_migrations VALUES (5),(6)`.execute(database.db);
        const before = await databaseSnapshot(database);
        await assert.rejects(()=>migrateCms(database),{code:'MIGRATION_REQUIRED'},mode);
        assert.deepEqual(await databaseSnapshot(database),before,mode);
      } finally { await storage.close(); }
    }
  });

  test(`${target}: latest layouts validate required content columns and every static lifecycle object without repair`, async () => {
    for (const mode of ['missing-content','extra-content-column','draft-check','missing-revisions','bad-revision-index','missing-queue-index']) {
      const storage=await schemaAdminStorage(target);
      try {
        const database=storage.database; await migrateCms(database);
        await new SchemaRegistry(database).createCollection({slug:'post',label:'Posts'});
        if (mode==='missing-content') await sql`DROP TABLE ec_post`.execute(database.db);
        if (mode==='extra-content-column') await sql`ALTER TABLE ec_post ADD COLUMN rogue TEXT`.execute(database.db);
        if (mode==='draft-check') await database.atomicBatch([
          sql`DROP TABLE ec_post`.compile(database.db),
          sql.raw(legacyContentSql.replace('author_id TEXT','author_id TEXT, primary_byline_id TEXT')).compile(database.db)
        ]);
        if (mode==='missing-revisions') await sql`DROP TABLE _cms_revisions`.execute(database.db);
        if (mode==='bad-revision-index') await database.atomicBatch([
          sql`DROP INDEX idx_cms_revisions_entry`.compile(database.db),
          sql`CREATE INDEX idx_cms_revisions_entry ON _cms_revisions (author_id)`.compile(database.db)
        ]);
        if (mode==='missing-queue-index') await sql`DROP INDEX idx_cms_revision_prune_queue_revision_id`.execute(database.db);
        const before=await databaseSnapshot(database);
        await assert.rejects(()=>migrateCms(database),{code:'MIGRATION_REQUIRED'},mode);
        assert.deepEqual(await databaseSnapshot(database),before,mode);
      } finally {await storage.close();}
    }
  });

  test(`${target}: failure after each lifecycle rebuild stage rolls back DDL, markers and rows`, async () => {
    for (const needle of ['CREATE TABLE _cms_revisions','CREATE TABLE _cms_revision_prune_queue','CREATE TABLE "_cms_lifecycle_ec_post_v5"','INSERT INTO "_cms_lifecycle_ec_post_v5"','DROP TABLE "ec_post"','ALTER TABLE "_cms_lifecycle_ec_post_v5"','CREATE INDEX idx_ec_post_draft_list','INSERT INTO _cms_migrations (version) VALUES (5)']) {
      const storage = await schemaAdminStorage(target);
      try {
        const database = storage.database; await installVersion4(database); await legacyPost(database);
        await new DraftRepository(database).create({type:'post',data:{title:'Retained'}},'owner');
        const before = await databaseSnapshot(database);
        const failing = {...database,async atomicBatch(statements:Parameters<typeof database.atomicBatch>[0]) {
          const index = statements.findIndex(row=>row.sql.includes(needle)); assert.ok(index>=0,needle);
          return database.atomicBatch([...statements.slice(0,index+1),sql`SELECT * FROM lifecycle_rollback_probe`.compile(database.db),...statements.slice(index+1)]);
        }};
        await assert.rejects(()=>migrateCms(failing),/lifecycle_rollback_probe/);
        assert.deepEqual(await databaseSnapshot(database),before,needle);
        await migrateCms(database);
      } finally { await storage.close(); }
    }
  });

  test(`${target}: fresh and legacy concurrent startup share one complete migration winner`, async () => {
    for (const legacy of [false,true]) {
      const directory = await mkdtemp(join(tmpdir(),'cms-lifecycle-race-'));
      const first = await schemaAdminStorage(target,directory);
      const second = target === 'Node' ? await schemaAdminStorage(target,directory) : {database:first.database,close:async()=>{}};
      try {
        if (legacy) { await installVersion4(first.database); await legacyPost(first.database); }
        await Promise.all([migrateCms(first.database),migrateCms(second.database)]);
        await migrateCms(second.database);
        const markers=(await sql<{version:number}>`SELECT version FROM _cms_migrations ORDER BY version`.execute(first.database.db)).rows.map(row=>row.version);
        assert.deepEqual(markers.slice(0,5),[1,2,3,4,5]);
        assert.deepEqual(markers,[1,2,3,4,5,6,7,8]);
        assert.equal((await sql`SELECT * FROM _cms_guards`.execute(first.database.db)).rows.length,0);
        assert.equal((await sql`SELECT * FROM _cms_revisions`.execute(second.database.db)).rows.length,0);
      } finally { await second.close(); await first.close(); await rm(directory,{recursive:true,force:true}); }
    }
  });

  test(`${target}: a content schema write between preflight and batch cannot be overwritten`, async () => {
    const storage = await schemaAdminStorage(target);
    try {
      const database = storage.database; await installVersion4(database); const registry = await legacyPost(database);
      let expected:Awaited<ReturnType<typeof databaseSnapshot>>;
      const racing = {...database,async atomicBatch(statements:Parameters<typeof database.atomicBatch>[0]) {
        await registry.createField('post',{slug:'race',label:'Race',type:'string'});
        expected = await databaseSnapshot(database);
        return database.atomicBatch(statements);
      }};
      await assert.rejects(()=>migrateCms(racing),{code:'MIGRATION_REQUIRED'});
      assert.deepEqual(await databaseSnapshot(database),expected!);
      await migrateCms(database);
      assert.equal((await sql`SELECT * FROM pragma_table_info('ec_post') WHERE name='race'`.execute(database.db)).rows.length,1);
    } finally { await storage.close(); }
  });
}
