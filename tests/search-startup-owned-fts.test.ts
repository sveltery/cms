import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { sql } from 'kysely';
import { schemaAdminStorage } from './helpers/schema-admin-storage.ts';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../src/lib/server/database/registry.ts';
import { FTSManager } from '../src/lib/server/search/fts-manager.ts';
import type { Database } from '../src/lib/server/database/lifecycle/upstream/database/types.ts';
import type { Kysely } from 'kysely';
// Original cross-feature acceptance, zero source declaration credit. A legal
// source/native collection slug must not collide with internal upgrade temps.
for (const target of ['Node','D1'] as const) for (const slug of ['notes','notes_v3']) {
  test(`${target}: managed search ${slug} survives canonical restart`,async()=>{
    const storage=await schemaAdminStorage(target);
    try {
      await migrateCms(storage.database);
      const registry=new SchemaRegistry(storage.database);
      await registry.createCollection({slug,label:slug,supports:['search']});
      await registry.createField(slug,{slug:'title',label:'Title',type:'string',searchable:true});
      await registry.createField(slug,{slug:'body',label:'Body',type:'portableText',searchable:true});
      await new FTSManager(storage.database.db as unknown as Kysely<Database>).enableSearch(slug);
      const objects=(await sql<{name:string;type:string;tbl_name:string;sql:string|null}>`SELECT name,type,tbl_name,sql FROM sqlite_master WHERE substr(name,1,${('_cms_fts_'+slug).length})=${'_cms_fts_'+slug} ORDER BY name`.execute(storage.database.db)).rows;
      if(process.env.SVELTERY_SEARCH_STARTUP_ARTIFACT_DIR) {
        await mkdir(process.env.SVELTERY_SEARCH_STARTUP_ARTIFACT_DIR,{recursive:true});
        await writeFile(process.env.SVELTERY_SEARCH_STARTUP_ARTIFACT_DIR+'/'+target+'-'+slug+'.json',JSON.stringify(objects,null,2)+'\n');
      }
      assert.ok(objects.some(object=>object.name==='_cms_fts_'+slug&&object.type==='table'));
      const restarted=await Promise.allSettled([migrateCms(storage.database)]);
      assert.equal(restarted[0].status,'fulfilled',JSON.stringify(restarted[0],(_key,value)=>value instanceof Error?{message:value.message,code:'code' in value?value.code:undefined}:value));
    } finally {await storage.close();}
  });
}
