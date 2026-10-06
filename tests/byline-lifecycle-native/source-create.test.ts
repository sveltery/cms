// Supplemental Source creation semantics over the same canonical owner.
import {afterEach,beforeEach,expect,it} from 'vitest';
import {sql} from 'kysely';
import {openBylineLifecycleStorage} from '../helpers/byline-lifecycle/native-storage.ts';
import type {CmsDatabase} from '../../src/lib/server/database/contract.ts';
import {migrateCms} from '../../src/lib/server/database/migrations.ts';
import {SchemaRegistry} from '../../src/lib/server/database/registry.ts';
import {nativeContentApi} from '../../src/lib/server/database/content-api.ts';
import {BylineRepository} from '../../src/lib/server/bylines/repository.ts';
import {principal} from '../helpers/lifecycle-fixture.ts';
let database:CmsDatabase;
beforeEach(async()=>{database=await openBylineLifecycleStorage();await migrateCms(database);const registry=new SchemaRegistry(database);await registry.createCollection({slug:'post',label:'Posts'});await registry.createField('post',{slug:'title',label:'Title',type:'string'});});
afterEach(()=>database.close());
it('creates a published Source row and its credits with the original initial version and absent publication date',async()=>{
 const byline=await new BylineRepository(database).create({slug:'writer',displayName:'Writer'});
 const result=await nativeContentApi(database,principal,{after:()=>{}}).create('post',{data:{title:'Published'},status:'published',bylines:[{bylineId:byline.id}]});
 expect(result.success).toBe(true);if(!result.success)throw new Error(result.error.message);
 expect(result.data.item.publishedAt).toBeNull();expect(result.data.item.version).toBe(1);
 expect(result.data.item.status).toBe('published');expect(result.data.item.bylines?.[0]?.byline.id).toBe(byline.id);
 const rows=(await sql`SELECT status,version,published_at FROM ec_post`.execute(database.db)).rows;
 expect(rows).toEqual([{status:'published',version:1,published_at:null}]);
});
it('rejects a slugless routable Source published create before inserting any row',async()=>{
 const result=await nativeContentApi(database,principal,{after:()=>{}}).create('post',{data:{},status:'published'});
 expect(result.success).toBe(false);
 expect((await sql`SELECT id FROM ec_post`.execute(database.db)).rows).toEqual([]);
});
