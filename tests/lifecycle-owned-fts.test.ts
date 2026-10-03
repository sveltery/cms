// Original canonical-startup integration; captured real source SQL is fixture
// data, not a copied assertion or production FTS implementation. Zero source credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sql} from 'kysely';
import {migrateCms} from './helpers/later-migration-framework.ts';
import {schemaAdminStorage} from './helpers/schema-admin-storage.ts';
import {SchemaRegistry} from '../src/lib/server/database/registry.ts';
import type {CmsDatabase} from '../src/lib/server/database/contract.ts';
import type {FtsCatalogueObject} from '../src/lib/server/search/fts-ownership.ts';

const table='_cms_fts_notes_v3';
async function catalogue(database:CmsDatabase) {
  return (await sql<FtsCatalogueObject>`SELECT name,type,tbl_name,sql FROM sqlite_master ORDER BY name,type`.execute(database.db)).rows;
}
async function snapshot(database:CmsDatabase) {
  const objects=await catalogue(database),tables=[];
  for(const object of objects) if(object.type==='table' && !String(object.name).startsWith('sqlite_') && object.name!=='_cf_METADATA') {
    // A deliberately removed shadow leaves an unusable virtual table; the
    // supported owner DROP removes all shadows together, so every row is readable.
    const rows=(await sql`SELECT * FROM ${sql.id(String(object.name))}`.execute(database.db)).rows;
    tables.push({name:object.name,rows:rows.map(row=>JSON.stringify(row)).sort()});
  }
  return {objects,tables};
}
async function fixture(target:'Node'|'D1',config:string|null=JSON.stringify({enabled:true}),beforeFts?:(database:CmsDatabase)=>Promise<unknown>) {
  const storage=await schemaAdminStorage(target);const database=storage.database;
  await migrateCms(database);
  const registry=new SchemaRegistry(database);
  await registry.createCollection({slug:'notes_v3',label:'Notes',supports:[]});
  await registry.createField('notes_v3',{slug:'title',label:'Title',type:'string',searchable:true});
  await registry.createField('notes_v3',{slug:'body',label:'Body',type:'portableText',searchable:true});
  await sql`UPDATE _cms_collections SET search_config=${config} WHERE slug='notes_v3'`.execute(database.db);
  if(beforeFts) await beforeFts(database);
  const objects=JSON.parse(readFileSync(new URL(`./fixtures/search/${target.toLowerCase()}-notes-v3-ddl.json`,import.meta.url),'utf8')) as FtsCatalogueObject[];
  // Only execute the real manager's main/trigger statements: SQLite itself
  // generates its five shadows, matching the captured Node/D1 catalogue.
  await database.atomicBatch([objects.find(object=>object.name===table)!,...objects.filter(object=>object.type==='trigger')]
    .map(object=>sql.raw(object.sql!).compile(database.db)));
  return storage;
}
for(const target of ['Node','D1'] as const) {
  test(`${target}: exact managed version-suffix FTS survives restart, index repair and live effects`,async()=>{
    const storage=await fixture(target);const database=storage.database;
    try {
      const before=await catalogue(database);
      await assert.doesNotReject(()=>migrateCms(database));
      assert.deepEqual(await catalogue(database),before);
      await sql`DROP INDEX idx_ec_notes_v3_deleted_status`.execute(database.db);
      await assert.doesNotReject(()=>migrateCms(database));
      await sql`INSERT INTO ec_notes_v3(id,title,body) VALUES('retained','Searchable',${JSON.stringify([{text:'portable words'}])})`.execute(database.db);
      assert.equal((await sql`SELECT id FROM ${sql.id(table)} WHERE ${sql.id(table)} MATCH 'portable'`.execute(database.db)).rows.length,1);
      await sql`UPDATE ec_notes_v3 SET deleted_at='retained-deleted' WHERE id='retained'`.execute(database.db);
      assert.equal((await sql`SELECT id FROM ${sql.id(table)}`.execute(database.db)).rows.length,0);
      await migrateCms(database);
    } finally {await storage.close();}
  });
  test(`${target}: complete source group may precede config or remain disabled`,async()=>{
    for(const config of [null,JSON.stringify({enabled:false})]) {
      const storage=await fixture(target,config);
      try {await assert.doesNotReject(()=>migrateCms(storage.database));}
      finally {await storage.close();}
    }
  });
  test(`${target}: incomplete, spoofed and malformed managed ownership rejects without startup writes`,async()=>{
    const changes=[
      'DROP TRIGGER _cms_fts_notes_v3_insert',
      "UPDATE _cms_collections SET search_config='malformed' WHERE slug='notes_v3'",
      "UPDATE _cms_collections SET search_config='{}' WHERE slug='notes_v3'",
      "UPDATE _cms_collections SET search_config='{\"enabled\":true,\"tokenize\":\"unknown\"}' WHERE slug='notes_v3'",
      "UPDATE _cms_fields SET searchable=0 WHERE slug='title'",
      'CREATE TABLE _cms_fields_v3(retained TEXT)',
      'CREATE TABLE _CMS_FTS_ROGUE_V3(retained TEXT)',
      'CREATE VIRTUAL TABLE _cms_fts_rogue_v3 USING fts5(id,tokenize=\'unicode61\')'
    ];
    for(const change of changes) {
      const storage=await fixture(target);const database=storage.database;
      try {
        await sql.raw(change).execute(database.db);const before=await snapshot(database);
        let batches=0;const subject={...database,async atomicBatch(statements:Parameters<CmsDatabase['atomicBatch']>[0]) {batches++;return database.atomicBatch(statements);}};
        await assert.rejects(()=>migrateCms(subject),{code:'MIGRATION_REQUIRED'});
        assert.equal(batches,0);assert.deepEqual(await snapshot(database),before);
      } finally {await storage.close();}
    }
  });
  test(`${target}: managed group, trigger and metadata races abort before index backfill`,async()=>{
    // SQLite forbids independent shadow DROP/ALTER; dropping its owner
    // is the genuine public operation which removes all six managed tables.
    const changes=[`DROP TABLE "${table}"`,
      ...['_insert','_update','_delete'].map(suffix=>`DROP TRIGGER "${table+suffix}"`),
      "UPDATE _cms_collections SET search_config=NULL WHERE slug='notes_v3'",
      "UPDATE _cms_fields SET searchable=0 WHERE slug='title'",
      'CREATE TABLE _cms_fields_v77(retained TEXT)'];
    for(const change of changes) {
      const storage=await fixture(target);const database=storage.database;
      try {
        await sql`DROP INDEX idx_ec_notes_v3_deleted_status`.execute(database.db);
        let batches=0,before:unknown;const subject={...database,async atomicBatch(statements:Parameters<CmsDatabase['atomicBatch']>[0]) {
          batches++;await sql.raw(change).execute(database.db);before=await snapshot(database);
          return database.atomicBatch(statements);
        }};
        await assert.rejects(()=>migrateCms(subject),{code:'MIGRATION_REQUIRED'});
        assert.equal(batches,1);assert.deepEqual(await snapshot(database),before);
        assert.equal((await sql`SELECT name FROM sqlite_master WHERE name='idx_ec_notes_v3_deleted_status'`.execute(database.db)).rows.length,0);
        assert.equal((await database.db.selectFrom('_cms_guards').selectAll().execute()).length,0);
      } finally {await storage.close();}
    }
  });
  test(`${target}: unrelated operator and live search row writes remain allowed during backfill`,async()=>{
    const storage=await fixture(target);const database=storage.database;
    try {
      await sql`DROP INDEX idx_ec_notes_v3_deleted_status`.execute(database.db);
      let batches=0;const subject={...database,async atomicBatch(statements:Parameters<CmsDatabase['atomicBatch']>[0]) {
        batches++;
        await sql`CREATE TABLE operator_notes(note TEXT)`.execute(database.db);
        await sql`INSERT INTO operator_notes VALUES('retained')`.execute(database.db);
        await sql`INSERT INTO ec_notes_v3(id,title) VALUES('concurrent','Searchable')`.execute(database.db);
        await sql`UPDATE _cms_fields SET label='Changed label',sort_order=sort_order+100`.execute(database.db);
        return database.atomicBatch(statements);
      }};
      await assert.doesNotReject(()=>migrateCms(subject));assert.equal(batches,1);
      assert.equal((await sql<{note:string}>`SELECT note FROM operator_notes`.execute(database.db)).rows[0]?.note,'retained');
      assert.equal((await sql<{id:string}>`SELECT id FROM ${sql.id(table)} WHERE ${sql.id(table)} MATCH 'Searchable'`.execute(database.db)).rows[0]?.id,'concurrent');
      await migrateCms(database);
    } finally {await storage.close();}
  });
  test(`${target}: maximum declared fields fit the native D1 binding budget during backfill`,async()=>{
    const storage=await fixture(target);const database=storage.database;
    try {
      const registry=new SchemaRegistry(database);
      for(let index=0;index<30;index++) await registry.createField('notes_v3',{slug:'extra_'+index,label:'Extra',type:'string'});
      await sql`DROP INDEX idx_ec_notes_v3_deleted_status`.execute(database.db);
      let batches=0;const subject={...database,async atomicBatch(statements:Parameters<CmsDatabase['atomicBatch']>[0]) {
        batches++;
        // Cloudflare D1's documented maximum is 100 bound values per query.
        // The real native registry permits 32 fields, including unindexed ones.
        for(const statement of statements) assert.ok(statement.parameters.length<=100,`D1 query bound values: ${statement.parameters.length}`);
        return database.atomicBatch(statements);
      }};
      await assert.doesNotReject(()=>migrateCms(subject));assert.equal(batches,1);
      await migrateCms(database);
    } finally {await storage.close();}
  });
  for(const racing of [false,true]) test(`${target}: every orphan version-suffix companion rejects ${racing?'batch races':'preflight'}`,async()=>{
    const objects=[...['_data','_idx','_content','_docsize','_config'].map(suffix=>({suffix,type:'table'})),
      ...['_insert','_update','_delete'].map(suffix=>({suffix,type:'trigger'}))];
    for(const object of objects) for(const uppercase of [false,true]) {
      const storage=await fixture(target);const database=storage.database;
      try {
        await database.atomicBatch([sql`DROP TABLE ${sql.id(table)}`.compile(database.db),
          ...['_insert','_update','_delete'].map(suffix=>sql`DROP TRIGGER ${sql.id(table+suffix)}`.compile(database.db))]);
        const name=uppercase?(table+object.suffix).toUpperCase():table+object.suffix;
        const introduce=()=>object.type==='table' ? sql`CREATE TABLE ${sql.id(name)}(retained TEXT)`.execute(database.db)
          :sql`CREATE TRIGGER ${sql.id(name)} AFTER INSERT ON ec_notes_v3 BEGIN SELECT 1; END`.execute(database.db);
        let before:unknown,batches=0;
        if(racing) await sql`DROP INDEX idx_ec_notes_v3_deleted_status`.execute(database.db);
        else {await introduce();before=await snapshot(database);}
        const subject={...database,async atomicBatch(statements:Parameters<CmsDatabase['atomicBatch']>[0]) {
          batches++;if(racing){await introduce();before=await snapshot(database);}return database.atomicBatch(statements);
        }};
        await assert.rejects(()=>migrateCms(subject),{code:'MIGRATION_REQUIRED'});
        assert.equal(batches,racing?1:0);assert.deepEqual(await snapshot(database),before);
      } finally {await storage.close();}
    }
  });
  test(`${target}: separate namespace companion lookalikes remain ordinary operators`,async()=>{
    // SQLite reserves shadow names after virtual-table creation; a separate
    // trigger namespace lookalike can genuinely predate that creation.
    const storage=await fixture(target,JSON.stringify({enabled:true}),database=>sql`CREATE TRIGGER _cms_fts_notes_v3_data AFTER INSERT ON ec_notes_v3 BEGIN SELECT 1; END`.execute(database.db));
    const database=storage.database;
    try {
      await sql`CREATE TABLE _cms_fts_notes_v3_insert(retained TEXT)`.execute(database.db);
      const before=await snapshot(database);await assert.doesNotReject(()=>migrateCms(database));
      assert.deepEqual(await snapshot(database),before);
    } finally {await storage.close();}
  });
}
