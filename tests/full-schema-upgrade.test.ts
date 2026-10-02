import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sql} from 'kysely';
import {openSqlite} from '../src/lib/server/database/sqlite.ts';
import {migrateCms,CMS_MIGRATION_VERSION} from '../src/lib/server/database/migrations.ts';
import {authSchemaStatements} from '../src/lib/server/auth/schema.ts';
import {SchemaRegistry} from '../src/lib/server/database/registry.ts';
import {DraftRepository} from '../src/lib/server/database/entries.ts';

async function legacy(version:1|2) {
  const database=openSqlite(':memory:');
  for(const statement of JSON.parse(readFileSync(new URL('./fixtures/cms-v1.json',import.meta.url),'utf8'))) await sql.raw(statement).execute(database.db);
  if(version===2) await database.atomicBatch([
    ...authSchemaStatements(database.db.$pickTables<'_cms_auth_users'|'_cms_auth_sessions'>()),
    sql`ALTER TABLE _cms_migrations RENAME TO _cms_migrations_v1`.compile(database.db),
    sql`CREATE TABLE _cms_migrations (version INTEGER PRIMARY KEY CHECK(version IN (1, 2)))`.compile(database.db),
    sql`INSERT INTO _cms_migrations VALUES (1),(2)`.compile(database.db),sql`DROP TABLE _cms_migrations_v1`.compile(database.db)
  ]);
  return database;
}
async function snapshot(database:ReturnType<typeof openSqlite>) {
  const objects=(await sql<{name:string;type:string;sql:string}>`SELECT name,type,sql FROM sqlite_master ORDER BY name`.execute(database.db)).rows;
  const tables=[];
  for(const object of objects.filter(object=>object.type==='table'&&!object.name.startsWith('sqlite_'))) tables.push({name:object.name,rows:(await sql`SELECT * FROM ${sql.ref(object.name)} ORDER BY rowid`.execute(database.db)).rows});
  return {objects,tables};
}
for(const version of [1,2] as const) test(`version ${version} metadata upgrade retains physical columns, rows, and divergent legacy defaults`,async()=>{
  const database=await legacy(version);
  try {
    const registry=new SchemaRegistry(database);const entries=new DraftRepository(database);
    await registry.createCollection({slug:'posts',label:'Posts'});
    await registry.createField('posts',{slug:'title',label:'Title',type:'string',required:true,unique:true,defaultValue:'Physical original'});
    await sql`UPDATE _cms_fields SET default_value = ${JSON.stringify('Metadata changed')}`.execute(database.db);
    const entry=await entries.create({type:'posts',data:{title:'Retained content'}},'owner');
    const before=await registry.getCollectionWithFields('posts');
    const contentDdl=(await sql<{sql:string}>`SELECT sql FROM sqlite_master WHERE name='ec_posts'`.execute(database.db)).rows[0].sql;
    if(version===2) await database.db.insertInto('_cms_auth_users').values({id:'owner',role:30,disabled:0}).execute();
    await migrateCms(database);await migrateCms(database);
    assert.deepEqual(await registry.getCollectionWithFields('posts'),before);
    assert.deepEqual(await entries.findById('posts',entry.id),entry);
    assert.equal((await sql<{sql:string}>`SELECT sql FROM sqlite_master WHERE name='ec_posts'`.execute(database.db)).rows[0].sql,contentDdl);
    assert.equal((await database.db.selectFrom('_cms_migrations').selectAll().execute()).length,CMS_MIGRATION_VERSION);
    assert.deepEqual(await database.db.selectFrom('_cms_auth_profiles').selectAll().execute(),[]);
    if(version===2) assert.equal((await database.db.selectFrom('_cms_auth_users').selectAll().execute())[0].id,'owner');
  } finally {await database.close();}
});
test('failure during each new metadata/identity DDL restores the exact legacy schema and rows',async()=>{
  for(const needle of ['CREATE TABLE "_cms_collections_v3"','CREATE TABLE "_cms_fields_v3"','DROP TABLE _cms_fields','DROP TABLE _cms_collections','CREATE TABLE _cms_auth_profiles','CREATE TABLE _cms_auth_credentials','CREATE TABLE _cms_auth_setup']) {
    const database=await legacy(2);
    try {
      const before=await snapshot(database);
      const failing={...database,async atomicBatch(statements:Parameters<typeof database.atomicBatch>[0]) {
        const index=statements.findIndex(statement=>statement.sql.includes(needle));assert.ok(index>=0,needle);
        return database.atomicBatch([...statements.slice(0,index+1),sql`SELECT * FROM full_schema_failure_probe`.compile(database.db),...statements.slice(index+1)]);
      }};
      await assert.rejects(()=>migrateCms(failing),/full_schema_failure_probe/);
      assert.deepEqual(await snapshot(database),before);await migrateCms(database);
    } finally {await database.close();}
  }
});
test('incomplete identity layouts and temporary metadata objects reject without repair',async()=>{
  for(const mode of ['missing-profile','wrong-credential-index','temporary-copy']) {
    const database=openSqlite(':memory:');
    try {
      await migrateCms(database);
      if(mode==='missing-profile') await sql`DROP TABLE _cms_auth_profiles`.execute(database.db);
      if(mode==='wrong-credential-index') {await sql`DROP INDEX idx_cms_auth_credentials_user`.execute(database.db);await sql`CREATE INDEX idx_cms_auth_credentials_user ON _cms_auth_credentials(name)`.execute(database.db);}
      if(mode==='temporary-copy') await sql`CREATE TABLE _cms_fields_v3 (retained TEXT)`.execute(database.db);
      const before=await snapshot(database);await assert.rejects(()=>migrateCms(database),{code:'MIGRATION_REQUIRED'});assert.deepEqual(await snapshot(database),before);
    } finally {await database.close();}
  }
});
