// Whole immutable Source families on actual canonical storage. Native service
// transport reuses the existing controlled lifecycle fixture principal and CAS.
import {describe} from 'vitest';
import {CmsError} from '../../../src/lib/server/database/contract.ts';
import {openSqlite} from '../../../src/lib/server/database/sqlite.ts';
import {migrateCms} from '../../../src/lib/server/database/migrations.ts';
import {SchemaRegistry as NativeRegistry} from '../../../src/lib/server/database/registry.ts';
import {lifecycleService} from '../../../src/lib/server/database/lifecycle/service.ts';
import {registerLifecycleDatabase} from '../../../src/lib/server/database/lifecycle/upstream/host.ts';
import {registerBylineDatabase} from '../../../src/lib/server/bylines/storage.ts';
import {canonicalSourceDatabase} from '../../../src/lib/server/canonical-storage/namespace.ts';
import {ContentRepository} from '../../../src/lib/server/database/lifecycle/upstream/database/repositories/content.ts';
import {principal} from '../lifecycle-fixture.ts';
import {encodeRev,validateRev} from '../../../src/lib/server/database/lifecycle/upstream/api/rev.ts';
const owners=new WeakMap();
function storage(db){const owner=owners.get(db);if(!owner)throw new Error('Unknown actual byline lifecycle fixture');return owner;}
function service(db){return lifecycleService(storage(db),principal,{after:()=>{}});}
export async function setupTestDatabase(){
 const original=openSqlite(':memory:');await migrateCms(original);
 const db=registerBylineDatabase({...original,db:canonicalSourceDatabase(original)});
 const owner={...original,db};owners.set(db,owner);registerLifecycleDatabase(owner);
 return db;
}
export async function teardownTestDatabase(db){if(db)await storage(db).close();}
export class SchemaRegistry extends NativeRegistry {
 constructor(db){super(storage(db));}
 async updateCollection(slug,input){const item=await this.getCollection(slug);return super.updateCollection(slug,input,{version:item.version,updatedAt:item.updatedAt});}
}
export async function setupTestDatabaseWithCollections(){
 const db=await setupTestDatabase();const registry=new SchemaRegistry(db);
 for(const slug of ['post','page']){
  await registry.createCollection({slug,label:slug==='post'?'Posts':'Pages',labelSingular:slug==='post'?'Post':'Page'});
  await registry.createField(slug,{slug:'title',label:'Title',type:'string'});
  await registry.createField(slug,{slug:'content',label:'Content',type:'portableText'});
 }
 return db;
}
export function describeEachDialect(name,callback){describe(`${name} [native-sqlite]`,()=>callback('sqlite'));}
export async function setupForDialectWithCollections(dialect){return{db:await setupTestDatabaseWithCollections(),dialect};}
export async function teardownForDialect(context){await teardownTestDatabase(context?.db);}
function failure(cause,operation){
 if(cause instanceof CmsError)return{success:false,error:{code:cause.code,message:cause.message}};
 return{success:false,error:{code:`CONTENT_${operation}_ERROR`,message:`Failed to ${operation.toLowerCase()} content`}};
}
function receipt(item){return{success:true,data:{item,_rev:encodeRev(item)}};}
export async function handleContentCreate(db,collection,body){
 try{
  const owner=service(db);let item=await owner.createContent({...body,type:collection,status:body.status==='published'?undefined:body.status});
  // Source direct-handler published create uses one transaction; the existing
  // Native API uses real draft + publication CAS. No single-write parity credit.
  if(body.status==='published')item=await owner.publish({type:collection,id:item.id,locale:item.locale,expected:{version:item.version,updatedAt:item.updatedAt}});
  return receipt(item);
 }catch(cause){return failure(cause,'CREATE');}
}
export async function handleContentGet(db,collection,id,locale){
 try{return receipt(await service(db).getContent({type:collection,id,...(locale===undefined?{}:{locale})},{inferLocale:locale===undefined,resolveIdentifier:true}));}
 catch(cause){return failure(cause,'GET');}
}
export async function handleContentUpdate(db,collection,id,body){
 try{
  const owner=service(db);const item=await owner.getContent({type:collection,id,...(body.locale===undefined?{}:{locale:body.locale})},{inferLocale:body.locale===undefined,resolveIdentifier:true});
  const validation=validateRev(body._rev,item);if(!validation.valid)throw new CmsError('CONFLICT',validation.message);
  const {_rev,...input}=body;
  return receipt((await owner.updateContent({...input,type:collection,id:item.id,locale:item.locale,expected:{version:item.version,updatedAt:item.updatedAt}})).item);
 }catch(cause){return failure(cause,'UPDATE');}
}
export async function handleContentList(db,collection,options){
 try{return{success:true,data:await service(db).listContent({...options,type:collection},{allLocales:options.locale===undefined})};}
 catch(cause){return failure(cause,'LIST');}
}
export async function handleContentPublish(db,collection,id,options={}){
 try{const owner=service(db);const item=await owner.getContent({type:collection,id},{inferLocale:true,resolveIdentifier:true});
  return receipt(await owner.publish({type:collection,id:item.id,locale:item.locale,publishedAt:options.publishedAt,expected:{version:item.version,updatedAt:item.updatedAt}}));}
 catch(cause){return failure(cause,'PUBLISH');}
}
export async function handleContentDuplicate(db,collection,id){
 try{const method=service(db).duplicateContent;if(!method)throw new CmsError('VALIDATION_ERROR','Content duplication is not implemented');return receipt(await method({type:collection,id}));}
 catch(cause){return failure(cause,'DUPLICATE');}
}
export async function handleContentSchedule(db,collection,id,body){
 try{const item=await new ContentRepository(db).schedule(collection,id,body.scheduledAt);return receipt(item);}
 catch(cause){return failure(cause,'SCHEDULE');}
}
export async function handleContentUnschedule(db,collection,id){
 try{return receipt(await new ContentRepository(db).unschedule(collection,id));}
 catch(cause){return failure(cause,'UNSCHEDULE');}
}
export async function handleContentPermanentDelete(db,collection,id){
 try{const method=service(db).permanentDeleteContent;if(!method)throw new CmsError('VALIDATION_ERROR','Content permanent deletion is not implemented');await method({type:collection,id});return{success:true,data:{deleted:true}};}
 catch(cause){return failure(cause,'PERMANENT_DELETE');}
}
