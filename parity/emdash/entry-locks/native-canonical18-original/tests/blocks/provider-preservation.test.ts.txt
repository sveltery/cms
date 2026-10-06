// Supplemental original feature checks. No Source/auth parity credit.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CompiledQuery, sql } from 'kysely';
import { openSqlite } from '../../src/lib/server/database/sqlite.ts';
import { openD1, RawBindingD1Adapter } from '../../src/lib/server/database/d1.ts';
import { CMS_MIGRATIONS, CMS_MIGRATION_VERSION, migrateCms } from '../../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../../src/lib/server/database/registry.ts';
import { asyncD1Storage } from '../helpers/async-d1-storage.ts';
import type { CmsDatabase } from '../../src/lib/server/database/contract.ts';

type Runtime = 'node' | 'd1';
async function fixture(runtime: Runtime) {
  const storage = runtime === 'd1' ? await asyncD1Storage() : undefined;
  const database = storage ? openD1(storage.binding) : openSqlite(':memory:');
  return {database,async dispose() {await database.close();await storage?.runtime.dispose();}};
}
// Actual immutable published providers create historical ordinary feature DBs.
// The historical providers and frozen fixtures are never rewritten.
async function installThrough(database: CmsDatabase, version: 8 | 14) {
  const providers = CMS_MIGRATIONS.filter(provider => provider.version <= version);
  assert.equal(providers.length,version,'actual public prerequisite provider union must be present');
  await sql`CREATE TABLE _cms_migrations (version INTEGER PRIMARY KEY CHECK(version > 0))`.execute(database.db);
  for(const provider of providers) await database.atomicBatch([
    ...await provider.statements(database),
    sql`INSERT INTO _cms_migrations(version) VALUES (${sql.lit(provider.version)})`.compile(database.db)
  ]);
}
async function metadataRows(database: CmsDatabase) {
  return {collections:await database.db.selectFrom('_cms_collections').selectAll().orderBy('id').execute(),
    fields:await database.db.selectFrom('_cms_fields').selectAll().orderBy('id').execute()};
}
async function snapshot(database: CmsDatabase) {
  const objects=(await sql<{name:string;type:string;sql:string|null}>`SELECT name,type,sql FROM sqlite_master ORDER BY name,type`.execute(database.db)).rows;
  const rows=[];
  const rawD1=database.db.getExecutor().adapter instanceof RawBindingD1Adapter;
  // D1 forbids reading its reserved internal rows; retain their catalogue SQL.
  for(const object of objects.filter(object => object.type==='table' && !object.name.startsWith('sqlite_') &&
    !(rawD1 && object.name.toLowerCase().startsWith('_cf_')))) {
    rows.push({name:object.name,rows:(await sql`SELECT * FROM ${sql.id(object.name)} ORDER BY rowid`.execute(database.db)).rows});
  }
  return {objects,rows};
}
async function seedExisting(database: CmsDatabase) {
  const registry=new SchemaRegistry(database);
  const collection=await registry.createCollection({slug:'retained',label:'Retained',description:'Stored metadata'});
  await registry.createField(collection.slug,{slug:'title',label:'Title',type:'string',defaultValue:'Physical',required:true});
  await sql`UPDATE _cms_collections SET comments_auto_approve_users=0,version=9,created_at='2024-01-02 03:04:05',updated_at='2025-02-03T04:05:06.007Z',icon='book',admin_config='{"quickCreate":true}',has_seo=1,title_field='title',date_field=NULL,url_pattern='/retained/{slug}',routable=1,hidden=1,sort_order=7,nav_group='Group',comments_enabled=1,comments_moderation='all',comments_closed_after_days=12,edit_locking=0,search_config=NULL`.execute(database.db);
  await sql`UPDATE _cms_fields SET widget='input',options='{"placeholder":"Stored"}',searchable=0,indexed=1,translatable=0,sort_order=6,created_at='2024-02-03 04:05:06',default_value='"Metadata"',validation='{"maxLength":150}'`.execute(database.db);
  await sql`INSERT INTO ec_retained(id,slug,status,locale,version,created_at,updated_at,title) VALUES ('retained-entry','retained-entry','draft','en',4,'2024-01-01T00:00:00.000Z','2024-01-02T00:00:00.000Z','Content')`.execute(database.db);
  await sql`CREATE TABLE operator_audit (value TEXT NOT NULL)`.execute(database.db);
  await sql`CREATE INDEX operator_metadata_lookup ON _cms_collections(label,version)`.execute(database.db);
  await sql`CREATE INDEX operator_field_lookup ON _cms_fields(label)`.execute(database.db);
  await sql`CREATE UNIQUE INDEX operator_partial_unique ON _cms_fields(lower(label)) WHERE "unique"=0`.execute(database.db);
  await sql`CREATE INDEX operator_expression_lookup ON _cms_collections(length(label)) WHERE hidden=1`.execute(database.db);
  await sql`CREATE VIEW z_metadata_view AS SELECT slug,label FROM _cms_collections`.execute(database.db);
  await sql`CREATE VIEW y_indirect_view AS SELECT slug,label FROM z_metadata_view`.execute(database.db);
  await sql`CREATE TRIGGER a_instead_of_view INSTEAD OF UPDATE ON z_metadata_view BEGIN INSERT INTO operator_audit(value) VALUES ('instead:' || NEW.label); END`.execute(database.db);
  await sql`CREATE TRIGGER z_metadata_first AFTER UPDATE ON _cms_collections BEGIN INSERT INTO operator_audit(value) VALUES ('first:' || NEW.label); END`.execute(database.db);
  await sql`CREATE TRIGGER a_metadata_second AFTER UPDATE ON _cms_collections BEGIN INSERT INTO operator_audit(value) VALUES ('second:' || NEW.label); END`.execute(database.db);
  await sql`CREATE TRIGGER operator_option_trigger AFTER UPDATE ON _cms_options BEGIN INSERT INTO operator_audit(value) VALUES ('option:' || NEW.name); END`.execute(database.db);
  const ownedTrigger=(await sql<{sql:string}>`SELECT sql FROM sqlite_master WHERE type='trigger' AND name='_cms_options_revision_update'`.execute(database.db)).rows[0];
  await sql`DROP TRIGGER _cms_options_revision_update`.execute(database.db);
  await sql.raw(ownedTrigger.sql).execute(database.db);
  return registry;
}
for(const runtime of ['node','d1'] as const) {
  test(runtime+' fresh16 persists exact tables/defaults and recognizes a reopened store without startup writes',async()=>{
    const directory=await mkdtemp(join(tmpdir(),'cms-block-reopen-'));
    let database:CmsDatabase|undefined;let storage:Awaited<ReturnType<typeof asyncD1Storage>>|undefined;
    try {
      storage=runtime==='d1'?await asyncD1Storage(directory):undefined;
      database=storage?openD1(storage.binding):openSqlite(join(directory,'cms.sqlite'));
      await migrateCms(database);
      const registry=new SchemaRegistry(database);await registry.createCollection({slug:'reopened',label:'Reopened'});
      const before=await snapshot(database);
      await database.close();database=undefined;await storage?.runtime.dispose();storage=undefined;
      storage=runtime==='d1'?await asyncD1Storage(directory):undefined;
      database=storage?openD1(storage.binding):openSqlite(join(directory,'cms.sqlite'));
      const live=database;let writes=0;const observed:CmsDatabase={...live,async atomicBatch(statements){writes++;return live.atomicBatch(statements);}};
      await migrateCms(observed);
      assert.equal(CMS_MIGRATION_VERSION,18);assert.equal(writes,0);
      assert.deepEqual(await snapshot(live),before);
      assert.equal((await new SchemaRegistry(live).getCollection('reopened'))?.commentsAutoApproveUsers,true);
    } finally {await database?.close();await storage?.runtime.dispose();await rm(directory,{recursive:true,force:true});}
  });
  test(runtime+' installed16 near-miss block or metadata defaults are refused without repair',async()=>{
    for(const mode of ['missing-version-index','wrong-version-index','changed-metadata-layout'] as const) {
      const ctx=await fixture(runtime);
      try {
        await migrateCms(ctx.database);assert.equal(CMS_MIGRATION_VERSION,18);
        if(mode==='missing-version-index') await sql`DROP INDEX idx_block_type_versions_type_version`.execute(ctx.database.db);
        if(mode==='wrong-version-index') {
          await sql`DROP INDEX idx_block_type_versions_type_version`.execute(ctx.database.db);
          await sql`CREATE UNIQUE INDEX idx_block_type_versions_type_version ON _cms_block_type_versions(block_type_id,fingerprint)`.execute(ctx.database.db);
        }
        if(mode==='changed-metadata-layout') await sql`ALTER TABLE _cms_fields ADD COLUMN operator_default TEXT DEFAULT 'retained'`.execute(ctx.database.db);
        const before=await snapshot(ctx.database);
        await assert.rejects(()=>migrateCms(ctx.database),{code:'MIGRATION_REQUIRED'});
        assert.deepEqual(await snapshot(ctx.database),before);
      } finally {await ctx.dispose();}
    }
  });

  for(const version of [8,14] as const) test(runtime+' forward16 preserves all metadata/content values and operator objects from '+version,async()=>{
    const ctx=await fixture(runtime);
    try {
      await installThrough(ctx.database,version);const registry=await seedExisting(ctx.database);
      const beforeRows=await metadataRows(ctx.database);
      const beforeContent=(await sql`SELECT * FROM ec_retained`.execute(ctx.database.db)).rows;
      const beforeOperators=(await sql`SELECT name,type,sql FROM sqlite_master WHERE name GLOB 'operator_*' OR name IN ('z_metadata_view','y_indirect_view','a_instead_of_view','z_metadata_first','a_metadata_second','ec_retained') ORDER BY name,type`.execute(ctx.database.db)).rows;
      const beforeOrder=(await sql`SELECT name FROM sqlite_master WHERE type='trigger' AND (name IN ('z_metadata_first','a_metadata_second','_cms_options_revision_update','operator_option_trigger')) ORDER BY rowid`.execute(ctx.database.db)).rows;
      const currentTriggers=(await sql<{name:string}>`SELECT name FROM sqlite_master WHERE type='trigger' ORDER BY rowid`.execute(ctx.database.db)).rows.map(row=>row.name);
      const futureTriggers:string[]=[];
      for(const provider of CMS_MIGRATIONS.filter(provider=>provider.version>version && provider.version<=14)) {
        for(const trigger of await provider.expectedTriggers?.(ctx.database) ?? []) if(!currentTriggers.includes(trigger.name)) futureTriggers.push(trigger.name);
      }
      await migrateCms(ctx.database);await migrateCms(ctx.database);
      assert.equal(CMS_MIGRATION_VERSION,18);
      const afterTriggers=(await sql<{name:string}>`SELECT name FROM sqlite_master WHERE type='trigger' ORDER BY rowid`.execute(ctx.database.db)).rows.map(row=>row.name);
      assert.deepEqual(afterTriggers,[...currentTriggers,...futureTriggers],'captured historical operators keep relative order before newly installed provider triggers');
      assert.deepEqual(await metadataRows(ctx.database),beforeRows);
      assert.deepEqual((await sql`SELECT * FROM ec_retained`.execute(ctx.database.db)).rows,beforeContent);
      assert.deepEqual((await sql`SELECT name,type,sql FROM sqlite_master WHERE name GLOB 'operator_*' OR name IN ('z_metadata_view','y_indirect_view','a_instead_of_view','z_metadata_first','a_metadata_second','ec_retained') ORDER BY name,type`.execute(ctx.database.db)).rows,beforeOperators);
      assert.deepEqual((await sql`SELECT name FROM sqlite_master WHERE type='trigger' AND (name IN ('z_metadata_first','a_metadata_second','_cms_options_revision_update','operator_option_trigger')) ORDER BY rowid`.execute(ctx.database.db)).rows,beforeOrder);
      // Immutable pending provider9 inserts its option; provider6 revisioning
      // legitimately invokes the pre-existing option UPDATE audit trigger.
      const pendingAudit=version===8?[{value:'option:byline_fields_version'}]:[];
      assert.deepEqual((await sql<{value:string}>`SELECT * FROM operator_audit`.execute(ctx.database.db)).rows.map(row=>({...row})),pendingAudit,'metadata copy adds no operator writes beyond normal pending provider9');
      await sql`UPDATE z_metadata_view SET label='View write' WHERE slug='retained'`.execute(ctx.database.db);
      assert.deepEqual((await sql<{value:string}>`SELECT value FROM operator_audit`.execute(ctx.database.db)).rows.map(row=>({...row})),[...pendingAudit,{value:'instead:View write'}]);
      assert.equal((await registry.getCollection('retained'))?.commentsAutoApproveUsers,false);
      const old=await registry.getCollection('retained');
      await registry.updateCollection('retained',{label:'After upgrade'},{version:old!.version,updatedAt:old!.updatedAt});
      await assert.rejects(()=>registry.updateCollection('retained',{label:'Stale'},{version:old!.version,updatedAt:old!.updatedAt}),{code:'CONFLICT'});
      assert.deepEqual((await sql`PRAGMA foreign_key_check`.execute(ctx.database.db)).rows,[]);
    } finally {await ctx.dispose();}
  });
  test(runtime+' Source UTC timestamp metadata CAS remains literal and monotonic in a non-UTC host',async()=>{
    const ctx=await fixture(runtime);
    try {
      await migrateCms(ctx.database);
      const registry=new SchemaRegistry(ctx.database);
      const old=await registry.createCollection({slug:'source_timestamp',label:'Source timestamp'});
      await sql`UPDATE _cms_collections SET created_at='2099-01-02 03:04:05',updated_at='2099-01-02 03:04:05',comments_auto_approve_users=0 WHERE id=${old.id}`.execute(ctx.database.db);
      const expected={version:old.version,updatedAt:'2099-01-02 03:04:05'};
      await assert.rejects(()=>registry.updateCollection(old.slug,{label:'Invalid calendar'},{...expected,updatedAt:'2099-02-29 03:04:05'}),{code:'VALIDATION_ERROR'});
      await assert.rejects(()=>registry.updateCollection(old.slug,{label:'Different literal'},{...expected,updatedAt:'2099-01-02T03:04:05Z'}),{code:'CONFLICT'});
      await assert.doesNotReject(()=>registry.updateCollection(old.slug,{label:'Updated'},expected));
      const updated=await registry.getCollection(old.slug);
      assert.equal(updated?.updatedAt,'2099-01-02T03:04:05.001Z');
      assert.equal(updated?.version,old.version);
      assert.equal(updated?.commentsAutoApproveUsers,false);
      await assert.rejects(()=>registry.updateCollection(old.slug,{label:'Stale'},expected),{code:'CONFLICT'});
      await sql`UPDATE _cms_collections SET updated_at='2099-01-02 03:04:05' WHERE id=${old.id}`.execute(ctx.database.db);
      await registry.reorderCollections([old.slug]);
      assert.equal((await registry.getCollection(old.slug))?.updatedAt,'2099-01-02T03:04:05.001Z');
      await assert.rejects(()=>registry.updateCollection(old.slug,{label:'Stale after reorder'},expected),{code:'CONFLICT'});
    } finally {await ctx.dispose();}
  });
  test(runtime+' real omitted Source metadata creation defaults permit persisted collection and field creation',async()=>{
    const ctx=await fixture(runtime);
    try {
      await migrateCms(ctx.database);
      await sql`INSERT INTO _cms_collections(id,slug,label,supports,source) VALUES ('source-collection','source_defaults','Source defaults','[]','seed')`.execute(ctx.database.db);
      await sql`INSERT INTO _cms_fields(id,collection_id,slug,label,type,column_type) VALUES ('source-field','source-collection','title','Title','string','TEXT')`.execute(ctx.database.db);
      const rows=await metadataRows(ctx.database);const collection=rows.collections[0];const field=rows.fields[0];
      assert.match(collection.created_at,/^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}$/);
      assert.match(collection.updated_at,/^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}$/);
      assert.match(field.created_at,/^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}$/);
      assert.deepEqual({required:field.required,unique:field.unique,sort:field.sort_order,comments:collection.comments_auto_approve_users},{required:0,unique:0,sort:0,comments:1});
      const registry=new SchemaRegistry(ctx.database);
      await assert.doesNotReject(()=>registry.updateCollection(collection.slug,{label:'Source update'},{version:collection.version,updatedAt:collection.updated_at}));
    } finally {await ctx.dispose();}
  });
  test(runtime+' rebuild refuses external metadata parent foreign keys before any atomic writes',async()=>{
    for(const parent of ['_cms_collections','_cms_fields'] as const) {
      const ctx=await fixture(runtime);
      try {
        await installThrough(ctx.database,14);await seedExisting(ctx.database);
        await sql`CREATE TABLE operator_reference (id TEXT PRIMARY KEY,parent_id TEXT REFERENCES ${sql.id(parent)}(id) ON DELETE CASCADE)`.execute(ctx.database.db);
        const before=await snapshot(ctx.database);let calls=0;
        const observed:CmsDatabase={...ctx.database,async atomicBatch(statements){calls++;return ctx.database.atomicBatch(statements);}};
        await assert.rejects(()=>migrateCms(observed),{code:'MIGRATION_REQUIRED'});
        assert.equal(calls,0);assert.deepEqual(await snapshot(ctx.database),before);
      } finally {await ctx.dispose();}
    }
  });
  test(runtime+' unknown partial block installation rejects without repair or row changes',async()=>{
    const ctx=await fixture(runtime);
    try {
      await installThrough(ctx.database,14);
      await sql`CREATE TABLE _cms_block_types (retained TEXT NOT NULL)`.execute(ctx.database.db);
      await sql`INSERT INTO _cms_block_types VALUES ('operator')`.execute(ctx.database.db);
      const before=await snapshot(ctx.database);
      await assert.rejects(()=>migrateCms(ctx.database),{code:'MIGRATION_REQUIRED'});
      assert.deepEqual(await snapshot(ctx.database),before);
    } finally {await ctx.dispose();}
  });
  test(runtime+' every forward rebuild DDL failure rolls back complete historical data and marker state',async()=>{
    for(const needle of ['CREATE TABLE "_cms_collections_v15"','CREATE TABLE "_cms_fields_v15"','INSERT INTO "_cms_collections_v15"','INSERT INTO "_cms_fields_v15"','DROP TABLE "_cms_fields"','DROP TABLE "_cms_collections"','ALTER TABLE "_cms_collections_v15"','ALTER TABLE "_cms_fields_v15"','CREATE TABLE "_cms_block_types"','CREATE TABLE "_cms_block_type_versions"','CREATE UNIQUE INDEX "idx_block_type_versions_type_version"','CREATE INDEX "idx_block_type_versions_type"']) {
      const ctx=await fixture(runtime);
      try {
        await installThrough(ctx.database,14);await seedExisting(ctx.database);const before=await snapshot(ctx.database);
        const failing:CmsDatabase={...ctx.database,async atomicBatch(statements){
          const index=statements.findIndex(statement=>statement.sql.startsWith(needle));assert.ok(index>=0,needle);
          return ctx.database.atomicBatch([...statements.slice(0,index+1),CompiledQuery.raw('SELECT * FROM block_rebuild_failure_probe'),...statements.slice(index+1)]);
        }};
        await assert.rejects(()=>migrateCms(failing),/block_rebuild_failure_probe/);
        assert.deepEqual(await snapshot(ctx.database),before);
        await migrateCms(ctx.database);
        assert.equal((await ctx.database.db.selectFrom('_cms_migrations').selectAll().execute()).length,18);
      } finally {await ctx.dispose();}
    }
  });
}
