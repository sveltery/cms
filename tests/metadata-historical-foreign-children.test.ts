import test from 'node:test';
import assert from 'node:assert/strict';
import {sql} from 'kysely';
import {schemaAdminStorage} from './helpers/schema-admin-storage.ts';
import {installPrefix,snapshot} from './helpers/metadata-upgrade.ts';
import {migrateCms} from '../src/lib/server/database/migrations.ts';
import {SchemaRegistry} from '../src/lib/server/database/registry.ts';

// Original native destructive-parent dependency matrix. Zero source credit.
for(const target of ['Node','D1'] as const) for(const version of [1,2]) {
  for(const parent of ['_cms_fields','_cms_collections']) for(const action of ['CASCADE','SET NULL','RESTRICT']) {
    for(const race of [false,true]) test(`${target}: prefix${version} ${parent} ${action} ${race?'concurrent':'existing'} child survives rejected upgrade`,async()=>{
      const storage=await schemaAdminStorage(target);const database=storage.database;
      try {
        await installPrefix(database,version);
        const registry=new SchemaRegistry(database);await registry.createCollection({slug:'legacy',label:'Legacy',supports:[]});
        await registry.createField('legacy',{slug:'title',label:'Title',type:'string'});
        const create=async()=>{
          await sql.raw('CREATE TABLE operator_children (parent_id TEXT REFERENCES "'+parent+'"(id) ON DELETE '+action+')').execute(database.db);
          await sql`INSERT INTO operator_children SELECT id FROM ${sql.id(parent)} LIMIT 1`.execute(database.db);
        };
        let before:Awaited<ReturnType<typeof snapshot>>;
        if(!race){await create();before=await snapshot(database);}
        const subject=race ? {...database,async atomicBatch(statements:Parameters<typeof database.atomicBatch>[0]) {
          await create();before=await snapshot(database);return database.atomicBatch(statements);
        }} : database;
        await assert.rejects(()=>migrateCms(subject),{code:'MIGRATION_REQUIRED'});
        assert.deepEqual(await snapshot(database),before!);
      } finally {await storage.close();}
    });
  }
}
for(const target of ['Node','D1'] as const) test(`${target}: prefix7 collection children remain valid because only fields are rebuilt`,async()=>{
  const storage=await schemaAdminStorage(target);const database=storage.database;
  try {
    await installPrefix(database);
    await new SchemaRegistry(database).createCollection({slug:'retained',label:'Retained',supports:[]});
    await sql`CREATE TABLE operator_children (parent_id TEXT REFERENCES _cms_collections(id) ON DELETE CASCADE)`.execute(database.db);
    await sql`INSERT INTO operator_children SELECT id FROM _cms_collections`.execute(database.db);
    const before=(await sql`SELECT * FROM operator_children`.execute(database.db)).rows;
    await assert.doesNotReject(()=>migrateCms(database));
    assert.deepEqual((await sql`SELECT * FROM operator_children`.execute(database.db)).rows,before);
  } finally {await storage.close();}
});
