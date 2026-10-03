// Original independent review regressions. Complete callback bodies preserved.
// Real SQL revision-table fault; zero additional copied Source credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import {schemaAdminStorage} from '../tests/helpers/schema-admin-storage.ts';
import {migrateCms} from '../src/lib/server/database/migrations.ts';
import {SchemaRegistry} from '../src/lib/server/database/registry.ts';
import {cmsService} from '../src/lib/server/database/service.ts';
import {lifecycleService} from '../src/lib/server/database/lifecycle/service.ts';
import {persistedRemotes} from '../tests/helpers/persisted-remotes.ts';
const actor={id:'review-admin',permissions:['content:read','content:read_drafts','content:create','content:edit_any','content:delete_any','content:publish_any']};
const expected=item=>({version:item.version,updatedAt:item.updatedAt});
const faultMessage='Review diagnostic: revision storage read unavailable';
function contains(node,name){if(!node||typeof node!=='object')return false;if(node.kind==='IdentifierNode'&&node.name===name)return true;return Object.values(node).some(value=>Array.isArray(value)?value.some(v=>contains(v,name)):contains(value,name));}
function failingReads(table){return {transformQuery({node}){if(node.kind==='SelectQueryNode'&&contains(node,table))throw new Error(faultMessage);return node;},transformResult:async({result})=>result};}
for(const target of ['Node','D1'])for(const trashed of [false,true])test(`${target}: ordinary ${trashed?'trash':'active'} read falls back to stored live values when only revision hydration fails`,async()=>{
 const storage=await schemaAdminStorage(target);
 try{
  const database=storage.database;await migrateCms(database);const registry=new SchemaRegistry(database);
  await registry.createCollection({slug:'post',label:'Posts'});await registry.createField('post',{slug:'title',label:'Title',type:'string'});
  const ordinary=cmsService(database,actor,{after:()=>{}}),lifecycle=lifecycleService(database,actor,{after:()=>{}});
  const created=await ordinary.createContent({type:'post',data:{title:'Published'}});const published=await lifecycle.publish({type:'post',id:created.id});
  let staged=await ordinary.updateContent({type:'post',id:created.id,data:{title:'Draft'},expected:expected(published)});
  assert.equal(staged.data.title,'Draft');assert.equal(staged.liveData.title,'Published');
  const key={type:'post',id:created.id};
  if(trashed){await ordinary.deleteContent({...key,expected:expected(staged)});staged=await ordinary.getTrashedContent(key);}
  const before=await database.db.selectFrom('ec_post').selectAll().execute(),history=await database.db.selectFrom('_cms_revisions').selectAll().orderBy('id').execute();
  await database.db.schema.alterTable('_cms_revisions').renameTo('_review_unavailable_revisions').execute();
  const faulty=cmsService(database,actor);let read;
  try {await assert.doesNotReject(async()=>{read=await faulty[trashed?'getTrashedContent':'getContent'](key);},'Pinned non-strict draft hydration preserves an otherwise readable item');}
  finally {await database.db.schema.alterTable('_review_unavailable_revisions').renameTo('_cms_revisions').execute();}
  assert.equal(read.data.title,'Published');assert.equal(read.liveData,undefined);assert.equal(read.draftRevisionId,staged.draftRevisionId);
  assert.deepEqual(await database.db.selectFrom('ec_post').selectAll().execute(),before);assert.deepEqual(await database.db.selectFrom('_cms_revisions').selectAll().orderBy('id').execute(),history);
  // The base content lookup remains strict; a storage outage before hydration cannot produce a fake successful item.
  const broken=cmsService({...database,db:database.db.withPlugin(failingReads('ec_post'))},actor);
  await assert.rejects(broken[trashed?'getTrashedContent':'getContent'](key),{message:faultMessage});
 }finally{await storage.close();}
});
