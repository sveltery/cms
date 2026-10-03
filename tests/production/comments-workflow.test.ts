// Original feature workflow through the actual built registered server.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import { registeredComments } from '../helpers/comments/registered.ts';

for (const target of ['Node SQLite', 'raw D1'] as const) {
 test(`comments ${target} public submission, approval, reply, reaction and cascade deletion`, { timeout: 30000 }, async () => {
  const fixture = await registeredComments(target);
  try {
   const url = `/api/comments/post/${fixture.content.id}`;
   const initial = await fixture.request(url);
   assert.equal(initial.status, 200);
   assert.deepEqual((await initial.json()).data.items, []);
   const submitted = await fixture.request(url, 'POST', { authorName: 'Jane', authorEmail: 'jane@example.com', body: 'Great article!' });
   assert.equal(submitted.status, 201);
   const created = (await submitted.json()).data;
   assert.equal(created.status, 'pending');
   const inbox = await fixture.request('/api/admin/comments', 'GET', undefined, true);
   assert.equal(inbox.status, 200);
   const comment = (await inbox.json()).data.items[0];
   assert.equal(comment.body, 'Great article!');
   assert.equal(comment.authorEmail, 'jane@example.com');
   const approved = await fixture.request(`/api/admin/comments/${comment.id}/status`, 'PUT', { status: 'approved' }, true);
   assert.equal(approved.status, 200);
   assert.equal((await approved.json()).data.status, 'approved');
   const reply = await fixture.request(url, 'POST', { authorName: 'Jane', authorEmail: 'jane@example.com', body: 'A reply', parentId: comment.id });
   assert.equal(reply.status, 201);
   assert.equal((await reply.json()).data.status, 'approved');
   const publicList = await fixture.request(url + '?threaded=true');
   assert.equal(publicList.status, 200);
   const visible = (await publicList.json()).data.items;
   assert.equal(visible.length, 1);
   assert.equal(visible[0].replies[0].body, 'A reply');
   assert.equal(Object.hasOwn(visible[0], 'authorEmail'), false);
   assert.equal(Object.hasOwn(visible[0], 'ipHash'), false);
   const reaction = await fixture.request(url + '/reactions', 'POST', { commentId: comment.id, reaction: 'like' });
   assert.equal(reaction.status, 200);
   assert.equal((await reaction.json()).data.counts.like, 1);
   const deleted = await fixture.request(`/api/admin/comments/${comment.id}`, 'DELETE', undefined, true);
   assert.equal(deleted.status, 200);
   assert.equal((await sql<{ count: number }>`SELECT COUNT(*) AS count FROM _cms_comments`.execute(fixture.database.db)).rows[0].count, 0);
   assert.equal((await sql<{ count: number }>`SELECT COUNT(*) AS count FROM _cms_comment_reactions`.execute(fixture.database.db)).rows[0].count, 0);
  } finally { await fixture.close(); }
 });
}
