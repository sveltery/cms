import test from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import { schemaAdminStorage } from './helpers/schema-admin-storage.ts';
import { CMS_MIGRATION_VERSION, migrateCms } from '../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../src/lib/server/database/registry.ts';

// Original forward-upgrade regressions, derived from immutable EmDash migrations
// 003_schema_registry (ON DELETE CASCADE) and 012_search (nullable TEXT).
// These are supplemental physical-provider assertions, not whole-source tests.
import {installPrefix,snapshot,seed} from './helpers/metadata-upgrade.ts';

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
      assert.equal(CMS_MIGRATION_VERSION,10);
      const after=await snapshot(database);
      for (const table of before.tables) {
        if (table.name==='_cms_migrations') continue;
        const rows=after.tables.find(value=>value.name===table.name)!.rows;
        assert.deepEqual(rows,table.name==='_cms_collections' ? table.rows.map(row=>({...row,search_config:null})) : table.rows,table.name);
      }
      assert.equal(after.objects.find(object=>object.name==='ec_posts')!.sql,before.objects.find(object=>object.name==='ec_posts')!.sql);
      assert.deepEqual((await database.db.selectFrom('_cms_migrations').select('version').orderBy('version').execute()).map(row=>row.version),[1,2,3,4,5,6,7,8,9,10]);
      await sql`DROP TABLE ec_posts`.execute(database.db);
      await assert.doesNotReject(()=>database.db.deleteFrom('_cms_collections').where('slug','=','posts').execute());
      assert.deepEqual(await database.db.selectFrom('_cms_fields').selectAll().execute(),[]);
    } finally { await storage.close(); }
  });
}

