// Original PR #42 bounded final-review guard matrix; zero source credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sql, type CompiledQuery } from 'kysely';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import type { CmsDatabase } from '../src/lib/server/database/contract.ts';
import { SchemaRegistry } from '../src/lib/server/database/registry.ts';
import { schemaAdminStorage } from './helpers/schema-admin-storage.ts';
import { databaseSnapshot, installVersion4, legacyPost } from './helpers/lifecycle-startup.ts';

async function prepare(database:CmsDatabase, stage:'fresh'|'v4'|'v5', race:boolean) {
  if (stage==='v4') {await installVersion4(database); await legacyPost(database);}
  if (stage==='v5') {
    await migrateCms(database);
    const registry=new SchemaRegistry(database);
    await registry.createCollection({slug:'post',label:'Posts'});
    await registry.createField('post',{slug:'title',label:'Title',type:'string'});
    // Latest startup can still write a missing historical trash index. Its
    // atomic repair must guard the same known-layout invariants as v5 upgrade.
    if (race) await sql`DROP INDEX idx_ec_post_deleted_status`.execute(database.db);
  }
}

async function seedInvalidForeignKey(database:CmsDatabase, target:'Node'|'D1', statement:CompiledQuery) {
  if (target==='Node') {
    await sql`PRAGMA foreign_keys=OFF`.execute(database.db);
    try {await database.atomicBatch([statement]);}
    finally {await sql`PRAGMA foreign_keys=ON`.execute(database.db);}
  } else await database.atomicBatch([
    sql`PRAGMA defer_foreign_keys=ON`.compile(database.db),statement,
    sql`PRAGMA defer_foreign_keys=OFF`.compile(database.db)
  ]);
}

async function rejectsUnchanged(database:CmsDatabase, create:()=>Promise<void>, race:boolean) {
  if (!race) await create();
  let before=await databaseSnapshot(database); let batches=0;
  const subject={...database,async atomicBatch(statements:CompiledQuery[]) {
    batches++;
    if (race) {await create(); before=await databaseSnapshot(database);}
    return database.atomicBatch(statements);
  }};
  let result:unknown='success';
  try {await migrateCms(subject);} catch (cause) {result=(cause as {code?:unknown;message?:unknown}).code??(cause as {message?:unknown}).message;}
  assert.equal(result,'MIGRATION_REQUIRED');
  assert.equal(batches,race ? 1 : 0);
  assert.deepEqual(await databaseSnapshot(database),before);
  await assert.rejects(()=>migrateCms(database),{code:'MIGRATION_REQUIRED'});
  assert.deepEqual(await databaseSnapshot(database),before);
}

