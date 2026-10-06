// Supplemental actual canonical Node/D1 storage controls. Zero Original callback credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import { schemaAdminStorage } from '../helpers/schema-admin-storage.ts';
import { databaseSnapshot } from '../helpers/lifecycle-startup.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../../src/lib/server/database/registry.ts';
import { EntryLockRepository } from '../../src/lib/server/entry-locks/repository.ts';

for (const mode of ['Node', 'D1'] as const) {
  test(mode + ': normal startup installs the complete Source075 layout with the canonical identity owner', async t => {
    const fixture = await schemaAdminStorage(mode); t.after(fixture.close);
    await migrateCms(fixture.database);
    const columns = (await sql<{name:string;type:string;notnull:number;dflt_value:string|null;pk:number}>`PRAGMA table_info(_cms_entry_locks)`.execute(fixture.database.db)).rows;
    assert.deepEqual(columns.map(row => ({...row})), ['collection','entry_id','user_id','token','acquired_at','expires_at'].map((name,index) => ({cid:index,name,type:'TEXT',notnull:1,dflt_value:null,pk:index<2?index+1:0})));
    const foreign = (await sql<{table:string;from:string;to:string;on_delete:string}>`PRAGMA foreign_key_list(_cms_entry_locks)`.execute(fixture.database.db)).rows;
    assert.deepEqual(foreign.map(({table,from,to,on_delete}) => ({table,from,to,on_delete})), [{table:'_cms_auth_users',from:'user_id',to:'id',on_delete:'CASCADE'}]);
    assert.deepEqual((await sql<{name:string}>`PRAGMA index_info(idx_cms_entry_locks_user_id)`.execute(fixture.database.db)).rows.map(row=>row.name), ['user_id']);
    const collectionColumns = (await sql<{name:string;notnull:number;dflt_value:string}>`PRAGMA table_info(_cms_collections)`.execute(fixture.database.db)).rows;
    assert.equal(collectionColumns.filter(row=>row.name==='edit_locking').length,1);
    assert.equal(collectionColumns.find(row=>row.name==='edit_locking')!.dflt_value,'1');
  });

  test(mode + ': sole repository preserves holders, same-account tokens, refresh and both release paths', async t => {
    const fixture = await schemaAdminStorage(mode); t.after(fixture.close);
    await migrateCms(fixture.database);
    await sql`INSERT INTO _cms_auth_users(id,role,disabled) VALUES('ada',40,0),('linus',40,0)`.execute(fixture.database.db);
    await sql`INSERT INTO _cms_auth_profiles(user_id,email,name,created_at,updated_at) VALUES('ada','ada@example.invalid','Ada',strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now'))`.execute(fixture.database.db);
    const repo = new EntryLockRepository(fixture.database);
    const first = await repo.acquire({collection:'posts',entryId:'entry',userId:'ada',token:'first',leaseSeconds:420});
    assert.equal(first.outcome,'acquired'); assert.equal(first.lock.userName,'Ada');
    const held = await repo.acquire({collection:'posts',entryId:'entry',userId:'linus',token:'other',leaseSeconds:420});
    assert.equal(held.outcome,'held'); assert.deepEqual(held.lock,first.lock);
    const next = await repo.acquire({collection:'posts',entryId:'entry',userId:'ada',token:'latest',leaseSeconds:420});
    assert.equal(next.lock.acquiredAt,first.lock.acquiredAt);
    assert.equal(await repo.refreshHeld({collection:'posts',entryId:'entry',userId:'linus',leaseSeconds:420}),false);
    assert.equal(await repo.refreshHeld({collection:'posts',entryId:'entry',userId:'ada',leaseSeconds:420}),true);
    assert.equal(await repo.release({collection:'posts',entryId:'entry',userId:'ada',token:'first'}),false);
    assert.equal((await repo.findLive('posts','entry'))!.userId,'ada');
    assert.equal(await repo.release({collection:'posts',entryId:'entry',userId:'ada',token:'latest'}),true);
    assert.equal(await repo.findLive('posts','entry'),null);
    await repo.acquire({collection:'posts',entryId:'entry',userId:'linus',token:'new',leaseSeconds:420});
    assert.equal((await repo.findLive('posts','entry'))!.userName,null);
    await repo.releaseEntry('posts','entry'); assert.equal(await repo.findLive('posts','entry'),null);
  });

  test(mode + ': an unknown pre-provider lock table is refused before any ordinary startup write', async t => {
    const fixture = await schemaAdminStorage(mode); t.after(fixture.close);
    await sql`CREATE TABLE _cms_entry_locks (operator_note TEXT NOT NULL)`.execute(fixture.database.db);
    await sql`INSERT INTO _cms_entry_locks VALUES ('retained operator data')`.execute(fixture.database.db);
    const before = await databaseSnapshot(fixture.database);
    let batches=0;
    await assert.rejects(()=>migrateCms({...fixture.database,async atomicBatch(statements){batches++;return fixture.database.atomicBatch(statements);}}),{code:'MIGRATION_REQUIRED'});
    assert.equal(batches,0); assert.deepEqual(await databaseSnapshot(fixture.database),before);
  });

  test(mode + ': collection optout, expiration and explicit takeover use the actual sole repository', async t => {
    const fixture = await schemaAdminStorage(mode); t.after(fixture.close);
    await migrateCms(fixture.database);
    await new SchemaRegistry(fixture.database).createCollection({slug:'posts',label:'Posts'});
    await sql`INSERT INTO _cms_auth_users(id,role,disabled) VALUES('ada',40,0),('linus',40,0)`.execute(fixture.database.db);
    const repo=new EntryLockRepository(fixture.database);
    await repo.acquire({collection:'posts',entryId:'entry',userId:'ada',token:'first',leaseSeconds:420});
    assert.equal((await repo.findEnforceable('posts','entry'))!.userId,'ada');
    await sql`UPDATE _cms_collections SET edit_locking=0 WHERE slug='posts'`.execute(fixture.database.db);
    assert.equal(await repo.findEnforceable('posts','entry'),null);
    assert.equal((await repo.findLive('posts','entry'))!.userId,'ada');
    await sql`UPDATE _cms_collections SET edit_locking=1 WHERE slug='posts'`.execute(fixture.database.db);
    const takeover=await repo.acquire({collection:'posts',entryId:'entry',userId:'linus',token:'taken',leaseSeconds:420,takeover:true});
    assert.equal(takeover.outcome,'acquired'); assert.equal(takeover.lock.userId,'linus');
    await sql`UPDATE _cms_entry_locks SET expires_at='2020-01-01T00:00:00.000Z' WHERE collection='posts' AND entry_id='entry'`.execute(fixture.database.db);
    assert.equal(await repo.findLive('posts','entry'),null);
    assert.equal(await repo.refreshHeld({collection:'posts',entryId:'entry',userId:'linus',leaseSeconds:420}),false);
    const next=await repo.acquire({collection:'posts',entryId:'entry',userId:'ada',token:'after-expiry',leaseSeconds:420});
    assert.equal(next.outcome,'acquired'); assert.equal(next.lock.userId,'ada');
    assert.equal(await repo.release({collection:'posts',entryId:'entry',userId:'ada'}),true);
    await assert.rejects(()=>repo.acquire({collection:'posts',entryId:'entry',userId:'missing',token:'orphan',leaseSeconds:420}),/(?:FOREIGN KEY|foreign key)/);
    await repo.acquire({collection:'posts',entryId:'entry',userId:'ada',token:'cascade',leaseSeconds:420});
    await sql`DELETE FROM _cms_auth_users WHERE id='ada'`.execute(fixture.database.db);
    assert.equal(await repo.findLive('posts','entry'),null);
  });

  test(mode + ': real late-batch failure rolls back the sole lock provider and all ordinary markers', async t => {
    const fixture = await schemaAdminStorage(mode); t.after(fixture.close);
    const before = await databaseSnapshot(fixture.database);
    let reached=false;
    await assert.rejects(()=>migrateCms({...fixture.database,async atomicBatch(statements){
      reached=statements.some(statement=>statement.sql.includes('create table "_cms_entry_locks"'));
      return fixture.database.atomicBatch([...statements,sql`SELECT json_extract('[]','entry-lock-provider-late-failure')`.compile(fixture.database.db)]);
    }}),/(?:JSON path|json path)/i);
    assert.equal(reached,true); assert.deepEqual(await databaseSnapshot(fixture.database),before);
    await migrateCms(fixture.database);
    assert.equal((await sql<{version:number}>`SELECT MAX(version) AS version FROM _cms_migrations`.execute(fixture.database.db)).rows[0].version,19);
  });
}
