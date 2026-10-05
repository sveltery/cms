// Supplemental actual Node/raw-D1 transaction and Source080 operator contracts.
// Whole pinned Source bodies and previous witness remain unchanged.
import { expect, it } from 'vitest';
import { sql, type CompiledQuery } from 'kysely';
import type { CmsDatabase } from '../../../src/lib/server/database/contract.ts';
import { openSqlite } from '../../../src/lib/server/database/sqlite.ts';
import { localD1 } from '../../helpers/local-d1-fixture.ts';
import { CMS_MIGRATIONS, migrateCms } from '../../../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../../../src/lib/server/database/registry.ts';
import { collectionStandardIndexesMigration } from '../../../src/lib/server/database/collection-index-migration.ts';

async function historical(database:CmsDatabase,version=15) {
  await sql`CREATE TABLE _cms_migrations (version INTEGER PRIMARY KEY CHECK(version > 0))`.execute(database.db);
  for(const provider of CMS_MIGRATIONS.filter(provider=>provider.version<=version)) {
    await database.atomicBatch([...await provider.statements(database),
      sql`INSERT INTO _cms_migrations(version) VALUES(${sql.lit(provider.version)})`.compile(database.db)]);
  }
  await new SchemaRegistry(database).createCollection({slug:'posts',label:'Posts'});
  await sql`INSERT INTO _cms_taxonomies(id,name,slug,label) VALUES('term','tags','news','News')`.execute(database.db);
  await sql`INSERT INTO _cms_content_taxonomies(collection,entry_id,taxonomy_id) VALUES('posts','g','term')`.execute(database.db);
  for(const id of ['g','b','c']) await sql`INSERT INTO ec_posts(id,slug,status,translation_group,locale,created_at)
    VALUES(${id},${id},'draft','g','en','2000-01-01')`.execute(database.db);
}
async function repaired(database:CmsDatabase) {
  expect((await sql`SELECT id,translation_group FROM ec_posts ORDER BY id`.execute(database.db)).rows).toEqual([
    {id:'b',translation_group:'b'},{id:'c',translation_group:'c'},{id:'g',translation_group:'g'}]);
  expect((await sql`SELECT entry_id,taxonomy_id FROM _cms_content_taxonomies ORDER BY entry_id`.execute(database.db)).rows).toEqual([
    {entry_id:'b',taxonomy_id:'term'},{entry_id:'c',taxonomy_id:'term'},{entry_id:'g',taxonomy_id:'term'}]);
}
async function snapshot(database:CmsDatabase) {
  return {rows:(await sql`SELECT * FROM ec_posts ORDER BY id`.execute(database.db)).rows,
    markers:(await sql`SELECT version FROM _cms_migrations ORDER BY version`.execute(database.db)).rows,
    catalogue:(await sql<{name:string;type:string;sql:string|null}>`SELECT name,type,sql FROM sqlite_master ORDER BY name,type`.execute(database.db)).rows};
}

it('Node preserves real operator rereads through an ordinary shallow compiled-query wrapper',async()=>{
  const native=openSqlite(':memory:');
  try {
    await historical(native);
    await sql`CREATE TRIGGER operator_move_group AFTER UPDATE OF translation_group ON ec_posts WHEN NEW.id='b'
      BEGIN UPDATE ec_posts SET translation_group='b' WHERE id='c'; END`.execute(native.db);
    const wrapped:CmsDatabase={...native,atomicBatch:queries=>native.atomicBatch(queries.map(query=>({...query})))};
    await expect(migrateCms(wrapped)).resolves.toBeUndefined();
    await repaired(native);
  }finally{await native.close();}
});

it('Node rereads real mutations from the preceding published provider15 marker write',async()=>{
  const database=openSqlite(':memory:');
  try {
    await historical(database,14);
    await sql`UPDATE ec_posts SET translation_group=id`.execute(database.db);
    await sql`CREATE TRIGGER operator_after_provider AFTER INSERT ON _cms_migrations WHEN NEW.version=15
      BEGIN UPDATE ec_posts SET translation_group='g' WHERE id IN ('b','c'); END`.execute(database.db);
    // Public migrateCms separately refuses indirect content dependencies in
    // its unchanged lifecycle guard. Exercise the actual owned provider plans
    // through their genuine atomic adapter, without relaxing that guard.
    const provider15=CMS_MIGRATIONS.find(provider=>provider.version===15)!;
    const earlier=await provider15.prepare!(database);
    const indexes=await collectionStandardIndexesMigration.prepare!(database);
    await expect(database.atomicBatch([...earlier.guards,...indexes.guards,...earlier.statements,
      sql`INSERT INTO _cms_migrations(version) VALUES(15)`.compile(database.db),...indexes.statements,
      sql`INSERT INTO _cms_migrations(version) VALUES(16)`.compile(database.db)])).resolves.toBeDefined();
    await repaired(database);
    expect((await sql`SELECT version FROM _cms_migrations ORDER BY version`.execute(database.db)).rows).toHaveLength(16);
  }finally{await database.close();}
});

it('raw D1 refuses mutation-dependent indirect operators while retaining all triggers and storage',async()=>{
  const fixture=await localD1();const database=fixture.database;
  try {
    await historical(database);
    await sql`CREATE TABLE operator_queue(id TEXT)`.execute(database.db);
    await sql`CREATE TRIGGER indirect_operator AFTER INSERT ON operator_queue
      BEGIN UPDATE ec_posts SET translation_group='b' WHERE id='c'; END`.execute(database.db);
    await sql`CREATE TRIGGER enqueue_from_pivot AFTER INSERT ON _cms_content_taxonomies WHEN NEW.entry_id='b'
      BEGIN INSERT INTO operator_queue(id) VALUES('run'); END`.execute(database.db);
    const before=await snapshot(database);
    const plan=await collectionStandardIndexesMigration.prepare!(database);
    await expect(database.atomicBatch([...plan.guards,...plan.statements])).rejects.toThrow('sveltery-cms-collection-index-prerequisite-changed');
    expect(await snapshot(database)).toEqual(before);
    expect(before.catalogue.filter(row=>String(row.name).startsWith('_cms_options_revision_'))).toHaveLength(2);
  }finally{await database.close();await fixture.runtime.dispose();}
});

it('raw D1 checks projected rows at the actual provider position and rolls back earlier batch writes',async()=>{
  const fixture=await localD1();const database=fixture.database;
  try {
    await historical(database);
    const before=await snapshot(database);
    const plan=await collectionStandardIndexesMigration.prepare!(database);
    const queries:CompiledQuery[]=[...plan.guards,
      sql`UPDATE ec_posts SET translation_group='b' WHERE id='c'`.compile(database.db),...plan.statements];
    await expect(database.atomicBatch(queries)).rejects.toThrow('sveltery-cms-collection-index-prerequisite-changed');
    expect(await snapshot(database)).toEqual(before);
  }finally{await database.close();await fixture.runtime.dispose();}
});

it('Node refuses a serialized dynamic operation instead of silently running its SELECT once',async()=>{
  const database=openSqlite(':memory:');
  try {
    await historical(database);
    const before=await snapshot(database);
    const plan=await collectionStandardIndexesMigration.prepare!(database);
    const copied=JSON.parse(JSON.stringify([...plan.guards,...plan.statements])) as CompiledQuery[];
    await expect(database.atomicBatch(copied)).rejects.toMatchObject({code:'MIGRATION_REQUIRED'});
    expect(await snapshot(database)).toEqual(before);
  }finally{await database.close();}
});
