// Original native registered HTTP requirements. No copied Source/authentication credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import { persistedRemotes } from '../helpers/persisted-remotes.ts';

for (const [label, url, method, session] of [
  ['public list', '/api/comments/post/content-1', 'GET', null],
  ['public submission', '/api/comments/post/content-1', 'POST', null],
  ['reactions', '/api/comments/post/content-1/reactions', 'GET', null],
  ['moderation inbox', '/api/comments', 'GET', 'admin']
] as const) {
  test(`comments ${label} reports unavailable storage without implicit DDL`, async () => {
    const fixture = await persistedRemotes({ persistedSessions: true, mutationsEnabled: true });
    try {
      // Actual bounded partial comment storage after real canonical startup.
      // Existing principals, markers and unavailable assertions stay unchanged.
      await sql`DROP TABLE _cms_comment_reactions`.execute(fixture.database.db);
      await sql`DROP TABLE _cms_comments`.execute(fixture.database.db);
      const before = (await sql`SELECT name, sql FROM sqlite_schema ORDER BY name`.execute(fixture.database.db)).rows;
      const response = await fixture.request(url, session, {
        method,
        ...(method === 'POST' ? {
          headers: { 'content-type': 'application/json', origin: 'http://cms.test' },
          body: JSON.stringify({ authorName: 'Jane', authorEmail: 'jane@example.com', body: 'Great post!' })
        } : {})
      });
      assert.equal(response.status, 503);
      assert.equal((await response.json()).error.code, 'COMMENTS_UNAVAILABLE');
      assert.deepEqual((await sql`SELECT name, sql FROM sqlite_schema ORDER BY name`.execute(fixture.database.db)).rows, before);
    } finally {
      await fixture.close();
    }
  });
}
