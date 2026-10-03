// Original native SSR inbox registration, with one actual existing session per target.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registeredComments } from '../helpers/comments/registered.ts';
for(const target of ['Node SQLite','raw D1'] as const) {
 test(`comments ${target} registered moderation page renders stored pending comments`,{timeout:30000},async()=>{
  const fixture=await registeredComments(target);
  try {
   const submitted=await fixture.request(`/api/comments/post/${fixture.content.id}`,'POST',{authorName:'Jane',authorEmail:'jane@example.com',body:'Comment awaiting moderation'});
   assert.equal(submitted.status,201);
   const response=await fixture.request('/comments','GET',undefined,true);
   assert.equal(response.status,200);
   const html=await response.text();
   assert.match(html,/Review and moderate comments across your content/);
   assert.match(html,/Comment awaiting moderation/);
   assert.match(html,/jane@example.com/);
  } finally {await fixture.close();}
 });
}
