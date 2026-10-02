// Source-shaped host projections only. This helper never implements generic
// listing, filtering, draft hydration, publication or successful mutations.
import assert from 'node:assert/strict';
import {expect as sourceExpect,it} from './lifecycle-expect.ts';
import {openSqlite} from '../../src/lib/server/database/sqlite.ts';
import {migrateCms} from '../../src/lib/server/database/migrations.ts';
import {SchemaRegistry} from '../../src/lib/server/database/registry.ts';
import {cmsService} from '../../src/lib/server/database/service.ts';
import {lifecycleService} from '../../src/lib/server/database/lifecycle/service.ts';
import {ContentRepository} from '../../src/lib/server/database/lifecycle/upstream/database/repositories/content.ts';
import {withRevision,precondition} from '../../src/lib/server/content/schema.ts';
import {sql} from 'kysely';
import {Permissions} from '../../src/lib/server/auth/permissions.ts';
export {it};
export const expect=(actual:unknown,_message?:unknown)=>{
 const value=sourceExpect(actual);value.toBeLessThanOrEqual=(expected:number)=>assert.ok(typeof actual==='number'&&actual<=expected);
 value.toMatch=(expected:RegExp)=>assert.match(String(actual),expected);return value;
};
export async function compositionFixture(){
 const database=openSqlite(':memory:');await migrateCms(database);const registry=new SchemaRegistry(database);
 for(const slug of ['post','page','posts']){
  await registry.createCollection({slug,label:slug,...(slug==='page'?{supports:[]}:{})});
  await registry.createField(slug,{slug:'title',label:'Title',type:'string'});
  await registry.createField(slug,{slug:'body',label:'Body',type:'text'});
  if(slug==='posts')await registry.createField(slug,{slug:'priority',label:'Priority',type:'string',indexed:true});
 }
 const principal={id:'author-1',permissions:Object.keys(Permissions).filter(permission=>permission.startsWith('content:')||permission.startsWith('schema:')) as any};
 const service:any=cmsService(database,principal);const lifecycle=lifecycleService(database,principal,{after:()=>{}});
 const storage=new ContentRepository(database.db as any);
 async function create(input:any){
  const {status,authorId,...value}=input;
  const own=lifecycleService(database,{...principal,id:authorId??principal.id},{after:()=>{}});
  let item=await own.createContent(value);if(status==='published')item=await own.publish({type:input.type,id:item.id,locale:item.locale??'en'});return item;
 }
 async function list(type:string,options:any={}){
  if(service.listContent)return service.listContent({type,...options});
  const {locale,limit,cursor}=options;return service.listDrafts({type,...(locale?{locale}:{}),...(limit?{limit}:{}),...(cursor?{cursor}:{})});
 }
 async function get(type:string,id:string,locale='en'){
  return service.getContent?service.getContent({type,id,locale}):service.getDraft({type,id,locale});
 }
 async function remove(type:string,id:string){
  const item=await storage.findById(type,id);if(!item)return false;
  const key={type,id,locale:item.locale??'en',expected:{version:item.version,updatedAt:item.updatedAt}};
  await (service.deleteContent?service.deleteContent(key):service.deleteDraft(key));return true;
 }
 async function wrapped(operation:()=>Promise<unknown>){try{return{success:true,data:await operation()};}catch(error:any){return{success:false,error:{code:error.code==='NOT_FOUND'?'COLLECTION_NOT_FOUND':error.code??'ERROR',message:error.message}};}}
 const fixture:any={database,registry,service,lifecycle,storage,principal,
  repo:{create,findMany:(type:string,options:any={})=>list(type,{...options.where,...(options.orderBy?{orderBy:options.orderBy.field,order:options.orderBy.direction}:{}),limit:options.limit,cursor:options.cursor}),delete:remove,
   count:async(type:string,where:any={})=>service.countContent?service.countContent({type,...where}):(await list(type,where)).items.length},
  setCreatedAt:(type:string,id:string,value:string)=>sql`UPDATE ${sql.ref(`ec_${type}`)} SET created_at=${value} WHERE id=${id}`.execute(database.db),
  seedTrash:(type:string,id:string)=>storage.delete(type,id),
  listHandler:(type:string,params:any)=>wrapped(()=>list(type,params)),
  trashHandler:(type:string,params:any)=>wrapped(()=>service.listTrashedContent?service.listTrashedContent({type,...params}):service.listTrashedDrafts({type,...params})),
  trashCountHandler:(type:string,params:any)=>wrapped(async()=>({count:await(service.countTrashedContent?service.countTrashedContent({type,...params}):service.countTrashedDrafts({type,...params}))}))
 };
 const client={async callTool({name,arguments:input}:any){
  const {collection,...value}=input;const key={type:collection,...value};
  try{
   let result:any;
   if(name==='content_create')result={item:service.createContent?await service.createContent(key):await create(key)};
   else if(name==='content_get')result={item:await get(collection,value.id,value.locale)};
   else if(name==='content_list')result=await list(collection,value);
   else if(name==='content_list_trashed')result=await(service.listTrashedContent?service.listTrashedContent(key):service.listTrashedDrafts(key));
   else if(name==='content_update'){
    const expected=precondition({...input,locale:input.locale??'en'});
    result={item:service.updateContent?await service.updateContent({...key,expected}):await service.updateDraft({type:collection,id:value.id,locale:value.locale??'en',data:value.data,slug:value.slug,expected})};
   }else if(name==='content_publish')result={item:await lifecycle.publish({...key,expected:precondition({...input,locale:input.locale??'en'})})};
   else if(name==='content_discard_draft')result={item:await lifecycle.discardDraft({...key,expected:precondition({...input,locale:input.locale??'en'})})};
   else if(name==='content_delete'){await remove(collection,value.id);result={deleted:true,id:value.id};}
   else throw new Error(`Unsupported source-shaped call ${name}`);
   if(result.item)result={...result,_rev:withRevision({...result.item,locale:result.item.locale??'en'})._rev};
   return {isError:false,structuredContent:result,content:[{type:'text',text:JSON.stringify(result)}]};
  }catch(cause:any){
   // A failed write retains the real persisted row for the source assertions.
   const item=value.id?await storage.findById(collection,value.id):null;
   const result={...(item?{item,_rev:withRevision({...item,locale:item.locale??'en'})._rev}:{}),error:{code:cause.code??'ERROR',message:cause.message}};
   return{isError:true,structuredContent:result,content:[{type:'text',text:JSON.stringify(result)}]};
  }
 }};
 fixture.harness={client};return fixture;
}
