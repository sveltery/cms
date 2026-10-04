// Original whole native bridge requirements; one ordinary existing principal per fixture.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import { registeredComments } from '../helpers/comments/registered.ts';
import { SchemaRegistry } from '../../src/lib/server/database/registry.ts';
for(const target of ['Node SQLite','raw D1'] as const){
 test(`comments ${target} registered settings persist all four stored values with existing CAS`,{timeout:30000},async()=>{
  const fixture=await registeredComments(target);
  try{
   const path='/api/admin/comments/settings/post';
   const read=await fixture.request(path,'GET',undefined,true);assert.equal(read.status,200);const original=(await read.json()).data;
   assert.equal(original.commentsAutoApproveUsers,true);
   const input={commentsEnabled:false,commentsModeration:'all',commentsClosedAfterDays:0,commentsAutoApproveUsers:false};
   const expected={version:original.version,updatedAt:original.updatedAt};
   const before=(await sql`SELECT name,sql FROM sqlite_schema ORDER BY name`.execute(fixture.database.db)).rows;
   const response=await fixture.request(path,'PUT',{input,expected},true);assert.equal(response.status,200);const saved=(await response.json()).data;
   for(const [key,value] of Object.entries(input))assert.equal(saved[key],value);assert.equal(saved.version,original.version);assert.notEqual(saved.updatedAt,original.updatedAt);
   const stored=await new SchemaRegistry(fixture.database).getCollection('post');for(const [key,value] of Object.entries(input))assert.equal((stored as unknown as Record<string,unknown>)[key],value);
   const stale=await fixture.request(path,'PUT',{input:{...input,commentsModeration:'none'},expected},true);assert.equal(stale.status,409);assert.equal((await stale.json()).error.code,'CONFLICT');
   assert.equal((await new SchemaRegistry(fixture.database).getCollection('post'))!.commentsModeration,'all');
   assert.deepEqual((await sql`SELECT name,sql FROM sqlite_schema ORDER BY name`.execute(fixture.database.db)).rows,before);
  }finally{await fixture.close();}
 });
 test(`comments ${target} registered settings page exposes actual collection controls`,{timeout:30000},async()=>{
  const fixture=await registeredComments(target);try{const response=await fixture.request('/comments/settings/post','GET',undefined,true);assert.equal(response.status,200);const html=await response.text();for(const label of ['Enable comments','First-time commenters only','Close comments after (days)','Auto-approve authenticated users'])assert.ok(html.includes(label));assert.match(html,/Comment settings.*Posts/);}finally{await fixture.close();}
 });
}
