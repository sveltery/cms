// Whole immutable Source families on actual canonical storage. Native service
// transport reuses the existing controlled lifecycle fixture principal and CAS.
import {describe} from 'vitest';
import {OperationNodeTransformer} from 'kysely';
import {CmsError} from '../../../src/lib/server/database/contract.ts';
import {openSqlite} from '../../../src/lib/server/database/sqlite.ts';
import {migrateCms} from '../../../src/lib/server/database/migrations.ts';
import {SchemaRegistry as NativeRegistry} from '../../../src/lib/server/database/registry.ts';
import {nativeContentApi} from '../../../src/lib/server/database/content-api.ts';
import {registerLifecycleDatabase} from '../../../src/lib/server/database/lifecycle/upstream/host.ts';
import {registerBylineDatabase} from '../../../src/lib/server/bylines/storage.ts';
import {canonicalSourceDatabase} from '../../../src/lib/server/canonical-storage/namespace.ts';
import {ContentRepository} from '../../../src/lib/server/database/lifecycle/upstream/database/repositories/content.ts';
import {principal} from '../lifecycle-fixture.ts';
import {encodeRev,validateRev} from '../../../src/lib/server/database/lifecycle/upstream/api/rev.ts';
const owners=new WeakMap();
// Only the three original Source redirect SELECT TableNodes need this finite
// physical identifier transport. RawNodes, values and result rows are untouched.
class SourceRedirectTable extends OperationNodeTransformer {
 transformTable(node){
  const value=super.transformTable(node);
  if(value.table.schema||value.table.identifier.name!=='_emdash_redirects')return value;
  return{...value,table:{...value.table,identifier:{...value.table.identifier,name:'_cms_redirects'}}};
 }
}
const redirects=new SourceRedirectTable();
const redirectReads={transformQuery:({node})=>redirects.transformNode(node),transformResult:async({result})=>result};
function storage(db){const owner=owners.get(db);if(!owner)throw new Error('Unknown actual byline lifecycle fixture');return owner;}
const sourceAdmin={...principal,permissions:[...principal.permissions,'content:delete_permanent']};
function service(db){return nativeContentApi(storage(db),sourceAdmin,{after:()=>{}});}
export async function setupTestDatabase(){
 const original=openSqlite(':memory:');await migrateCms(original);
 const db=registerBylineDatabase({...original,db:canonicalSourceDatabase(original).withPlugin(redirectReads)});
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
export async function setupForDialect(dialect){return{db:await setupTestDatabase(),dialect};}
export async function setupForDialectWithCollections(dialect){return{db:await setupTestDatabaseWithCollections(),dialect};}
export async function teardownForDialect(context){await teardownTestDatabase(context?.db);}
export function handleContentCreate(db,collection,body){return service(db).create(collection,body);}
export function handleContentGet(db,collection,id,locale){return service(db).get(collection,id,locale);}
export function handleContentUpdate(db,collection,id,body){return service(db).update(collection,id,body);}
export function handleContentList(db,collection,options){return service(db).list(collection,options);}
export function handleContentPublish(db,collection,id,options){return service(db).publish(collection,id,options);}
export function handleContentDuplicate(db,collection,id,authorId){return service(db).duplicate(collection,id,authorId);}
export function handleContentSchedule(db,collection,id,scheduledAt,currentTime,_rev){return service(db).schedule(collection,id,scheduledAt,currentTime,_rev);}
export function handleContentUnschedule(db,collection,id,_rev){return service(db).unschedule(collection,id,_rev);}
export function handleContentPermanentDelete(db,collection,id){return service(db).permanentDelete(collection,id);}
