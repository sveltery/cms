import test from 'node:test';
import assert from 'node:assert/strict';
import {sql} from 'kysely';
import {schemaAdminStorage} from './helpers/schema-admin-storage.ts';
import {installPrefix,snapshot} from './helpers/metadata-upgrade.ts';
import {migrateCms} from '../src/lib/server/database/migrations.ts';
import {SchemaRegistry} from '../src/lib/server/database/registry.ts';

// Original native historical composition. No upstream assertion credit.
for(const target of ['Node','D1'] as const) for(const version of [1,2]) {
  test(`${target}: prefix${version} metadata rebuild retains dependent catalogue and attached content triggers`,async()=>{
    const storage=await schemaAdminStorage(target);const database=storage.database;
    try {
      await installPrefix(database,version);
      const registry=new SchemaRegistry(database);
      await registry.createCollection({slug:'legacy',label:'Legacy',supports:[]});
      await registry.createField('legacy',{slug:'title',label:'Title',type:'string'});
      await sql`CREATE TABLE operator_notes (note TEXT)`.execute(database.db);
      await sql`CREATE VIEW operator_fields AS SELECT id,collection_id FROM _cms_fields`.execute(database.db);
      await sql`CREATE VIEW operator_join AS SELECT f.id FROM operator_fields f JOIN _cms_collections c ON c.id=f.collection_id`.execute(database.db);
      await sql`CREATE TRIGGER operator_changed AFTER UPDATE ON _cms_fields BEGIN INSERT INTO operator_notes VALUES (NEW.id); END`.execute(database.db);
      await sql`CREATE TRIGGER operator_content AFTER INSERT ON ec_legacy BEGIN INSERT INTO operator_notes SELECT id FROM _cms_fields; END`.execute(database.db);
      await sql`CREATE INDEX operator_field_label ON _cms_fields(label)`.execute(database.db);
      await sql`CREATE INDEX operator_collection_label ON _cms_collections(label)`.execute(database.db);
      const before=await snapshot(database);
      await assert.doesNotReject(()=>migrateCms(database));
      await assert.doesNotReject(()=>migrateCms(database));
      const after=await snapshot(database);
      assert.deepEqual(after.objects.filter(object=>object.name.startsWith('operator_')),before.objects.filter(object=>object.name.startsWith('operator_')));
      assert.equal((await sql`SELECT * FROM operator_join`.execute(database.db)).rows.length,1);
      await sql`INSERT INTO ec_legacy(id,title) VALUES ('retained','Test')`.execute(database.db);
      assert.equal((await sql`SELECT * FROM operator_notes`.execute(database.db)).rows.length,1);
    } finally {await storage.close();}
  });
  test(`${target}: prefix${version} concurrent field metadata edit aborts before historical catalogue removal`,async()=>{
    const storage=await schemaAdminStorage(target);const database=storage.database;
    try {
      await installPrefix(database,version);
      const registry=new SchemaRegistry(database);
      await registry.createCollection({slug:'legacy',label:'Legacy',supports:[]});
      await registry.createField('legacy',{slug:'title',label:'Title',type:'string'});
      await sql`CREATE VIEW operator_fields AS SELECT id,collection_id FROM _cms_fields`.execute(database.db);
      let before:Awaited<ReturnType<typeof snapshot>>|undefined;let batches=0;
      const subject={...database,async atomicBatch(statements:Parameters<typeof database.atomicBatch>[0]) {
        batches++;
        await sql`UPDATE _cms_fields SET type='text' WHERE slug='title'`.execute(database.db);
        before=await snapshot(database);
        return database.atomicBatch(statements);
      }};
      await assert.rejects(()=>migrateCms(subject),{code:'MIGRATION_REQUIRED'});
      assert.equal(batches,1);
      assert.deepEqual(await snapshot(database),before);
      assert.equal((await sql`SELECT * FROM operator_fields`.execute(database.db)).rows.length,1);
    } finally {await storage.close();}
  });
}
