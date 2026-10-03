import test from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import { openSqlite } from '../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../src/lib/server/database/registry.ts';
import { schemaAdminStorage } from './helpers/schema-admin-storage.ts';

// Supplemental persistence case for the source deleteField columnExists contract.
// A legacy bound reference can retain its pre-binding physical column.
test('deleting a bound legacy reference drops its retained physical column before reusing its slug', async () => {
  const database = openSqlite(':memory:');
  try {
    await migrateCms(database); const registry = new SchemaRegistry(database);
    await registry.createCollection({ slug: 'posts', label: 'Posts' });
    await registry.createField('posts', { slug: 'related', label: 'Related', type: 'string' });
    await sql`UPDATE _cms_fields SET type = 'reference', validation = '{"relation":"posts_related","relationSide":"parent","targetCollection":"posts"}' WHERE slug = 'related'`.execute(database.db);
    await registry.deleteField('posts', 'related');
    const columns = (await sql<{name:string}>`PRAGMA table_info(ec_posts)`.execute(database.db)).rows;
    assert.equal(columns.some(column => column.name === 'related'), false);
    await registry.createField('posts', { slug: 'related', label: 'Reused', type: 'string' });
    assert.equal((await registry.getField('posts', 'related'))!.type, 'string');
  } finally { await database.close(); }
});

for (const target of ['Node','D1'] as const) {
  for (const action of ['CASCADE','RESTRICT'] as const) {
    test(`${target}: forced collection deletion preserves the pinned external FK ${action} behavior`,async()=>{
      const h=await schemaAdminStorage(target);
      try {
        await migrateCms(h.database); const registry=new SchemaRegistry(h.database); const db=h.database.db;
        await registry.createCollection({slug:'posts',label:'Posts'});
        await sql`INSERT INTO ec_posts(id) VALUES ('entry')`.execute(db);
        await sql.raw('CREATE TABLE operator_links(id TEXT PRIMARY KEY,entry_id TEXT REFERENCES ec_posts(id) ON DELETE '+action+')').execute(db);
        await sql`INSERT INTO operator_links VALUES ('link','entry')`.execute(db);
        if(action==='CASCADE'){
          await registry.deleteCollection('posts',{force:true});
          assert.equal((await sql`SELECT * FROM operator_links`.execute(db)).rows.length,0);
          assert.equal(await registry.getCollection('posts'),null);
        }else{
          await assert.rejects(()=>registry.deleteCollection('posts',{force:true}),/FOREIGN KEY constraint failed/);
          assert.equal((await sql`SELECT * FROM operator_links`.execute(db)).rows.length,1);
          assert.equal((await sql`SELECT * FROM ec_posts`.execute(db)).rows.length,1);
          assert.ok(await registry.getCollection('posts'));
        }
      }finally{await h.close();}
    });
  }
}

for (const force of [false,true]) test(`local collection delete CAS reports conflict inside the atomic batch, force=${force}`,async()=>{
  const database=openSqlite(':memory:');
  try {
    await migrateCms(database); const registry=new SchemaRegistry(database);
    const c=await registry.createCollection({slug:'posts',label:'Posts'});
    const original=database.atomicBatch.bind(database);
    database.atomicBatch=async statements=>{
      database.atomicBatch=original;
      await database.db.updateTable('_cms_collections').set({updated_at:'2999-01-01T00:00:00.000Z'}).where('slug','=','posts').execute();
      return original(statements);
    };
    await assert.rejects(()=>registry.deleteCollection('posts',{force},{version:c.version,updatedAt:c.updatedAt}),{code:'CONFLICT'});
    assert.ok(await registry.getCollection('posts'));
    assert.equal((await sql`SELECT * FROM sqlite_master WHERE name='ec_posts'`.execute(database.db)).rows.length,1);
    assert.equal((await database.db.selectFrom('_cms_guards').selectAll().execute()).length,0);
  }finally{await database.close();}
});