for (const target of ['Node','D1'] as const) {
  for (const stage of ['fresh','v4','v5'] as const) {
    for (const race of [false,true]) {
      for (const kind of ['table','view','index'] as const) {
        test(`${target}: ${stage} ${race?'racing':'preinstalled'} reserved ${kind} names reject in both cases`, async () => {
          for (const name of ['ec_reserved','EC_RESERVED']) {
            const storage=await schemaAdminStorage(target);
            try {
              const database=storage.database;
              await prepare(database,stage,race);
              await sql`CREATE TABLE operator_notes (note TEXT)`.execute(database.db);
              await sql`INSERT INTO operator_notes VALUES ('Retained')`.execute(database.db);
              const create=async () => {
                const statement=kind==='table' ? sql`CREATE TABLE ${sql.id(name)} (note TEXT)` : kind==='view' ?
                  sql`CREATE VIEW ${sql.id(name)} AS SELECT note FROM operator_notes` :
                  sql`CREATE INDEX ${sql.id(name)} ON operator_notes (note)`;
                await statement.execute(database.db);
              };
              await rejectsUnchanged(database,create,race);
            } finally {await storage.close();}
          }
        });
      }
    }

    test(`${target}: ${stage} content-like operator trigger names occupy a separate namespace`, async () => {
      for (const name of ['ec_reserved','EC_RESERVED']) {
        const storage=await schemaAdminStorage(target);
        try {
          const database=storage.database;
          await prepare(database,stage,false);
          await sql`CREATE TABLE operator_notes (note TEXT)`.execute(database.db);
          await sql`CREATE TRIGGER ${sql.id(name)} AFTER INSERT ON operator_notes
            BEGIN UPDATE operator_notes SET note='operator-'||NEW.note WHERE rowid=NEW.rowid; END`.execute(database.db);
          const before=await databaseSnapshot(database);
          await assert.doesNotReject(()=>migrateCms(database));
          assert.deepEqual((await databaseSnapshot(database)).objects.filter(row=>row.type==='trigger'),
            before.objects.filter(row=>row.type==='trigger'));
          await new SchemaRegistry(database).createCollection({slug:'reserved',label:'Reserved'});
          await sql`INSERT INTO operator_notes VALUES ('retained')`.execute(database.db);
          assert.equal((await sql<{note:string}>`SELECT note FROM operator_notes`.execute(database.db)).rows[0]?.note,'operator-retained');
          await assert.doesNotReject(()=>migrateCms(database));
        } finally {await storage.close();}
      }
    });
  }

  for (const stage of ['v4','v5'] as const) {
    test(`${target}: ${stage} attached mixed-case trigger owners retain original SQL and effects`, async () => {
      const storage=await schemaAdminStorage(target);
      try {
        const database=storage.database;
        await prepare(database,stage,false);
        await sql`INSERT INTO ec_post (id,title) VALUES ('retained','Before')`.execute(database.db);
        await sql.raw("CREATE TRIGGER attached_case AFTER UPDATE OF title ON EC_POST BEGIN UPDATE ec_post SET author_id='triggered' WHERE id=NEW.id; END").execute(database.db);
        const before=await databaseSnapshot(database);
        await assert.doesNotReject(()=>migrateCms(database));
        assert.deepEqual((await databaseSnapshot(database)).objects.filter(row=>row.type==='trigger'),
          before.objects.filter(row=>row.type==='trigger'));
        await sql`UPDATE ec_post SET title='After' WHERE id='retained'`.execute(database.db);
        assert.equal((await sql<{author_id:string}>`SELECT author_id FROM ec_post WHERE id='retained'`.execute(database.db)).rows[0]?.author_id,'triggered');
        await assert.doesNotReject(()=>migrateCms(database));
      } finally {await storage.close();}
    });

    for (const race of [false,true]) {
      test(`${target}: ${stage} ${race?'racing':'preinstalled'} orphan field metadata rejects without writes`, async () => {
        const storage=await schemaAdminStorage(target);
        try {
          const database=storage.database;
          await prepare(database,stage,race);
          const field=await database.db.selectFrom('_cms_fields').selectAll().where('slug','=','title').executeTakeFirstOrThrow();
          const seed=database.db.insertInto('_cms_fields').values({...field,id:'orphan-field',collection_id:'missing-collection',slug:'orphan'}).compile();
          const create=async () => {
            await seedInvalidForeignKey(database,target,seed);
            assert.equal((await sql<{collection_id:string}>`SELECT collection_id FROM _cms_fields WHERE id='orphan-field'`.execute(database.db)).rows[0]?.collection_id,'missing-collection');
          };
          await rejectsUnchanged(database,create,race);
        } finally {await storage.close();}
      });
    }

    test(`${target}: ${stage} unmanaged operator FK violations do not reject valid CMS metadata`, async () => {
      const storage=await schemaAdminStorage(target);
      try {
        const database=storage.database;
        await prepare(database,stage,false);
        await sql`CREATE TABLE operator_users (id TEXT PRIMARY KEY)`.execute(database.db);
        await sql`CREATE TABLE operator_links (ec_note TEXT, user_id TEXT REFERENCES operator_users(id))`.execute(database.db);
        await seedInvalidForeignKey(database,target,sql`INSERT INTO operator_links VALUES ('retained','operator-missing')`.compile(database.db));
        const before=await databaseSnapshot(database);
        await assert.doesNotReject(()=>migrateCms(database));
        const after=await databaseSnapshot(database);
        for (const row of before.tables.filter(row=>row.name.startsWith('operator_'))) assert.deepEqual(after.tables.find(other=>other.name===row.name),row);
        for (const row of before.objects.filter(row=>row.name.startsWith('operator_'))) assert.deepEqual(after.objects.find(other=>other.name===row.name),row);
        await assert.doesNotReject(()=>migrateCms(database));
      } finally {await storage.close();}
    });
  }
}
