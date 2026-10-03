import test from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import { schemaAdminStorage } from './helpers/schema-admin-storage.ts';
import { CMS_MIGRATIONS, CMS_MIGRATION_VERSION, migrateCms } from '../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../src/lib/server/database/registry.ts';
import type { CmsDatabase } from '../src/lib/server/database/contract.ts';

// Original forward-upgrade regressions, derived from immutable EmDash migrations
// 003_schema_registry (ON DELETE CASCADE) and 012_search (nullable TEXT).
// These are supplemental physical-provider assertions, not whole-source tests.
async function installPrefix(database: CmsDatabase, version = 7) {
  const statements = [sql`CREATE TABLE _cms_migrations (version INTEGER PRIMARY KEY CHECK(version > 0))`.compile(database.db)];
  for (const provider of CMS_MIGRATIONS.filter(provider => provider.version <= version)) {
    statements.push(...await provider.statements(database),
      sql`INSERT INTO _cms_migrations(version) VALUES (${provider.version})`.compile(database.db));
  }
  await database.atomicBatch(statements);
}
async function snapshot(database: CmsDatabase) {
  const objects = (await sql<{name:string;type:string;sql:string|null}>`SELECT name,type,sql FROM sqlite_master ORDER BY name,type`.execute(database.db)).rows;
  const tables = [];
  for (const object of objects.filter(object => object.type === 'table' && !object.name.startsWith('sqlite_') && !object.name.startsWith('_cf_'))) {
    tables.push({name: object.name, rows: (await sql`SELECT * FROM ${sql.id(object.name)} ORDER BY rowid`.execute(database.db)).rows});
  }
  return {objects, tables};
}
async function seed(database: CmsDatabase) {
  const registry = new SchemaRegistry(database);
  await registry.createCollection({slug:'posts', label:'Posts', supports:[]});
  await registry.createField('posts', {slug:'title', label:'Title', type:'string', required:true, unique:true,
    defaultValue:'Physical default', validation:{maxLength:150}, searchable:true, indexed:true, translatable:false,
    widget:'textarea', options:{placeholder:'Retained placeholder'}});
  await database.db.updateTable('_cms_fields').set({default_value:JSON.stringify('Later metadata default')}).execute();
  await sql`INSERT INTO ec_posts(id,title) VALUES ('entry','Retained content')`.execute(database.db);
  await database.db.insertInto('_cms_auth_users').values({id:'owner',role:50,disabled:0}).execute();
  await sql`INSERT INTO options(name,value,revision) VALUES ('site_title','"Retained site"','retained-revision')`.execute(database.db);
  return registry;
}

for (const target of ['Node','D1'] as const) {
  test(`${target}: canonical fresh metadata uses pinned cascading collection foreign key`, async () => {
    const storage = await schemaAdminStorage(target);
    try {
      await migrateCms(storage.database);
      const foreignKeys = (await sql<{table:string;from:string;to:string;on_delete:string}>`PRAGMA foreign_key_list(_cms_fields)`.execute(storage.database.db)).rows;
      assert.deepEqual(foreignKeys.map(({table,from,to,on_delete}) => ({table,from,to,on_delete})),
        [{table:'_cms_collections',from:'collection_id',to:'id',on_delete:'CASCADE'}]);
    } finally { await storage.close(); }
  });
  test(`${target}: fresh collections store nullable unconfigured search metadata`, async () => {
    const storage = await schemaAdminStorage(target);
    try {
      await migrateCms(storage.database);
      const columns = (await sql<{name:string;type:string;notnull:number;dflt_value:string|null}>`PRAGMA table_info(_cms_collections)`.execute(storage.database.db)).rows;
      const search = columns.find(column => column.name === 'search_config');
      assert.ok(search, 'canonical search_config must exist');
      assert.deepEqual({type:search.type,notnull:search.notnull,default:search.dflt_value}, {type:'TEXT',notnull:0,default:null});
      await new SchemaRegistry(storage.database).createCollection({slug:'posts',label:'Posts'});
      assert.equal((await sql<{search_config:string|null}>`SELECT search_config FROM _cms_collections`.execute(storage.database.db)).rows[0].search_config,null);
    } finally { await storage.close(); }
  });
  test(`${target}: actual prefix7 upgrades preserve every existing row and content physical defaults`, async () => {
    const storage = await schemaAdminStorage(target); const database=storage.database;
    try {
      await installPrefix(database); await seed(database);
      const before=await snapshot(database);
      await migrateCms(database); await migrateCms(database);
      assert.equal(CMS_MIGRATION_VERSION,8);
      const after=await snapshot(database);
      for (const table of before.tables) {
        if (table.name==='_cms_migrations') continue;
        const rows=after.tables.find(value=>value.name===table.name)!.rows;
        assert.deepEqual(rows,table.name==='_cms_collections' ? table.rows.map(row=>({...row,search_config:null})) : table.rows,table.name);
      }
      assert.equal(after.objects.find(object=>object.name==='ec_posts')!.sql,before.objects.find(object=>object.name==='ec_posts')!.sql);
      assert.deepEqual((await database.db.selectFrom('_cms_migrations').select('version').orderBy('version').execute()).map(row=>row.version),[1,2,3,4,5,6,7,8]);
      await sql`DROP TABLE ec_posts`.execute(database.db);
      await assert.doesNotReject(()=>database.db.deleteFrom('_cms_collections').where('slug','=','posts').execute());
      assert.deepEqual(await database.db.selectFrom('_cms_fields').selectAll().execute(),[]);
    } finally { await storage.close(); }
  });
}

export {installPrefix,snapshot,seed};
