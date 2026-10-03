import {sql} from 'kysely';
import {CMS_MIGRATIONS} from '../../src/lib/server/database/migrations.ts';
import {SchemaRegistry} from '../../src/lib/server/database/registry.ts';
import type {CmsDatabase} from '../../src/lib/server/database/contract.ts';

// Historical fixtures run real registered provider statements; only the marker
// table is constructed by this fixture. No alternate metadata DDL is supplied.
export async function installPrefix(database: CmsDatabase, version = 7) {
  const statements = [sql`CREATE TABLE _cms_migrations (version INTEGER PRIMARY KEY CHECK(version > 0))`.compile(database.db)];
  for (const provider of CMS_MIGRATIONS.filter(provider => provider.version <= version)) {
    statements.push(...await provider.statements(database),
      sql`INSERT INTO _cms_migrations(version) VALUES (${provider.version})`.compile(database.db));
  }
  await database.atomicBatch(statements);
}
export async function snapshot(database: CmsDatabase) {
  const objects = (await sql<{name:string;type:string;sql:string|null}>`SELECT name,type,sql FROM sqlite_master ORDER BY name,type`.execute(database.db)).rows;
  const tables = [];
  for (const object of objects.filter(object => object.type === 'table' && !object.name.startsWith('sqlite_') && !object.name.startsWith('_cf_'))) {
    tables.push({name: object.name, rows: (await sql`SELECT * FROM ${sql.id(object.name)} ORDER BY rowid`.execute(database.db)).rows.map(row=>({...row}))});
  }
  return {objects, tables};
}
export async function seed(database: CmsDatabase) {
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

