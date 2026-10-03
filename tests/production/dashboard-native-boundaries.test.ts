// Original native composition requirements, zero source callback credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import {schemaAdminRemotes} from '../helpers/schema-admin-remotes.ts';
for(const target of ['Node','D1'] as const)test(`${target}: dashboard query is registered and dashboard authority precedes storage`,async()=>{
 const h=await schemaAdminRemotes(target);
 try{
  assert.ok(h.ids.has('getDashboardStats'),'actual registered dashboard query');
  assert.equal((await h.request('/dashboard')).status,200);
  const stats=await h.query('getDashboardStats');assert.equal(stats.userCount,4);
  assert.deepEqual((await h.query('getDashboardStats',undefined,'subscriber')).collections,[]);
  h.probeStorage();const response=await h.request('/api/dashboard',null);assert.equal(response.status,401);assert.equal(h.storageReads,0);
 }finally{await h.close();}
});
