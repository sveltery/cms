// Original PR #42 complete static-prerequisite/marker race matrix; zero source credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import { CMS_MIGRATIONS, migrateCms } from '../src/lib/server/database/migrations.ts';
import type { CmsDatabase } from '../src/lib/server/database/contract.ts';
import { SchemaRegistry } from '../src/lib/server/database/registry.ts';
import { schemaAdminStorage } from './helpers/schema-admin-storage.ts';
import { databaseSnapshot, installHistoricalVersion, installVersion4, legacyPost } from './helpers/lifecycle-startup.ts';

async function prepare(database:CmsDatabase,version:number) {
  if (version===1||version===2) await installHistoricalVersion(database,version);
  if (version===3) {
    await database.atomicBatch([
      sql`CREATE TABLE _cms_migrations (version INTEGER PRIMARY KEY CHECK(version > 0))`.compile(database.db),
      ...await CMS_MIGRATIONS[0].statements(database),sql`INSERT INTO _cms_migrations VALUES (1)`.compile(database.db)
    ]);
    for (const provider of CMS_MIGRATIONS.slice(1,3)) await database.atomicBatch([
      ...await provider.statements(database),sql`INSERT INTO _cms_migrations VALUES (${sql.lit(provider.version)})`.compile(database.db)
    ]);
  }
  if (version===4) {await installVersion4(database);await legacyPost(database);}
  if (version===5) {
    await migrateCms(database);
    await new SchemaRegistry(database).createCollection({slug:'post',label:'Posts'});
    await sql`DROP INDEX idx_ec_post_deleted_status`.execute(database.db);
  }
}

async function rejectRace(database:CmsDatabase,write:()=>Promise<void>) {
  let before:Awaited<ReturnType<typeof databaseSnapshot>>|undefined;let batches=0;
  const subject={...database,async atomicBatch(statements:Parameters<typeof database.atomicBatch>[0]) {
    batches++;await write();before=await databaseSnapshot(database);
    return database.atomicBatch(statements);
  }};
  let result:unknown='success';
  try {await migrateCms(subject);} catch (cause) {result=(cause as {code?:unknown;message?:unknown}).code??(cause as {message?:unknown}).message;}
  assert.equal(result,'MIGRATION_REQUIRED');
  assert.equal(batches,1);
  assert.deepEqual(await databaseSnapshot(database),before);
}

for (const target of ['Node','D1'] as const) {
  for (const version of [0,1,2,3,4,5]) {
    test(`${target}: v${version} every validated static prerequisite DDL is guarded before startup writes`, async () => {
      const reference=await schemaAdminStorage(target);
      let objects:{name:string;type:string;sql:string}[];
      try {
        await prepare(reference.database,version===0 ? 5 : version);
        objects=(await sql<{name:string;type:string;sql:string}>`SELECT name,type,sql FROM sqlite_master
          WHERE name GLOB '_cms_*' OR name GLOB 'idx_cms_*' ORDER BY name`.execute(reference.database.db)).rows;
      } finally {await reference.close();}
      for (const object of objects!) {
        const storage=await schemaAdminStorage(target);
        try {
          const database=storage.database;await prepare(database,version);
          await rejectRace(database,async () => {
            if (version===0) {
              if (object.type==='index') {
                // A fresh known index can be independently created on an
                // operator table; its shared name must remain absent at start.
                await sql`CREATE TABLE operator_notes (note TEXT)`.execute(database.db);
                await sql`CREATE INDEX ${sql.id(object.name)} ON operator_notes (note)`.execute(database.db);
              } else await sql.raw(object.sql).execute(database.db);
            } else if (object.type==='table') await sql`ALTER TABLE ${sql.id(object.name)} ADD COLUMN rogue TEXT`.execute(database.db);
            else await sql`DROP INDEX ${sql.id(object.name)}`.execute(database.db);
          });
        } finally {await storage.close();}
      }
    });

    if (version>0) test(`${target}: v${version} raced marker rows and missing marker table reject unchanged`, async () => {
      for (const mode of ['rows','table']) {
        const storage=await schemaAdminStorage(target);
        try {
          const database=storage.database;await prepare(database,version);
          await rejectRace(database,async () => {
            if (mode==='rows') await sql`DELETE FROM _cms_migrations WHERE version=${version}`.execute(database.db);
            else await sql`DROP TABLE _cms_migrations`.execute(database.db);
          });
        } finally {await storage.close();}
      }
    });

    test(`${target}: v${version} ordinary operator writes remain outside the prerequisite snapshot`, async () => {
      const storage=await schemaAdminStorage(target);
      try {
        const database=storage.database;await prepare(database,version);
        await sql`CREATE TABLE operator_notes (note TEXT)`.execute(database.db);
        const subject={...database,async atomicBatch(statements:Parameters<typeof database.atomicBatch>[0]) {
          await sql`INSERT INTO operator_notes VALUES ('retained')`.execute(database.db);
          await sql`CREATE TABLE operator_later (note TEXT)`.execute(database.db);
          return database.atomicBatch(statements);
        }};
        await assert.doesNotReject(()=>migrateCms(subject));
        assert.equal((await sql<{note:string}>`SELECT note FROM operator_notes`.execute(database.db)).rows[0]?.note,'retained');
        await assert.doesNotReject(()=>migrateCms(database));
      } finally {await storage.close();}
    });

    if (version>=2) test(`${target}: v${version} mutable auth roles, sessions and profiles are not DDL prerequisites`, async () => {
      const storage=await schemaAdminStorage(target);
      try {
        const database=storage.database;await prepare(database,version);
        await sql`INSERT INTO _cms_auth_users VALUES ('owner',30,0)`.execute(database.db);
        if (version>=4) await sql`INSERT INTO _cms_auth_profiles
          (user_id,email,name,created_at,updated_at) VALUES ('owner','before@example.com','Before','before','before')`.execute(database.db);
        const subject={...database,async atomicBatch(statements:Parameters<typeof database.atomicBatch>[0]) {
          await sql`UPDATE _cms_auth_users SET role=40,disabled=1 WHERE id='owner'`.execute(database.db);
          await sql`INSERT INTO _cms_auth_sessions VALUES (${'s'.repeat(43)},'owner',123456789)`.execute(database.db);
          if (version>=4) await sql`UPDATE _cms_auth_profiles SET name='After',updated_at='after' WHERE user_id='owner'`.execute(database.db);
          return database.atomicBatch(statements);
        }};
        await assert.doesNotReject(()=>migrateCms(subject));
        assert.equal((await sql<{role:number}>`SELECT role FROM _cms_auth_users WHERE id='owner'`.execute(database.db)).rows[0]?.role,40);
        assert.equal((await sql`SELECT hash FROM _cms_auth_sessions`.execute(database.db)).rows.length,1);
        if (version>=4) assert.equal((await sql<{name:string}>`SELECT name FROM _cms_auth_profiles WHERE user_id='owner'`.execute(database.db)).rows[0]?.name,'After');
        await assert.doesNotReject(()=>migrateCms(database));
      } finally {await storage.close();}
    });
  }
}
