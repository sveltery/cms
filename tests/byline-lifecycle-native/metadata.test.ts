// Supplemental exact Source attribution semantics; no new authorization probes.
import {afterEach,beforeEach,expect,it} from 'vitest';
import {sql} from 'kysely';
import {openBylineLifecycleStorage} from '../helpers/byline-lifecycle/native-storage.ts';
import type {CmsDatabase} from '../../src/lib/server/database/contract.ts';
import {migrateCms} from '../../src/lib/server/database/migrations.ts';
import {SchemaRegistry} from '../../src/lib/server/database/registry.ts';
import {nativeContentApi} from '../../src/lib/server/database/content-api.ts';
import {ordinaryContentService} from '../../src/lib/server/database/content-service.ts';
import {createInput} from '../../src/lib/server/content/schema.ts';
import {parse} from '../../src/lib/server/database/validation.ts';
import {principal} from '../helpers/lifecycle-fixture.ts';
let database:CmsDatabase;
beforeEach(async()=>{database=await openBylineLifecycleStorage();await migrateCms(database);const registry=new SchemaRegistry(database);await registry.createCollection({slug:'post',label:'Posts'});await registry.createField('post',{slug:'title',label:'Title',type:'string'});});
afterEach(()=>database.close());
it('stores Source authorId or null literally without requiring a current user row',async()=>{
 const api=nativeContentApi(database,principal,{after:()=>{}});
 for(const authorId of [undefined,null,'','imported-author']){
  const result=await api.create('post',{data:{title:'Imported'},...(authorId===undefined?{}:{authorId})});
  expect(result.success).toBe(true);if(!result.success)throw new Error(result.error.message);
  const expected=authorId||null;
  expect(result.data.item.authorId).toBe(expected);
  const stored=(await sql<{author_id:string|null}>`SELECT author_id FROM ec_post WHERE id=${result.data.item.id}`.execute(database.db)).rows[0];
  expect(stored.author_id).toBe(expected);
 }
});
it('retains ordinary Native form identity rules separately from Source attribution metadata',async()=>{
 expect(()=>parse(createInput,{collection:'post',data:{title:'Ordinary'},authorId:'imported-author'})).toThrow('VALIDATION_ERROR');
 const item=await ordinaryContentService(database,principal,{after:()=>{}}).createContent({type:'post',data:{title:'Ordinary'},authorId:'imported-author'});
 expect(item.authorId).toBe(principal.id);
});
