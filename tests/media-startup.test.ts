import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {sql} from 'kysely';
import {schemaAdminStorage} from './helpers/schema-admin-storage.ts';
import {CMS_MIGRATIONS,migrateCms} from '../src/lib/server/database/migrations.ts';
import {mediaMigration} from '../src/lib/server/media/schema.ts';
import {normalizeMigrationSql} from '../src/lib/server/database/migration-provider.ts';

// Original native composition regressions; zero copied source callback credit.
// Real canonical providers and persistent Node SQLite / workerd D1 adapters.
for(const target of ['Node','D1'] as const) {
 test(`${target}: canonical media descriptors survive repeated startup and persistent reopen`,async()=>{
  const directory=await mkdtemp(join(tmpdir(),'cms-media-startup-'));
  let storage=await schemaAdminStorage(target,directory);
  try {
   await migrateCms(storage.database);
   const descriptors=await mediaMigration.expectedObjects(storage.database);
   const objects=(await sql<{name:string;type:string;sql:string}>`SELECT name,type,sql FROM sqlite_master`.execute(storage.database.db)).rows;
   for(const descriptor of descriptors) {
    const actual=objects.find(object=>object.name===descriptor.name);
    assert.ok(actual,descriptor.name);assert.equal(actual.type,descriptor.type);
    assert.equal(normalizeMigrationSql(actual.sql),normalizeMigrationSql(descriptor.sql),descriptor.name);
   }
   await sql`INSERT INTO media_folders(id,name,name_key) VALUES ('folder-retained','Retained','retained')`.execute(storage.database.db);
   await sql`INSERT INTO media(id,filename,mime_type,storage_key,folder_id,alt)
    VALUES ('media-retained','retained.png','image/png','media/retained.png','folder-retained','Persisted alt')`.execute(storage.database.db);
   await migrateCms(storage.database);
   await storage.close();storage=await schemaAdminStorage(target,directory);
   await migrateCms(storage.database);
   assert.deepEqual((await sql<{version:number}>`SELECT version FROM _cms_migrations ORDER BY version`.execute(storage.database.db)).rows.map(row=>row.version),CMS_MIGRATIONS.map(provider=>provider.version));
   assert.deepEqual((await sql<{id:string;folder_id:string;alt:string}>`SELECT id,folder_id,alt FROM media`.execute(storage.database.db)).rows,
    [{id:'media-retained',folder_id:'folder-retained',alt:'Persisted alt'}]);
  } finally {await storage.close();await rm(directory,{recursive:true,force:true});}
 });
 test(`${target}: modified media schema rejects startup without repairing or deleting data`,async()=>{
  const storage=await schemaAdminStorage(target);
  try {
   await migrateCms(storage.database);
   await sql`ALTER TABLE media ADD COLUMN operator_sentinel TEXT`.execute(storage.database.db);
   await sql`INSERT INTO media(id,filename,mime_type,storage_key,operator_sentinel)
    VALUES ('operator-retained','operator.txt','text/plain','media/operator.txt','must remain')`.execute(storage.database.db);
   const catalogue=(await sql`SELECT name,type,sql FROM sqlite_master ORDER BY name,type`.execute(storage.database.db)).rows;
   await assert.rejects(()=>migrateCms(storage.database),{code:'MIGRATION_REQUIRED'});
   assert.deepEqual((await sql`SELECT name,type,sql FROM sqlite_master ORDER BY name,type`.execute(storage.database.db)).rows,catalogue);
   assert.equal((await sql<{operator_sentinel:string}>`SELECT operator_sentinel FROM media`.execute(storage.database.db)).rows[0].operator_sentinel,'must remain');
  } finally {await storage.close();}
 });
}
