// Original framework integration; zero copied-source declaration credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {sql} from 'kysely';
import {schemaAdminStorage} from './helpers/schema-admin-storage.ts';
import {lifecycleMigration} from '../src/lib/server/database/lifecycle-migrations.ts';

// Exercise the actual framework with only its provider registration extended.
// The real proposed8 physicalDDL is aliased to contiguous6 after actual5.
// No production provider is registered, no empty provider or marker is forged.
const path=new URL('../src/lib/server/database/migrations.ts',import.meta.url);
let source=readFileSync(path,'utf8');
const registration=/  lifecycleMigration(?:,[^\n]*)?\n\];/;
assert.ok(registration.test(source));
source=source.replace(registration,'  lifecycleMigration,\n  laterMetadataFixture\n];')
  .replace(/from (['"])([^'"]+)\1/g,(_whole,_quote,reference)=>'from '+JSON.stringify(reference.startsWith('.') ? new URL(reference,path).href : import.meta.resolve(reference)));
source='import {metadataFidelityMigration as laterMetadataFixture} from '+JSON.stringify(new URL('./fixtures/later-metadata-provider.ts',import.meta.url).href)+';\n'+source;
const {migrateCms}=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source,{mode:'transform'})).toString('base64')) as typeof import('../src/lib/server/database/migrations.ts');
for(const target of ['Node','D1'] as const) {
  test(`${target}: real later metadata replacement is accepted on canonical restart`,async()=>{
    const storage=await schemaAdminStorage(target);
    try {
      await migrateCms(storage.database);
      const keys=(await sql<{on_delete:string}>`PRAGMA foreign_key_list(_cms_fields)`.execute(storage.database.db)).rows;
      assert.equal(keys[0]?.on_delete,'CASCADE');
      const columns=(await sql<{name:string;type:string;notnull:number}>`PRAGMA table_info(_cms_collections)`.execute(storage.database.db)).rows;
      assert.deepEqual(columns.filter(column=>column.name==='search_config').map(({type,notnull})=>({type,notnull})),[{type:'TEXT',notnull:0}]);
      await assert.doesNotReject(()=>migrateCms(storage.database));
    } finally {await storage.close();}
  });
  test(`${target}: malformed latest static metadata rejects before dynamic descriptors`,async()=>{
    const storage=await schemaAdminStorage(target);const original=lifecycleMigration.expectedObjects;let reads=0;
    try {
      await migrateCms(storage.database);
      await sql`ALTER TABLE _cms_fields ADD COLUMN rogue TEXT`.execute(storage.database.db);
      lifecycleMigration.expectedObjects=async function(database,version){if((version??0)>=5)reads++;return original.call(this,database,version);};
      await assert.rejects(()=>migrateCms(storage.database),{code:'MIGRATION_REQUIRED'});
      assert.equal(reads,0);
    } finally {lifecycleMigration.expectedObjects=original;await storage.close();}
  });
}
