import test from 'node:test';
import assert from 'node:assert/strict';
import {sql} from 'kysely';
import {schemaAdminStorage} from './helpers/schema-admin-storage.ts';
import {migrateCms} from '../src/lib/server/database/migrations.ts';
import {blocksDatabase} from '../src/lib/server/blocks/host.ts';
import {BlockTypeRegistry} from '../src/lib/server/blocks/registry.ts';
for(const target of ['Node','D1'] as const){
 test(`${target}: canonical blocks provider creates, reopens and rejects altered ownership`,async()=>{
  const storage=await schemaAdminStorage(target);try{
   await migrateCms(storage.database);
   await new BlockTypeRegistry(blocksDatabase(storage.database)).createBlockType({slug:'hero',label:'Hero',fields:[]});
   await migrateCms(storage.database);
   assert.equal((await new BlockTypeRegistry(blocksDatabase(storage.database)).getBlockType('hero'))?.currentVersion,1);
   await sql`ALTER TABLE _cms_block_types ADD COLUMN operator_extra TEXT`.execute(storage.database.db);
   await assert.rejects(migrateCms(storage.database),{code:'MIGRATION_REQUIRED'});
   assert.equal((await new BlockTypeRegistry(blocksDatabase(storage.database)).getBlockType('hero'))?.versions.length,1);
  }finally{await storage.close();}
 });
}
