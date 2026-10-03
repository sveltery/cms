import test from 'node:test';
import assert from 'node:assert/strict';
import {schemaAdminStorage} from './helpers/schema-admin-storage.ts';
import {migrateCms} from '../src/lib/server/database/migrations.ts';
import {editorManifest} from '../src/lib/server/content/manifest.ts';
import {OptionsRepository} from '../src/lib/server/settings/options.ts';
import type {Kysely} from 'kysely';
import type {SettingsTables} from '../src/lib/server/settings/tables.ts';

// Original native regression: source input helpers must receive persisted site
// timezone. Immutable source datetime callbacks are inventoried independently.
const principal={id:'editor',permissions:['content:read','content:read_drafts']} as const;
for(const target of ['Node','D1'] as const){
 test(`${target}: editor metadata reads the persisted site timezone afresh`,async()=>{
  const storage=await schemaAdminStorage(target);try{
   await migrateCms(storage.database);
   const options=new OptionsRepository(storage.database.db as unknown as Kysely<SettingsTables>);
   await options.set('site:timezone','Asia/Tokyo');
   assert.equal((await editorManifest(storage.database,{...principal,permissions:[...principal.permissions]})).timezone,'Asia/Tokyo');
   await options.set('site:timezone','America/New_York');
   assert.equal((await editorManifest(storage.database,{...principal,permissions:[...principal.permissions]})).timezone,'America/New_York');
  }finally{await storage.close();}
 });
 test(`${target}: absent site timezone uses the pinned UTC fallback`,async()=>{
  const storage=await schemaAdminStorage(target);try{
   await migrateCms(storage.database);
   assert.equal((await editorManifest(storage.database,{...principal,permissions:[...principal.permissions]})).timezone,'UTC');
  }finally{await storage.close();}
 });
}
