// @ts-nocheck -- original independent JavaScript regression bodies preserved verbatim.
// Original independent review regressions. Complete callback bodies preserved.
// Real SQL revision-table fault; zero additional copied Source credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import {schemaAdminStorage} from '../helpers/schema-admin-storage.ts';
import {migrateCms} from '../../src/lib/server/database/migrations.ts';
import {SchemaRegistry} from '../../src/lib/server/database/registry.ts';
import {cmsService} from '../../src/lib/server/database/service.ts';
import {lifecycleService} from '../../src/lib/server/database/lifecycle/service.ts';
import {persistedRemotes} from '../helpers/persisted-remotes.ts';
const actor={id:'review-admin',permissions:['content:read','content:read_drafts','content:create','content:edit_any','content:delete_any','content:publish_any']};
const expected=item=>({version:item.version,updatedAt:item.updatedAt});
const faultMessage='Review diagnostic: revision storage read unavailable';
function contains(node,name){if(!node||typeof node!=='object')return false;if(node.kind==='IdentifierNode'&&node.name===name)return true;return Object.values(node).some(value=>Array.isArray(value)?value.some(v=>contains(v,name)):contains(value,name));}
function failingReads(table){return {transformQuery({node}){if(node.kind==='SelectQueryNode'&&contains(node,table))throw new Error(faultMessage);return node;},transformResult:async({result})=>result};}
test('registered persisted-principal ordinary query returns the existing item when revision hydration fails',async()=>{
 const tasks=[];const f=await persistedRemotes({persistedSessions:true,mutationsEnabled:true,keepAlive:task=>tasks.push(task)});
 const database=f.database,healthyDb=database.db;
 try{
  const created=await f.mutate('createContent',{collection:'post','data.title':'Published'});const key={collection:'post',id:created._.result.id};
  let current=await f.query('getContent',key);await f.mutate('publishContent',{...key,_rev:current._rev});current=await f.query('getContent',key);
  await f.mutate('updateContent',{...key,_rev:current._rev,'data.title':'Draft'});const staged=await f.query('getContent',key);assert.equal(staged.data.title,'Draft');
  await Promise.all(tasks.splice(0));
  const before=await healthyDb.selectFrom('ec_post').selectAll().execute(),history=await healthyDb.selectFrom('_cms_revisions').selectAll().orderBy('id').execute();
  await healthyDb.schema.alterTable('_cms_revisions').renameTo('_review_unavailable_revisions').execute();
  let read;try{read=await f.query('getContent',key);}
  finally{await healthyDb.schema.alterTable('_review_unavailable_revisions').renameTo('_cms_revisions').execute();}assert.equal(read.data.title,'Published');assert.equal(read.liveData,undefined);assert.equal(read.draftRevisionId,staged.draftRevisionId);
  assert.deepEqual(await healthyDb.selectFrom('ec_post').selectAll().execute(),before);assert.deepEqual(await healthyDb.selectFrom('_cms_revisions').selectAll().orderBy('id').execute(),history);
 }finally{await Promise.allSettled(tasks.splice(0));await f.close();}
});
