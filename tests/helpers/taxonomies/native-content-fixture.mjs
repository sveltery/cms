// Supplemental real Native fixture. The original Source7 test body, SQL,
// assertions, data and clocks remain byte-identical. This is Native Node proof.
import {describe} from 'vitest';
import {openSqlite} from '../../../src/lib/server/database/sqlite.ts';
import {migrateCms} from '../../../src/lib/server/database/migrations.ts';
import {SchemaRegistry} from '../../../src/lib/server/database/registry.ts';
import {canonicalSourceDatabase} from '../../../src/lib/server/canonical-storage/namespace.ts';
import {ordinaryContentService} from '../../../src/lib/server/database/content-service.ts';
import {CmsError} from '../../../src/lib/server/database/contract.ts';
import {encodeRev} from '../../../src/lib/server/database/lifecycle/upstream/api/rev.ts';

const owners=new WeakMap();
// Trusted ordinary service fixture input. No session, credential, signature,
// permission rejection, identity installation or HTTP/auth probe is performed.
const principal={id:'taxonomy-content-fixture',permissions:['content:create','content:read','content:read_drafts','content:edit_any']};
export function describeEachDialect(name,callback){describe(`${name} [native-sqlite]`,()=>callback('sqlite'));}
export async function setupForDialectWithCollections(dialect){
 if(dialect!=='sqlite')throw new Error('This fixture provides Native SQLite only');
 const storage=openSqlite(':memory:');
 try{
  await migrateCms(storage);
  const registry=new SchemaRegistry(storage);
  for(const [slug,label] of [['post','Posts'],['page','Pages']]){
   await registry.createCollection({slug,label,labelSingular:slug==='post'?'Post':'Page'});
   await registry.createField(slug,{slug:'title',label:'Title',type:'string'});
   await registry.createField(slug,{slug:'content',label:'Content',type:'portableText'});
  }
  const db=canonicalSourceDatabase(storage);owners.set(db,{storage,service:ordinaryContentService(storage,principal)});
  return{db,dialect,storage};
 }catch(cause){await storage.close();throw cause;}
}
export async function teardownForDialect(context){await context?.storage.close();}
function service(db){const value=owners.get(db);if(!value)throw new Error('Unknown actual Native fixture owner');return value.service;}
function failure(cause){if(cause instanceof CmsError)return{success:false,error:{code:cause.code,message:cause.message}};throw cause;}
export async function handleContentCreate(db,collection,body){
 try{const item=await service(db).createContent({...body,type:collection});return{success:true,data:{item,_rev:encodeRev(item)}};}
 catch(cause){return failure(cause);}
}
export async function handleContentUpdate(db,collection,id,body){
 try{const owner=service(db);const existing=await owner.getContent({type:collection,id,...(body.locale===undefined?{}:{locale:body.locale})});
  const item=await owner.updateContent({...body,type:collection,id,locale:existing.locale,expected:{version:existing.version,updatedAt:existing.updatedAt}});
  return{success:true,data:{item,_rev:encodeRev(item)}};
 }catch(cause){return failure(cause);}
}
