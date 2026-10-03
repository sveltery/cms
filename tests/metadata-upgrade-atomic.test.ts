import test from 'node:test';
import assert from 'node:assert/strict';
import {sql} from 'kysely';
import {schemaAdminStorage} from './helpers/schema-admin-storage.ts';
import {installPrefix,snapshot,seed} from './helpers/metadata-upgrade.ts';
import {migrateCms,CMS_MIGRATION_VERSION} from '../src/lib/server/database/migrations.ts';
import {SchemaRegistry} from '../src/lib/server/database/registry.ts';

// Original native provider composition/atomicity tests. Zero source credit.
for(const target of ['Node','D1'] as const) {
  for(const version of [1,2,3,4,5,6,7]) test(`${target}: actual provider prefix${version} retains legacy field IDs/defaults/content through final metadata upgrade`,async()=>{
    const storage=await schemaAdminStorage(target);const database=storage.database;
    try {
      await installPrefix(database,version);
      const registry=new SchemaRegistry(database);
      await registry.createCollection({slug:'legacy',label:'Legacy',supports:[]});
      await registry.createField('legacy',{slug:'title',label:'Title',type:'string',required:true,defaultValue:'Physical original'});
      await database.db.updateTable('_cms_fields').set({default_value:JSON.stringify('Metadata changed')}).execute();
      await sql`INSERT INTO ec_legacy(id,title) VALUES ('entry','Retained text')`.execute(database.db);
      const fields=await database.db.selectFrom('_cms_fields').selectAll().execute();
      const content=await sql`SELECT * FROM ec_legacy`.execute(database.db);
      await migrateCms(database);await migrateCms(database);
      const upgraded=await database.db.selectFrom('_cms_fields').selectAll().execute();
      for(const [key,value] of Object.entries(fields[0])) assert.deepEqual(upgraded[0][key as keyof typeof upgraded[0]],value,key);
      assert.equal(upgraded[0].id,fields[0].id);
      for(const [key,value] of Object.entries(content.rows[0])) assert.deepEqual((await sql<Record<string,unknown>>`SELECT * FROM ec_legacy`.execute(database.db)).rows[0][key],value,key);
      assert.equal((await database.db.selectFrom('_cms_migrations').selectAll().execute()).length,CMS_MIGRATION_VERSION);
      assert.equal((await sql<{on_delete:string}>`PRAGMA foreign_key_list(_cms_fields)`.execute(database.db)).rows[0].on_delete,'CASCADE');
    } finally {await storage.close();}
  });
  test(`${target}: all17 stored field metadata rows retain IDs, type, values, and full attributes`,async()=>{
    const storage=await schemaAdminStorage(target);const database=storage.database;
    try {
      await installPrefix(database);
      const registry=new SchemaRegistry(database);await registry.createCollection({slug:'everything',label:'Everything',supports:[]});
      const types=['string','text','url','number','integer','boolean','datetime','select','multiSelect','portableText','image','file','reference','json','slug','repeater','blocks'];
      for(const type of types) await registry.createField('everything',{slug:'field_'+type.toLowerCase(),label:type,type});
      await database.db.updateTable('_cms_fields').set({widget:'preserved_widget',options:'{"retained":true}',searchable:1,indexed:0,translatable:0,validation:'{"custom":"retained"}',default_value:'{"retained":true}'}).execute();
      const before=await database.db.selectFrom('_cms_fields').selectAll().orderBy('id').execute();
      const contentSql=(await sql<{sql:string}>`SELECT sql FROM sqlite_master WHERE name='ec_everything'`.execute(database.db)).rows[0].sql;
      await migrateCms(database);await migrateCms(database);
      assert.deepEqual(await database.db.selectFrom('_cms_fields').selectAll().orderBy('id').execute(),before);
      assert.equal((await sql<{sql:string}>`SELECT sql FROM sqlite_master WHERE name='ec_everything'`.execute(database.db)).rows[0].sql,contentSql);
      await assert.rejects(()=>sql`UPDATE _cms_fields SET required=2`.execute(database.db),/CHECK constraint/);
      assert.deepEqual(await database.db.selectFrom('_cms_fields').selectAll().orderBy('id').execute(),before);
    } finally {await storage.close();}
  });
  for(const needle of ['DROP TRIGGER','DROP VIEW','CREATE TABLE "_cms_fields_v8"','INSERT INTO _cms_fields_v8',
    'DROP TABLE _cms_fields','ALTER TABLE _cms_fields_v8','CREATE INDEX operator_fields','ADD COLUMN search_config',
    'CREATE VIEW operator_view','CREATE TRIGGER operator_fields']) {
    test(`${target}: fault after ${needle} rolls back exact metadata/catalogue/auth/options/content state`,async()=>{
      const storage=await schemaAdminStorage(target);const database=storage.database;
      try {
        await installPrefix(database);await seed(database);
        await sql`CREATE INDEX operator_fields ON _cms_fields(label)`.execute(database.db);
        await sql`CREATE VIEW operator_view AS SELECT id FROM _cms_fields`.execute(database.db);
        await sql`CREATE TRIGGER operator_fields AFTER UPDATE ON _cms_fields BEGIN SELECT NEW.id; END`.execute(database.db);
        const before=await snapshot(database);
        const failing={...database,async atomicBatch(statements:Parameters<typeof database.atomicBatch>[0]) {
          const index=statements.findIndex(statement=>statement.sql.includes(needle));assert.ok(index>=0,needle);
          return database.atomicBatch([...statements.slice(0,index+1),sql`SELECT * FROM metadata_upgrade_fault_probe`.compile(database.db),...statements.slice(index+1)]);
        }};
        await assert.rejects(()=>migrateCms(failing),/metadata_upgrade_fault_probe/);
        assert.deepEqual(await snapshot(database),before);
        await migrateCms(database);await migrateCms(database);
      } finally {await storage.close();}
    });
  }
  test(`${target}: two real concurrent provider8 startups converge on the validated complete winner`,async()=>{
    const storage=await schemaAdminStorage(target);const database=storage.database;
    try {
      await installPrefix(database);await seed(database);
      await Promise.all([migrateCms(database),migrateCms(database)]);
      await migrateCms(database);
      assert.equal((await database.db.selectFrom('_cms_migrations').selectAll().execute()).length,CMS_MIGRATION_VERSION);
      assert.equal((await database.db.selectFrom('_cms_fields').selectAll().execute()).length,1);
      assert.deepEqual(await database.db.selectFrom('_cms_guards').selectAll().execute(),[]);
    } finally {await storage.close();}
  });
  test(`${target}: complete concurrent startup with malformed final metadata earns no winner recovery`,async()=>{
    const storage=await schemaAdminStorage(target);const database=storage.database;
    try {
      await installPrefix(database);await seed(database);let before:Awaited<ReturnType<typeof snapshot>>|undefined;
      const raced={...database,async atomicBatch(statements:Parameters<typeof database.atomicBatch>[0]) {
        await migrateCms(database);await sql`ALTER TABLE _cms_fields ADD COLUMN rogue TEXT`.execute(database.db);
        before=await snapshot(database);return database.atomicBatch(statements);
      }};
      await assert.rejects(()=>migrateCms(raced),{code:'MIGRATION_REQUIRED'});
      assert.deepEqual(await snapshot(database),before);
    } finally {await storage.close();}
  });
}
