import test from 'node:test';
import assert from 'node:assert/strict';
import {sql} from 'kysely';
import {schemaAdminStorage} from './helpers/schema-admin-storage.ts';
import {installPrefix,snapshot,seed} from './helpers/metadata-upgrade.ts';
import {migrateCms} from '../src/lib/server/database/migrations.ts';

// Original native atomic-upgrade/operator tests; zero source assertion credit.
for(const target of ['Node','D1'] as const) {
  test(`${target}: upgrade retains attached operator field indexes and triggers verbatim`,async()=>{
    const storage=await schemaAdminStorage(target);const database=storage.database;
    try {
      await installPrefix(database);await seed(database);
      await sql`CREATE TABLE operator_events (field_id TEXT, label TEXT)`.execute(database.db);
      await sql`CREATE INDEX operator_fields_label ON _cms_fields(label)`.execute(database.db);
      await sql`CREATE TRIGGER operator_fields_changed AFTER UPDATE OF label ON _cms_fields
        BEGIN INSERT INTO operator_events VALUES (NEW.id,NEW.label); END`.execute(database.db);
      const before=(await snapshot(database)).objects.filter(object=>object.name.startsWith('operator_fields_'));
      await migrateCms(database);
      assert.deepEqual((await snapshot(database)).objects.filter(object=>object.name.startsWith('operator_fields_')),before);
      await database.db.updateTable('_cms_fields').set({label:'Changed after upgrade'}).execute();
      assert.equal((await sql<{label:string}>`SELECT label FROM operator_events`.execute(database.db)).rows[0].label,'Changed after upgrade');
    } finally {await storage.close();}
  });
  test(`${target}: unrelated operator views, triggers, and rows survive metadata upgrade`,async()=>{
    const storage=await schemaAdminStorage(target);const database=storage.database;
    try {
      await installPrefix(database);await seed(database);
      await sql`CREATE TABLE operator_notes (note TEXT)`.execute(database.db);
      await sql`INSERT INTO operator_notes VALUES ('_cms_fields is a literal, REFERENCES _cms_fields too')`.execute(database.db);
      await sql`CREATE VIEW operator_view AS SELECT note,'_cms_fields' AS literal FROM operator_notes /* FROM _cms_fields */`.execute(database.db);
      await sql`CREATE TRIGGER operator_note_insert AFTER INSERT ON operator_notes BEGIN SELECT '_cms_fields'; END`.execute(database.db);
      const before=await snapshot(database);
      await migrateCms(database);
      const after=await snapshot(database);
      assert.deepEqual(after.objects.filter(object=>object.name.startsWith('operator_')),before.objects.filter(object=>object.name.startsWith('operator_')));
      assert.deepEqual(after.tables.find(table=>table.name==='operator_notes'),before.tables.find(table=>table.name==='operator_notes'));
    } finally {await storage.close();}
  });
  for(const action of ['CASCADE','RESTRICT','SET NULL'] as const) {
    test(`${target}: external foreign child ${action} rejects before destructive field rebuilding`,async()=>{
      const storage=await schemaAdminStorage(target);const database=storage.database;
      try {
        await installPrefix(database);await seed(database);
        await sql.raw('CREATE TABLE operator_children (id TEXT PRIMARY KEY,field_id TEXT REFERENCES "_cms_fields"(id) ON DELETE '+action+')').execute(database.db);
        await sql`INSERT INTO operator_children SELECT 'child',id FROM _cms_fields LIMIT 1`.execute(database.db);
        const before=await snapshot(database);
        await assert.rejects(()=>migrateCms(database),{code:'MIGRATION_REQUIRED'});
        assert.deepEqual(await snapshot(database),before);
      } finally {await storage.close();}
    });
  }
  for(const ddl of [
    'CREATE VIEW operator_view AS SELECT id FROM "main"."_cms_fields"',
    'CREATE VIEW operator_view AS SELECT id FROM ([_cms_fields])',
    'CREATE VIEW operator_view AS WITH items AS (SELECT id FROM `_CMS_fields`) SELECT * FROM items',
    'CREATE TRIGGER operator_dependency AFTER INSERT ON operator_notes BEGIN INSERT INTO operator_notes SELECT id FROM _cms_fields; END'
  ]) {
    test(`${target}: real external metadata dependency rejects before atomic DDL (${ddl.split(' AS ')[0]})`,async()=>{
      const storage=await schemaAdminStorage(target);const database=storage.database;
      try {
        await installPrefix(database);await seed(database);
        await sql`CREATE TABLE operator_notes (note TEXT)`.execute(database.db);
        await sql.raw(ddl).execute(database.db);
        const before=await snapshot(database);
        await assert.rejects(()=>migrateCms(database),{code:'MIGRATION_REQUIRED'});
        assert.deepEqual(await snapshot(database),before);
      } finally {await storage.close();}
    });
  }
  test(`${target}: preflight-to-batch operator cascade race rejects and retains the independently committed child`,async()=>{
    const storage=await schemaAdminStorage(target);const database=storage.database;
    try {
      await installPrefix(database);await seed(database);let before:Awaited<ReturnType<typeof snapshot>>|undefined;
      const raced={...database,async atomicBatch(statements:Parameters<typeof database.atomicBatch>[0]) {
        await sql`CREATE TABLE operator_children (field_id TEXT REFERENCES _cms_fields(id) ON DELETE CASCADE)`.execute(database.db);
        await sql`INSERT INTO operator_children SELECT id FROM _cms_fields`.execute(database.db);
        before=await snapshot(database);
        return database.atomicBatch(statements);
      }};
      await assert.rejects(()=>migrateCms(raced),{code:'MIGRATION_REQUIRED'});
      assert.deepEqual(await snapshot(database),before);
    } finally {await storage.close();}
  });
}
