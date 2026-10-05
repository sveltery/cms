// Supplemental importer metadata contract. Source seed requires stable supplied IDs.
import {afterEach,beforeEach,expect,it} from 'vitest';
import {openBylineLifecycleStorage} from '../helpers/byline-lifecycle/native-storage.ts';
import type {CmsDatabase} from '../../src/lib/server/database/contract.ts';
import {migrateCms} from '../../src/lib/server/database/migrations.ts';
import {SchemaRegistry} from '../../src/lib/server/database/registry.ts';
import {DraftRepository} from '../../src/lib/server/database/entries.ts';
import {sql} from 'kysely';
let database:CmsDatabase;
beforeEach(async()=>{database=await openBylineLifecycleStorage();await migrateCms(database);const registry=new SchemaRegistry(database);await registry.createCollection({slug:'post',label:'Posts'});await registry.createField('post',{slug:'title',label:'Title',type:'string'});});
afterEach(()=>database.close());
it('retains trusted Source seed ID in the committed content row and translation group',async()=>{
 const item=await new DraftRepository(database).create({type:'post',locale:'en',slug:'stable',data:{title:'Stable'}},'author-1',undefined,undefined,{id:'seed-stable-id'} as any);
 expect(item.id).toBe('seed-stable-id');
 expect((await sql`SELECT id,translation_group FROM ec_post`.execute(database.db)).rows).toEqual([{id:'seed-stable-id',translation_group:'seed-stable-id'}]);
});
