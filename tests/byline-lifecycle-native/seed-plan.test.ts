// Native supplemental proof of the whole resolved Seed content batch.
import {afterEach,beforeEach,expect,it} from 'vitest';
import {sql} from 'kysely';
import {openBylineLifecycleStorage} from '../helpers/byline-lifecycle/native-storage.ts';
import type {CmsDatabase} from '../../src/lib/server/database/contract.ts';
import {migrateCms} from '../../src/lib/server/database/migrations.ts';
import {SchemaRegistry} from '../../src/lib/server/database/registry.ts';
import {BylineRepository} from '../../src/lib/server/bylines/repository.ts';
import {ContentRepository} from '../../src/lib/server/database/lifecycle/upstream/database/repositories/content.ts';
import {applySeedContentCreate,applySeedContentUpdate} from '../../src/lib/server/database/lifecycle/seed-plan.ts';
let database:CmsDatabase;
beforeEach(async()=>{database=await openBylineLifecycleStorage();await migrateCms(database);const registry=new SchemaRegistry(database);await registry.createCollection({slug:'post',label:'Posts'});await registry.createField('post',{slug:'title',label:'Title',type:'string'});});
afterEach(()=>database.close());
it('returns the real stable INSERT receipt after committing credits and publication together',async()=>{
 const credit=await new BylineRepository(database).create({slug:'writer',displayName:'Writer'});
 const item=await applySeedContentCreate(database,{input:{id:'seed-published',type:'post',slug:'published',status:'published',data:{title:'Published'},publishedAt:'2025-01-02T00:00:00.000Z'},bylines:[{bylineId:credit.id,roleLabel:'Reporter'}],taxonomyTermIds:[],references:{},routable:true});
 expect(item.id).toBe('seed-published');expect(item.version).toBe(1);expect(item.liveRevisionId).toBeNull();expect(item.authorId).toBeNull();
 const current=await new ContentRepository(database.db as any).findById('post',item.id);
 expect(current?.version).toBe(2);expect(current?.status).toBe('published');expect(current?.publishedAt).toBe('2025-01-02T00:00:00.000Z');expect(current?.liveRevisionId).toEqual(expect.any(String));
 expect((await new BylineRepository(database).getContentBylines('post',item.id)).map(value=>[value.byline.id,value.roleLabel])).toEqual([[credit.id,'Reporter']]);
 expect((await sql<{data:string}>`SELECT data FROM _cms_revisions WHERE id=${current?.liveRevisionId}`.execute(database.db)).rows.map(row=>JSON.parse(row.data))).toEqual([{title:'Published'}]);
});
it('replaces declarative update credits and promotes the exact updated snapshot',async()=>{
 const credit=await new BylineRepository(database).create({slug:'writer',displayName:'Writer'});
 const first=await applySeedContentCreate(database,{input:{id:'seed-update',type:'post',slug:'updated',status:'published',data:{title:'Before'}},bylines:[{bylineId:credit.id}],taxonomyTermIds:[],references:{},routable:true});
 const previous=await new ContentRepository(database.db as any).findById('post',first.id);if(!previous)throw new Error('Missing committed fixture row');
 await applySeedContentUpdate(database,{type:'post',id:first.id,status:'published',data:{title:'After'},bylines:[],taxonomyTermIds:[],references:{},routable:true});
 const current=await new ContentRepository(database.db as any).findById('post',first.id);
 expect(current?.version).toBe(previous.version+3);expect(current?.data.title).toBe('After');expect(current?.draftRevisionId).toBeNull();
 expect(await new BylineRepository(database).getContentBylines('post',first.id)).toEqual([]);
 expect((await sql<{data:string}>`SELECT data FROM _cms_revisions WHERE id=${current?.liveRevisionId}`.execute(database.db)).rows.map(row=>JSON.parse(row.data))).toEqual([{title:'After'}]);
});
it('refuses slugless publication before the single content batch can persist a row or revision',async()=>{
 await expect(applySeedContentCreate(database,{input:{id:'seed-refused',type:'post',status:'published',data:{}},taxonomyTermIds:[],references:{},routable:true})).rejects.toThrow('Cannot publish routable content without a slug');
 expect((await sql`SELECT id FROM ec_post`.execute(database.db)).rows).toEqual([]);expect((await sql`SELECT id FROM _cms_revisions`.execute(database.db)).rows).toEqual([]);
});
it('snapshots Source non-null fields and nested serialized values from the actual inserted row',async()=>{
 const registry=new SchemaRegistry(database);await registry.createField('post',{slug:'subtitle',label:'Subtitle',type:'string'});await registry.createField('post',{slug:'body',label:'Body',type:'portableText'});
 const body=[{_type:'block',children:[{_type:'span',text:'Seed body'}]}];
 await applySeedContentCreate(database,{input:{id:'seed-json',type:'post',slug:'json',status:'published',data:{title:'JSON',body}},taxonomyTermIds:[],references:{},routable:true});
 const current=await new ContentRepository(database.db as any).findById('post','seed-json');
 expect((await sql<{data:string}>`SELECT data FROM _cms_revisions WHERE id=${current?.liveRevisionId}`.execute(database.db)).rows.map(row=>JSON.parse(row.data))).toEqual([{title:'JSON',body}]);
});
it('creates the Source direct repository published snapshot without Seed promotion',async()=>{
 const {createSourceContent}=await import('../../src/lib/server/database/lifecycle/seed-plan.ts');
 const item=await createSourceContent(database,{id:'direct-published',type:'post',slug:'direct',status:'published',data:{title:'Direct'}});
 expect(item.version).toBe(1);expect(item.liveRevisionId).toBeNull();expect(item.publishedAt).toBeNull();expect(item.authorId).toBeNull();
 expect((await sql`SELECT id FROM _cms_revisions`.execute(database.db)).rows).toEqual([]);
});
it('soft-trashes Source repository content without moving the original version or updated date',async()=>{
 const {createSourceContent,deleteSourceContent}=await import('../../src/lib/server/database/lifecycle/seed-plan.ts');
 const item=await createSourceContent(database,{id:'direct-trash',type:'post',slug:'trash',status:'draft',data:{title:'Trash'}});
 expect(await deleteSourceContent(database,'post',item.id)).toBe(true);
 expect(await deleteSourceContent(database,'post',item.id)).toBe(false);
 expect(await new ContentRepository(database.db as any).findById('post',item.id)).toBeNull();
 const row=(await sql<{version:number;updated_at:string;deleted_at:string}>`SELECT version,updated_at,deleted_at FROM ec_post WHERE id=${item.id}`.execute(database.db)).rows[0];
 expect(row.version).toBe(item.version);expect(row.updated_at).toBe(item.updatedAt);expect(row.deleted_at).toEqual(expect.any(String));
});
